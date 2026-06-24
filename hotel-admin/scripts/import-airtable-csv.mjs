import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const APP_ROOT = path.resolve(__dirname, '..')
const REPO_ROOT = path.resolve(APP_ROOT, '..')

const DEFAULT_RESERVATIONS_CSV = path.join(REPO_ROOT, 'doc', 'Reservations-Airtable_export.csv')
const DEFAULT_INVENTORY_CSV = path.join(REPO_ROOT, 'doc', 'Tipo de Habitación-Grid view.csv')

const options = parseArgs(process.argv.slice(2))
const env = await loadEnv(path.join(APP_ROOT, '.env.local'))

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
const hotelSlug = options.hotelSlug ?? 'hotel-cascabel'
const hotelName = options.hotelName ?? 'Hotel Cascabel'
const hotelTimezone = options.hotelTimezone ?? 'America/Lima'

const reservationsCsvPath = path.resolve(options.reservationsCsv ?? DEFAULT_RESERVATIONS_CSV)
const inventoryCsvPath = path.resolve(options.inventoryCsv ?? DEFAULT_INVENTORY_CSV)

const reservationsCsv = await fs.readFile(reservationsCsvPath, 'utf8')
const inventoryCsv = await fs.readFile(inventoryCsvPath, 'utf8')

const reservationRows = parseCsv(reservationsCsv)
const inventoryRows = parseCsv(inventoryCsv)

const prepared = prepareMigrationData({ reservationRows, inventoryRows })

if (options.dryRun) {
  printSummary(prepared, {
    hotelSlug,
    hotelName,
    reservationsCsvPath,
    inventoryCsvPath,
    mode: 'dry-run',
  })
  process.exit(0)
}

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in hotel-admin/.env.local')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const hotel = await ensureHotel(supabase, {
  slug: hotelSlug,
  name: hotelName,
  timezone: hotelTimezone,
})

await deleteExistingHotelData(supabase, hotel.id)

const roomTypeIdByKey = await insertRoomTypes(supabase, hotel.id, prepared.roomTypes)
const roomIdByCode = await insertRooms(supabase, hotel.id, prepared.rooms, roomTypeIdByKey)
const guestIdByKey = await insertGuests(supabase, hotel.id, prepared.guests)
await insertReservations(supabase, hotel.id, prepared.reservations, roomIdByCode, guestIdByKey)

printSummary(prepared, {
  hotelSlug,
  hotelName,
  reservationsCsvPath,
  inventoryCsvPath,
  mode: 'applied',
})

function parseArgs(args) {
  const parsed = {
    dryRun: false,
    reservationsCsv: null,
    inventoryCsv: null,
    hotelSlug: null,
    hotelName: null,
    hotelTimezone: null,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--dry-run') {
      parsed.dryRun = true
      continue
    }

    if (arg.startsWith('--reservations-csv=')) {
      parsed.reservationsCsv = arg.split('=').slice(1).join('=')
      continue
    }

    if (arg.startsWith('--inventory-csv=')) {
      parsed.inventoryCsv = arg.split('=').slice(1).join('=')
      continue
    }

    if (arg.startsWith('--hotel-slug=')) {
      parsed.hotelSlug = arg.split('=').slice(1).join('=')
      continue
    }

    if (arg.startsWith('--hotel-name=')) {
      parsed.hotelName = arg.split('=').slice(1).join('=')
      continue
    }

    if (arg.startsWith('--hotel-timezone=')) {
      parsed.hotelTimezone = arg.split('=').slice(1).join('=')
      continue
    }
  }

  return parsed
}

async function loadEnv(filePath) {
  const output = {}
  try {
    const content = await fs.readFile(filePath, 'utf8')
    for (const line of content.split(/\r?\n/)) {
      if (!line || line.trim().startsWith('#')) continue
      const separatorIndex = line.indexOf('=')
      if (separatorIndex === -1) continue
      const key = line.slice(0, separatorIndex).trim()
      const value = line.slice(separatorIndex + 1).trim()
      output[key] = value
    }
  } catch {}
  return { ...output, ...process.env }
}

function parseCsv(content) {
  const rows = []
  let current = ''
  let row = []
  let insideQuotes = false

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]
    const next = content[index + 1]

    if (char === '"') {
      if (insideQuotes && next === '"') {
        current += '"'
        index += 1
      } else {
        insideQuotes = !insideQuotes
      }
      continue
    }

    if (char === ',' && !insideQuotes) {
      row.push(current)
      current = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && next === '\n') index += 1
      row.push(current)
      if (row.some((value) => value !== '')) rows.push(row)
      row = []
      current = ''
      continue
    }

    current += char
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current)
    if (row.some((value) => value !== '')) rows.push(row)
  }

  const [headerRow, ...dataRows] = rows
  const headers = headerRow.map((header) => normalizeHeader(header))
  return dataRows.map((values) => {
    const record = {}
    headers.forEach((header, headerIndex) => {
      record[header] = values[headerIndex] ?? ''
    })
    return record
  })
}

function normalizeHeader(header) {
  return header
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function prepareMigrationData({ reservationRows, inventoryRows }) {
  const roomTypeMap = new Map()
  const roomMap = new Map()
  const guestMap = new Map()
  const reservations = []
  const syntheticRoomCodes = new Set()

  for (const row of inventoryRows) {
    const rawNumber = cleanValue(row.N_Habitacion)
    if (!rawNumber) continue

    const typeLabel = normalizeWhitespace(cleanValue(row.tipo_de_habitacion) || 'Sin tipo')
    const standardCapacity = toNullableInt(row.Capacidad_Estandar)
    const maxCapacity = toNullableInt(row.Capacidad_Maxima)
    const price = toNullableNumber(row.Precio)
    const bedLabel = normalizeWhitespace(cleanValue(row.Camas))

    const roomTypeName = formatRoomTypeName(typeLabel, standardCapacity ?? maxCapacity)
    const roomTypeKey = [roomTypeName, standardCapacity ?? '', maxCapacity ?? '', price ?? ''].join('|')

    if (!roomTypeMap.has(roomTypeKey)) {
      roomTypeMap.set(roomTypeKey, {
        key: roomTypeKey,
        name: roomTypeName,
        description: buildRoomTypeDescription({ typeLabel, standardCapacity, maxCapacity, bedLabel }),
        capacity: standardCapacity ?? maxCapacity,
        price,
      })
    }

    const roomCode = canonicalRoomCode(rawNumber, typeLabel)
    const roomEntry = roomMap.get(roomCode) ?? {
      room_number: roomCode,
      floor: inferFloorFromCode(roomCode),
      notes: '',
      variantKeys: new Set(),
      rawNumbers: new Set(),
      preferredRoomTypeKey: null,
    }

    roomEntry.variantKeys.add(roomTypeKey)
    roomEntry.rawNumbers.add(rawNumber)
    if (!roomEntry.preferredRoomTypeKey) {
      roomEntry.preferredRoomTypeKey = roomTypeKey
    } else {
      const currentPreferred = roomTypeMap.get(roomEntry.preferredRoomTypeKey)
      const nextCandidate = roomTypeMap.get(roomTypeKey)
      if ((nextCandidate?.capacity ?? 0) > (currentPreferred?.capacity ?? 0)) {
        roomEntry.preferredRoomTypeKey = roomTypeKey
      }
    }
    roomMap.set(roomCode, roomEntry)
  }

  for (const room of roomMap.values()) {
    if (room.variantKeys.size > 1) {
      const variants = [...room.variantKeys]
        .map((key) => roomTypeMap.get(key)?.name)
        .filter(Boolean)
      room.notes = `Imported from Airtable inventory. Variants: ${variants.join(', ')}`
    }
  }

  for (const row of reservationRows) {
    const guestName = normalizeWhitespace(cleanValue(row.Guest_Name))
    const checkIn = normalizeDate(row.Check_In)
    const checkOut = normalizeDate(row.Check_Out)
    const rawRoomType = normalizeWhitespace(cleanValue(row.Room_Type))
    const roomCode = normalizeWhitespace(cleanValue(row.Room_Number))
    const rawPhone = normalizeWhitespace(cleanValue(row.Phone_Number))
    const notes = cleanValue(row.Notes)
    const createdAt = normalizeCreatedAt(row.Created_At)

    if (!guestName || !checkIn || !checkOut) continue

    if (roomCode && !roomMap.has(roomCode)) {
      const reservationRoomType = buildReservationRoomType(rawRoomType)
      if (!roomTypeMap.has(reservationRoomType.key)) {
        roomTypeMap.set(reservationRoomType.key, reservationRoomType)
      }

      roomMap.set(roomCode, {
        room_number: roomCode,
        floor: inferFloorFromCode(roomCode),
        notes: 'Created from reservation history only. No matching inventory row was found in the Airtable room export.',
        variantKeys: new Set([reservationRoomType.key]),
        rawNumbers: new Set([roomCode]),
        preferredRoomTypeKey: reservationRoomType.key,
      })
      syntheticRoomCodes.add(roomCode)
    }

    const fallbackPhone = extractPhoneFromNotes(notes)
    const guestPhone = normalizePhone(rawPhone || fallbackPhone)
    const guestKey = guestPhone ? `phone:${guestPhone}` : `name:${guestName.toLowerCase()}`

    if (!guestMap.has(guestKey)) {
      guestMap.set(guestKey, {
        key: guestKey,
        name: guestName,
        phone: guestPhone,
        notes: null,
      })
    }

    reservations.push({
      guest_key: guestKey,
      room_number: roomCode || null,
      check_in: checkIn,
      check_out: checkOut,
      status: 'confirmed',
      source: 'airtable-csv',
      notes: normalizeReservationNotes({ notes, rawRoomType, roomCode }),
      created_at: createdAt,
    })
  }

  return {
    roomTypes: [...roomTypeMap.values()],
    rooms: [...roomMap.values()].map((room) => ({
      room_number: room.room_number,
      floor: room.floor,
      notes: room.notes || null,
      room_type_key: room.preferredRoomTypeKey,
    })),
    guests: [...guestMap.values()],
    reservations,
    syntheticRoomCodes: [...syntheticRoomCodes].sort(),
  }
}

function cleanValue(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeWhitespace(value) {
  return value ? value.replace(/\s+/g, ' ').trim() : ''
}

function toNullableInt(value) {
  const parsed = Number.parseInt(cleanValue(value), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function toNullableNumber(value) {
  const parsed = Number.parseFloat(cleanValue(value).replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function formatRoomTypeName(typeLabel, capacity) {
  if (!capacity) return typeLabel
  if (/\b\d+p\b/i.test(typeLabel) || /\(\d+\)/.test(typeLabel)) return typeLabel
  return `${typeLabel} ${capacity}p`
}

function buildRoomTypeDescription({ typeLabel, standardCapacity, maxCapacity, bedLabel }) {
  const parts = []
  parts.push(`Imported from Airtable inventory as ${typeLabel}.`)
  if (standardCapacity != null) parts.push(`Standard capacity: ${standardCapacity}.`)
  if (maxCapacity != null) parts.push(`Max capacity: ${maxCapacity}.`)
  if (bedLabel) parts.push(`Beds: ${bedLabel}.`)
  return parts.join(' ')
}

function buildReservationRoomType(rawRoomType) {
  const normalized = normalizeWhitespace(rawRoomType || 'Imported room type')
  const extractedCapacity = extractCapacityHint(normalized)
  const name = formatRoomTypeName(normalized, extractedCapacity)

  return {
    key: `reservation-only|${name}`,
    name,
    description: 'Created from reservation history only because no matching inventory row was found.',
    capacity: extractedCapacity,
    price: null,
  }
}

function canonicalRoomCode(rawNumber, typeLabel) {
  const normalizedNumber = rawNumber.replace(/\s+/g, '')
  if (/^([A-Z])\d+/i.test(normalizedNumber)) return normalizedNumber.toUpperCase()

  const type = typeLabel.toLowerCase()
  if (type.includes('bungalow')) return `B${normalizedNumber}`
  if (type.includes('cuadruple') || type.includes('quintuple')) return `C${normalizedNumber}`
  return `H${normalizedNumber}`
}

function inferFloorFromCode(roomCode) {
  if (roomCode.startsWith('B')) return 'Bungalows'
  if (roomCode.startsWith('C')) return 'Cabanas'
  return 'Hotel'
}

function normalizeDate(value) {
  const trimmed = cleanValue(value)
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function normalizeCreatedAt(value) {
  const trimmed = cleanValue(value)
  if (!trimmed) return new Date().toISOString()
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString()
  return parsed.toISOString()
}

function extractPhoneFromNotes(notes) {
  if (!notes) return null
  const match = notes.match(/Celular:\s*([+\d\s-]+)/i)
  return match?.[1]?.trim() ?? null
}

function normalizePhone(value) {
  if (!value) return null
  const normalized = value.replace(/[^\d+]/g, '')
  return normalized || null
}

function normalizeReservationNotes({ notes, rawRoomType, roomCode }) {
  const parts = []
  if (rawRoomType) parts.push(`Airtable room type: ${rawRoomType}`)
  if (roomCode) parts.push(`Airtable room code: ${roomCode}`)
  if (notes) parts.push(notes.trim())
  return parts.join('\n\n')
}

function extractCapacityHint(value) {
  if (!value) return null
  const parenMatch = value.match(/\((\d+)\)/)
  if (parenMatch) return Number.parseInt(parenMatch[1], 10)

  const paxMatch = value.match(/(\d+)\s*p/i)
  if (paxMatch) return Number.parseInt(paxMatch[1], 10)

  return null
}

async function ensureHotel(supabase, { slug, name, timezone }) {
  const { data: existing, error: selectError } = await supabase
    .from('hotels')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (selectError) {
    throw new Error(`Could not query hotels table: ${selectError.message}`)
  }

  if (existing) return existing

  const { data, error } = await supabase
    .from('hotels')
    .insert({ slug, name, timezone })
    .select()
    .single()

  if (error) {
    throw new Error(`Could not create hotel row: ${error.message}`)
  }

  return data
}

async function deleteExistingHotelData(supabase, hotelId) {
  const orderedTables = ['reservations', 'guests', 'rooms', 'room_types']

  for (const table of orderedTables) {
    const { error } = await supabase.from(table).delete().eq('hotel_id', hotelId)
    if (error) {
      throw new Error(`Could not clear ${table}: ${error.message}`)
    }
  }
}

async function insertRoomTypes(supabase, hotelId, roomTypes) {
  const payload = roomTypes.map((roomType) => ({
    hotel_id: hotelId,
    name: roomType.name,
    description: roomType.description,
    price: roomType.price,
    capacity: roomType.capacity,
    active: true,
  }))

  const { data, error } = await supabase
    .from('room_types')
    .insert(payload)
    .select()

  if (error) {
    throw new Error(`Could not insert room types: ${error.message}`)
  }

  const byKey = new Map()
  data.forEach((row, index) => {
    byKey.set(roomTypes[index].key, row.id)
  })
  return byKey
}

async function insertRooms(supabase, hotelId, rooms, roomTypeIdByKey) {
  const payload = rooms.map((room) => ({
    hotel_id: hotelId,
    room_number: room.room_number,
    room_type_id: room.room_type_key ? roomTypeIdByKey.get(room.room_type_key) ?? null : null,
    floor: room.floor,
    notes: room.notes,
    active: true,
  }))

  const { data, error } = await supabase
    .from('rooms')
    .insert(payload)
    .select()

  if (error) {
    throw new Error(`Could not insert rooms: ${error.message}`)
  }

  const byCode = new Map()
  data.forEach((row) => {
    byCode.set(row.room_number, row.id)
  })
  return byCode
}

async function insertGuests(supabase, hotelId, guests) {
  const payload = guests.map((guest) => ({
    hotel_id: hotelId,
    name: guest.name,
    phone: guest.phone,
    notes: guest.notes,
  }))

  const { data, error } = await supabase
    .from('guests')
    .insert(payload)
    .select()

  if (error) {
    throw new Error(`Could not insert guests: ${error.message}`)
  }

  const byKey = new Map()
  data.forEach((row, index) => {
    byKey.set(guests[index].key, row.id)
  })
  return byKey
}

async function insertReservations(supabase, hotelId, reservations, roomIdByCode, guestIdByKey) {
  const payload = reservations.map((reservation) => ({
    hotel_id: hotelId,
    room_id: reservation.room_number ? roomIdByCode.get(reservation.room_number) ?? null : null,
    guest_id: guestIdByKey.get(reservation.guest_key) ?? null,
    check_in: reservation.check_in,
    check_out: reservation.check_out,
    status: reservation.status,
    notes: reservation.notes,
    source: reservation.source,
    created_at: reservation.created_at,
  }))

  const { error } = await supabase.from('reservations').insert(payload)
  if (error) {
    throw new Error(`Could not insert reservations: ${error.message}`)
  }
}

function printSummary(prepared, context) {
  const summary = {
    mode: context.mode,
    hotel: {
      slug: context.hotelSlug,
      name: context.hotelName,
    },
    files: {
      reservationsCsv: context.reservationsCsvPath,
      inventoryCsv: context.inventoryCsvPath,
    },
    counts: {
      roomTypes: prepared.roomTypes.length,
      rooms: prepared.rooms.length,
      guests: prepared.guests.length,
      reservations: prepared.reservations.length,
    },
    syntheticRoomCodes: prepared.syntheticRoomCodes,
    roomSample: prepared.rooms.slice(0, 5),
    roomTypeSample: prepared.roomTypes.slice(0, 5),
  }

  console.log(JSON.stringify(summary, null, 2))
}
