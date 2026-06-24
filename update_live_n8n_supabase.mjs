import axios from 'axios'
import fs from 'fs'
import path from 'path'

// Setup note:
// This patcher expects an n8n credential reference for the Supabase service-role
// token. See doc/n8n-supabase-credential-setup.md before running it live.

const ROOT = process.cwd()
const N8N_ENV = readEnvFile(path.join(ROOT, '.env'))
const SUPABASE_ENV = readEnvFile(path.join(ROOT, 'hotel-admin', '.env.local'))

const N8N_HOST = N8N_ENV.N8N_HOST
const N8N_API_KEY = N8N_ENV.N8N_API_KEY
const SUPABASE_URL = SUPABASE_ENV.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = SUPABASE_ENV.SUPABASE_SERVICE_ROLE_KEY
const HOTEL_ID = 'cace9232-8581-47f9-95a3-b472942d54bd'
const SUPABASE_CREDENTIAL_TYPE = N8N_ENV.SUPABASE_N8N_CREDENTIAL_TYPE || 'httpHeaderAuth'
const SUPABASE_CREDENTIAL_ID = N8N_ENV.SUPABASE_N8N_CREDENTIAL_ID
const SUPABASE_CREDENTIAL_NAME = N8N_ENV.SUPABASE_N8N_CREDENTIAL_NAME

const WORKFLOWS = [
  { id: 'fOG5K4vIB48WsoVA', name: 'Hotel Booking Reservation Automation - WhatsApp' },
  { id: 'DvXRjZIinM2Yo6ZV', name: 'Vapi Tool - Create Booking' },
  { id: 'DYJ0yjUu8w8cjvKq', name: 'Vapi Tool - Check Room Inventory' },
  { id: 'Cq4XW1F8iWjmRisr', name: 'Vapi Tool - Check Booked Rooms' },
  { id: 'NQrGL5iYn4JlTHQJ', name: 'Vapi Tool - Escalate Owner' },
]

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json',
}

const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  assertRequired('N8N_HOST', N8N_HOST)
  assertRequired('N8N_API_KEY', N8N_API_KEY)
  assertRequired('NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL)
  assertRequired('SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY)
  assertRequired('SUPABASE_N8N_CREDENTIAL_ID', SUPABASE_CREDENTIAL_ID)
  assertRequired('SUPABASE_N8N_CREDENTIAL_NAME', SUPABASE_CREDENTIAL_NAME)

  const backupDir = path.join(ROOT, 'doc', 'backups')
  const patchDir = path.join(backupDir, 'generated-supabase-patches')
  fs.mkdirSync(patchDir, { recursive: true })

  for (const workflowRef of WORKFLOWS) {
    const workflow = await getWorkflow(workflowRef.id)
    const updated = mutateWorkflow(workflow)

    const outPath = path.join(patchDir, `${sanitize(workflow.name)}_supabase_patch.json`)
    fs.writeFileSync(outPath, JSON.stringify(redactWorkflow(updated), null, 2))

    if (DRY_RUN) {
      console.log(`DRY RUN: wrote ${outPath}`)
      continue
    }

    await axios.put(
      `${N8N_HOST}/api/v1/workflows/${workflow.id}`,
      {
        name: updated.name,
        nodes: updated.nodes,
        connections: updated.connections,
        settings: updated.settings,
        staticData: updated.staticData,
      },
      { headers }
    )

    if (workflow.active) {
      await axios.post(`${N8N_HOST}/api/v1/workflows/${workflow.id}/activate`, {}, { headers })
    }

    console.log(`UPDATED: ${workflow.name} (${workflow.id})`)
    console.log(`PATCH JSON: ${outPath}`)
  }
}

async function getWorkflow(id) {
  const response = await axios.get(`${N8N_HOST}/api/v1/workflows/${id}`, { headers })
  return response.data
}

function mutateWorkflow(workflow) {
  const clone = JSON.parse(JSON.stringify(workflow))

  switch (clone.name) {
    case 'Vapi Tool - Create Booking':
      patchVapiCreateBooking(clone)
      break
    case 'Vapi Tool - Check Room Inventory':
      patchVapiCheckRoomInventory(clone)
      break
    case 'Vapi Tool - Check Booked Rooms':
      patchVapiCheckBookedRooms(clone)
      break
    case 'Hotel Booking Reservation Automation - WhatsApp':
      patchWhatsAppWorkflow(clone)
      break
    case 'Vapi Tool - Escalate Owner':
      patchEscalateOwner(clone)
      break
    default:
      throw new Error(`No mutation registered for workflow: ${clone.name}`)
  }

  return clone
}

function patchVapiCreateBooking(workflow) {
  replaceNode(workflow, 'Check for Duplicate', {
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    parameters: {
      jsCode: buildVapiCreateDuplicateCode(),
    },
    credentials: buildSupabaseCredentialRef(),
  })

  replaceNode(workflow, 'Build Dedup Result', {
    parameters: {
      jsCode: `
const ctx = $('Extract and Validate').first().json;
const toolCallId = ctx.toolCallId;
const result = $input.first().json;

if (!ctx.validation_ok) {
  return [{ json: { _is_duplicate: true, results: [{ toolCallId, result: 'Cannot create booking. ' + ctx.validation_error }] } }];
}

if (result.error) {
  return [{ json: { _is_duplicate: true, results: [{ toolCallId, result: 'Could not reach the hotel database: ' + result.error }] } }];
}

if (result.duplicate) {
  return [{ json: { _is_duplicate: true, results: [{ toolCallId, result: result.message }] } }];
}

return [{
  json: {
    _is_duplicate: false,
    ...ctx,
    resolved_room_type_id: result.roomTypeId,
    resolved_room_type_name: result.roomTypeName,
    assigned_room_id: result.roomId,
    assigned_room_number: result.roomNumber,
    existing_guest_id: result.guestId || null
  }
}];
      `.trim(),
    },
  })

  replaceNode(workflow, 'Create Booking Record', {
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    parameters: {
      jsCode: buildVapiCreateBookingCode(),
    },
    credentials: buildSupabaseCredentialRef(),
  })

  replaceNode(workflow, 'Format Success Response', {
    parameters: {
      jsCode: `
const ctx = $input.first().json;
const toolCallId = $('Extract and Validate').first().json.toolCallId;
const output = {
  results: [{
    toolCallId,
    result: 'Booking confirmed for ' + ctx.guest_name + '. Room type: ' + ctx.resolved_room_type_name + '. Assigned room: ' + ctx.assigned_room_number + '. Check-in: ' + ctx.check_in + ', Check-out: ' + ctx.check_out + '. Booking recorded successfully.'
  }]
};
return [{ json: output }];
      `.trim(),
    },
  })
}

function patchVapiCheckRoomInventory(workflow) {
  replaceNode(workflow, 'Get Room Inventory', {
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    parameters: {
      jsCode: buildVapiInventoryCode(),
    },
    credentials: buildSupabaseCredentialRef(),
  })

  replaceNode(workflow, 'Format Vapi Response', {
    parameters: {
      jsCode: `
const toolCallId = $('Extract Tool Call ID').first().json.toolCallId;
const payload = $input.first().json;
const output = { results: [{ toolCallId, result: payload.result || 'No room inventory found.' }] };
return [{ json: output }];
      `.trim(),
    },
  })
}

function patchVapiCheckBookedRooms(workflow) {
  replaceNode(workflow, 'Extract Tool Call ID', {
    parameters: {
      jsCode: `
const item = $input.first();
const body = item.json.body || item.json;

const toolCalls = body?.message?.toolCalls
  || body?.toolCalls
  || body?.message?.toolCallList
  || body?.toolCallList
  || [];

const toolCallId = toolCalls?.[0]?.id || body?.toolCallId || 'unknown';

let args = {};
try {
  const rawArgs = toolCalls?.[0]?.function?.arguments || '{}';
  args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
} catch (error) {
  args = {};
}

return [{
  json: {
    toolCallId,
    check_in: args.check_in || args.checkIn || '',
    check_out: args.check_out || args.checkOut || '',
    room_type: args.room_type || args.roomType || ''
  }
}];
      `.trim(),
    },
  })

  replaceNode(workflow, 'Get Booked Rooms', {
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    parameters: {
      jsCode: buildVapiBookedRoomsCode(),
    },
    credentials: buildSupabaseCredentialRef(),
  })

  replaceNode(workflow, 'Format Vapi Response', {
    parameters: {
      jsCode: `
const toolCallId = $('Extract Tool Call ID').first().json.toolCallId;
const payload = $input.first().json;
const output = { results: [{ toolCallId, result: payload.result || 'No bookings found.' }] };
return [{ json: output }];
      `.trim(),
    },
  })
}

function patchWhatsAppWorkflow(workflow) {
  workflow.nodes = workflow.nodes.filter((node) => node.name !== 'Respond to Webhook')
  delete workflow.connections['Respond to Webhook']
  workflow.connections['Twilio Webhook'] = {
    main: [[{ node: 'WhatsApp Parser Lab', type: 'main', index: 0 }]],
  }

  replaceNode(workflow, 'Check State', {
    type: 'n8n-nodes-base.set',
    typeVersion: 1,
    parameters: {
      values: {
        boolean: [
          { name: 'state_active', value: false },
          { name: 'human_handling', value: false },
        ],
        string: [
          { name: 'reason', value: '' },
          { name: 'priority', value: 'normal' },
          { name: 'pause_until', value: '' },
        ],
      },
      options: {},
    },
  })

  replaceNode(workflow, 'AI Agent', {
    parameters: {
      ...findNode(workflow, 'AI Agent').parameters,
      options: {
        ...findNode(workflow, 'AI Agent').parameters.options,
        systemMessage: `
Eres un asistente de reservas para un hotel en Perú.

Reglas obligatorias sobre datos reales del hotel:
- Si el usuario pregunta qué tipos de habitación existen, qué habitaciones tienen, capacidades, camas, precios o disponibilidad, DEBES consultar las herramientas de la base de datos del hotel antes de responder.
- Para preguntas sobre tipos de habitación, capacidades o camas, usa primero 'Get_Room_Inventory'.
- Para preguntas sobre disponibilidad por fecha o habitaciones libres, usa 'Check_Booked_Rooms' y también 'Get_Room_Inventory' si necesitas describir los tipos de habitación.
- No inventes nombres de habitaciones, capacidades, precios, camas ni disponibilidad. Nunca respondas con categorías genéricas si no vienen de las herramientas.
- Si las herramientas no devuelven datos suficientes, dilo claramente y pide aclaración o indica que no pudiste recuperar la información en este momento.

Si el usuario confirma (dice "si", "ok", "adelante"), DEBES llamar a 'Booking_Tool'.

Datos obligatorios:
- Guest_Name: Nombre del huésped.
- Check_In: YYYY-MM-DD.
- Check_Out: YYYY-MM-DD.
- Room_Type: Tipo de habitación.

Extrae los datos del historial y llama a 'Booking_Tool' DE INMEDIATO tras la confirmación. No respondas texto antes de llamar a la herramienta.
        `.trim(),
      },
    },
  })

  replaceNode(workflow, 'Get_Room_Inventory', buildWhatsAppToolNode({
    nodeName: 'Get_Room_Inventory',
    toolName: 'Get_Room_Inventory',
    description: 'Consulta el inventario real del hotel en Supabase y devuelve tipos de habitación, cantidades, precios y números de habitación activos.',
    jsCode: buildWhatsAppInventoryToolCode(),
    inputSchema: {
      type: 'object',
      properties: {
        room_type: { type: 'string' },
      },
    },
  }))

  replaceNode(workflow, 'Check_Booked_Rooms', buildWhatsAppToolNode({
    nodeName: 'Check_Booked_Rooms',
    toolName: 'Check_Booked_Rooms',
    description: 'Consulta reservas reales del hotel en Supabase y revisa ocupación o disponibilidad por fechas y tipo de habitación.',
    jsCode: buildWhatsAppBookedRoomsToolCode(),
    inputSchema: {
      type: 'object',
      properties: {
        check_in: { type: 'string' },
        check_out: { type: 'string' },
        room_type: { type: 'string' },
      },
    },
  }))

  replaceNode(workflow, 'Booking_Tool', buildWhatsAppToolNode({
    nodeName: 'Booking_Tool',
    toolName: 'Booking_Tool',
    description: 'Crea una reserva confirmada en Supabase, asignando una habitación real disponible del tipo solicitado para las fechas indicadas.',
    jsCode: buildWhatsAppBookingToolCode(),
    inputSchema: {
      type: 'object',
      required: ['Guest_Name', 'Check_In', 'Check_Out', 'Room_Type'],
      properties: {
        Guest_Name: { type: 'string' },
        Check_In: { type: 'string' },
        Check_Out: { type: 'string' },
        Room_Type: { type: 'string' },
        Phone_Number: { type: 'string' },
        Notes: { type: 'string' },
      },
    },
  }))

  replaceNode(workflow, 'Update Redis State Logic V3', {
    type: 'n8n-nodes-base.set',
    typeVersion: 1,
    parameters: {
      values: {
        string: [
          { name: 'state_storage_status', value: 'skipped' },
        ],
      },
      options: {},
    },
  })
}

function patchEscalateOwner(workflow) {
  const node = findNode(workflow, 'Build State and Alert')
  node.notes = 'Escalation path inspected during Supabase cutover. No Airtable dependency detected.'
}

function buildWhatsAppToolNode({ nodeName, toolName, description, jsCode, inputSchema }) {
  return {
    type: '@n8n/n8n-nodes-langchain.toolCode',
    typeVersion: 1.3,
    parameters: {
      name: toolName,
      toolDescription: description,
      jsCode,
      language: 'javaScript',
      specifyInputSchema: true,
      inputSchema: JSON.stringify(inputSchema),
    },
    credentials: buildSupabaseCredentialRef(),
  }
}

function replaceNode(workflow, nodeName, patch) {
  const node = findNode(workflow, nodeName)
  Object.assign(node, patch)
  if (patch.parameters) {
    node.parameters = patch.parameters
  }
  if (patch.type && !patch.credentials) {
    delete node.credentials
  }
  if (patch.credentials) {
    node.credentials = patch.credentials
  }
}

function findNode(workflow, nodeName) {
  const node = workflow.nodes.find((entry) => entry.name === nodeName)
  if (!node) {
    throw new Error(`Node not found in workflow "${workflow.name}": ${nodeName}`)
  }
  return node
}

function buildSupabaseHelperCode() {
  return `
const SUPABASE_URL = ${JSON.stringify(SUPABASE_URL)};
const SUPABASE_SERVICE_ROLE_KEY = ${JSON.stringify(SUPABASE_SERVICE_ROLE_KEY)};
const SUPABASE_CREDENTIAL_TYPE = ${JSON.stringify(SUPABASE_CREDENTIAL_TYPE)};
const HOTEL_ID = ${JSON.stringify(HOTEL_ID)};

function normalizeText(value) {
  return (value || '')
    .toString()
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .replace(/\\s+/g, ' ')
    .trim();
}

async function getSupabaseServiceRoleKey() {
  // n8n Code/Tool runtimes are inconsistent about exposing credential helpers.
  // Prefer an attached credential when the helper exists, otherwise fall back
  // to the build-time service-role key from the local environment.
  if (typeof $getCredentials === 'function') {
    const creds = await $getCredentials(SUPABASE_CREDENTIAL_TYPE);
    const candidates = [
      creds?.apiKey,
      creds?.token,
      creds?.password,
      creds?.value,
      creds?.accessToken,
      creds?.secret,
    ];
    const token = candidates.find((value) => typeof value === 'string' && value.trim());
    if (token) {
      return token;
    }
  }

  if (typeof SUPABASE_SERVICE_ROLE_KEY === 'string' && SUPABASE_SERVICE_ROLE_KEY.trim()) {
    return SUPABASE_SERVICE_ROLE_KEY;
  }

  throw new Error('No usable Supabase service-role key was available.');
}

async function supabaseRequest(path, { method = 'GET', body, params = {} } = {}) {
  const queryEntries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(String(value)));
  const url = SUPABASE_URL + '/rest/v1/' + path + (queryEntries.length ? '?' + queryEntries.join('&') : '');
  const requestFn = (typeof this !== 'undefined' && this?.helpers?.httpRequest)
    ? this.helpers.httpRequest.bind(this.helpers)
    : null;

  if (!requestFn) {
    throw new Error('No supported HTTP helper is available in this n8n sandbox.');
  }

  const serviceRoleKey = await getSupabaseServiceRoleKey();

  return await requestFn({
    method,
    url,
    headers: {
      apikey: serviceRoleKey,
      Authorization: 'Bearer ' + serviceRoleKey,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body,
    json: true,
  });
}

async function getActiveRoomTypes() {
  return await supabaseRequest('room_types', {
    params: {
      hotel_id: 'eq.' + HOTEL_ID,
      active: 'eq.true',
      select: 'id,name,description,price,capacity',
      order: 'name',
    },
  });
}

async function getActiveRooms() {
  return await supabaseRequest('rooms', {
    params: {
      hotel_id: 'eq.' + HOTEL_ID,
      active: 'eq.true',
      select: 'id,room_number,room_type_id',
      order: 'room_number',
    },
  });
}

function findMatchingRoomType(roomTypes, requestedName) {
  const normalizedRequested = normalizeText(requestedName);
  return roomTypes.find((roomType) => normalizeText(roomType.name) === normalizedRequested)
    || roomTypes.find((roomType) => normalizeText(roomType.name).includes(normalizedRequested))
    || null;
}
  `.trim()
}

function buildSupabaseCredentialRef() {
  return {
    [SUPABASE_CREDENTIAL_TYPE]: {
      id: SUPABASE_CREDENTIAL_ID,
      name: SUPABASE_CREDENTIAL_NAME,
    },
  }
}

function redactWorkflow(workflow) {
  return JSON.parse(JSON.stringify(workflow, (key, value) => {
    if (typeof value === 'string') {
      let redacted = value
      if (redacted.includes('SUPABASE_SERVICE_ROLE_KEY')) {
        redacted = redacted.replace(/SUPABASE_SERVICE_ROLE_KEY/g, '[REDACTED_SUPABASE_SECRET_REFERENCE]')
      }
      if (SUPABASE_SERVICE_ROLE_KEY && redacted.includes(SUPABASE_SERVICE_ROLE_KEY)) {
        redacted = redacted.split(SUPABASE_SERVICE_ROLE_KEY).join('[REDACTED_SUPABASE_SERVICE_ROLE_KEY]')
      }
      return redacted
    }
    return value
  }))
}

function buildVapiCreateDuplicateCode() {
  return `
${buildSupabaseHelperCode()}

const ctx = $('Extract and Validate').first().json;

if (!ctx.validation_ok) {
  return [{ json: { duplicate: true, message: 'Cannot create booking. ' + ctx.validation_error } }];
}

try {
  const roomTypes = await getActiveRoomTypes();
  const roomType = findMatchingRoomType(roomTypes, ctx.room_type);

  if (!roomType) {
    return [{ json: { duplicate: true, message: 'Room type not found in the hotel inventory: ' + ctx.room_type } }];
  }

  const rooms = (await getActiveRooms()).filter((room) => room.room_type_id === roomType.id);
  if (rooms.length === 0) {
    return [{ json: { duplicate: true, message: 'No active rooms are configured for room type ' + roomType.name + '.' } }];
  }

  let existingGuest = null;
  if (ctx.phone_number) {
    const guestsByPhone = await supabaseRequest('guests', {
      params: {
        hotel_id: 'eq.' + HOTEL_ID,
        phone: 'eq.' + ctx.phone_number,
        select: 'id,name,phone',
        limit: '1',
      },
    });
    existingGuest = guestsByPhone[0] || null;
  }

  if (!existingGuest) {
    const guestsByName = await supabaseRequest('guests', {
      params: {
        hotel_id: 'eq.' + HOTEL_ID,
        select: 'id,name,phone',
        order: 'created_at.desc',
      },
    });
    existingGuest = guestsByName.find((guest) => normalizeText(guest.name) === normalizeText(ctx.guest_name)) || null;
  }

  if (existingGuest) {
    const duplicateReservations = await supabaseRequest('reservations', {
      params: {
        hotel_id: 'eq.' + HOTEL_ID,
        guest_id: 'eq.' + existingGuest.id,
        check_in: 'eq.' + ctx.check_in,
        check_out: 'eq.' + ctx.check_out,
        select: 'id,room:rooms(room_number,room_type:room_types(name))',
      },
    });

    const sameTypeDuplicate = duplicateReservations.find((reservation) => {
      const roomTypeName = reservation.room?.room_type?.name || '';
      return normalizeText(roomTypeName) === normalizeText(roomType.name);
    });

    if (sameTypeDuplicate) {
      return [{
        json: {
          duplicate: true,
          message: 'A booking already exists for ' + existingGuest.name + ' in ' + roomType.name + ' from ' + ctx.check_in + ' to ' + ctx.check_out + '. No new booking was created.',
        },
      }];
    }
  }

  const roomIds = rooms.map((room) => room.id).join(',');
  const overlappingReservations = await supabaseRequest('reservations', {
    params: {
      hotel_id: 'eq.' + HOTEL_ID,
      status: 'neq.cancelled',
      room_id: 'in.(' + roomIds + ')',
      check_in: 'lt.' + ctx.check_out,
      check_out: 'gt.' + ctx.check_in,
      select: 'room_id',
    },
  });

  const bookedRoomIds = new Set(overlappingReservations.map((reservation) => reservation.room_id));
  const availableRoom = rooms.find((room) => !bookedRoomIds.has(room.id));

  if (!availableRoom) {
    return [{
      json: {
        duplicate: true,
        message: 'No available room of type ' + roomType.name + ' was found for ' + ctx.check_in + ' to ' + ctx.check_out + '.',
      },
    }];
  }

  return [{
    json: {
      duplicate: false,
      roomTypeId: roomType.id,
      roomTypeName: roomType.name,
      roomId: availableRoom.id,
      roomNumber: availableRoom.room_number,
      guestId: existingGuest?.id || null,
    },
  }];
} catch (error) {
  return [{ json: { duplicate: true, error: error.message } }];
}
  `.trim()
}

function buildVapiCreateBookingCode() {
  return `
${buildSupabaseHelperCode()}

const ctx = $input.first().json;

try {
  let guestId = ctx.existing_guest_id || null;

  if (!guestId) {
    const createdGuests = await supabaseRequest('guests', {
      method: 'POST',
      body: [{
        hotel_id: HOTEL_ID,
        name: ctx.guest_name,
        phone: ctx.phone_number || null,
        notes: null,
      }],
    });
    guestId = createdGuests[0].id;
  }

  const createdReservations = await supabaseRequest('reservations', {
    method: 'POST',
    body: [{
      hotel_id: HOTEL_ID,
      room_id: ctx.assigned_room_id,
      guest_id: guestId,
      check_in: ctx.check_in,
      check_out: ctx.check_out,
      status: 'confirmed',
      notes: null,
      source: 'vapi',
    }],
  });

  return [{
    json: {
      ...ctx,
      guest_id: guestId,
      reservation_id: createdReservations[0].id,
    },
  }];
} catch (error) {
  throw new Error('Failed to create reservation in Supabase: ' + error.message);
}
  `.trim()
}

function buildVapiInventoryCode() {
  return `
${buildSupabaseHelperCode()}

try {
  const roomTypes = await getActiveRoomTypes();
  const rooms = await getActiveRooms();

  const grouped = roomTypes.map((roomType) => {
    const matchingRooms = rooms.filter((room) => room.room_type_id === roomType.id);
    const roomList = matchingRooms.map((room) => room.room_number).join(', ');
    const parts = [roomType.name + ' (' + matchingRooms.length + ' rooms)'];
    if (roomType.capacity) parts.push('capacity ' + roomType.capacity);
    if (roomType.price != null) parts.push('price S/ ' + Number(roomType.price).toFixed(2));
    if (roomList) parts.push('rooms: ' + roomList);
    return parts.join(', ');
  });

  const result = grouped.length > 0
    ? 'Available room inventory: ' + grouped.join(' | ') + '.'
    : 'No active room inventory found.';

  return [{ json: { result } }];
} catch (error) {
  return [{ json: { result: 'Could not read room inventory from Supabase: ' + error.message } }];
}
  `.trim()
}

function buildVapiBookedRoomsCode() {
  return `
${buildSupabaseHelperCode()}

const ctx = $('Extract Tool Call ID').first().json;

try {
  const params = {
    hotel_id: 'eq.' + HOTEL_ID,
    status: 'neq.cancelled',
    select: 'check_in,check_out,status,room:rooms(room_number,room_type:room_types(name)),guest:guests(name)',
    order: 'check_in',
  };

  if (ctx.check_in && ctx.check_out) {
    params.check_in = 'lt.' + ctx.check_out;
    params.check_out = 'gt.' + ctx.check_in;
  }

  const reservations = await supabaseRequest('reservations', { params });
  const filtered = ctx.room_type
    ? reservations.filter((reservation) => normalizeText(reservation.room?.room_type?.name || '') === normalizeText(ctx.room_type))
    : reservations;

  const bookingLines = filtered.map((reservation) => {
    const guestName = reservation.guest?.name || 'Guest';
    const roomTypeName = reservation.room?.room_type?.name || 'Unknown type';
    const roomNumber = reservation.room?.room_number || 'Unassigned';
    return guestName + ' - ' + roomTypeName + ' / Room ' + roomNumber + ' (' + reservation.check_in + ' to ' + reservation.check_out + ')';
  });

  let result = '';
  if (bookingLines.length === 0) {
    result = ctx.check_in && ctx.check_out
      ? 'No overlapping bookings were found for the requested dates.'
      : 'No bookings found.';
  } else if (ctx.check_in && ctx.check_out) {
    result = 'Bookings overlapping ' + ctx.check_in + ' to ' + ctx.check_out + ': ' + bookingLines.join(' | ') + '.';
  } else {
    result = 'Current bookings (' + bookingLines.length + '): ' + bookingLines.join(' | ') + '.';
  }

  return [{ json: { result } }];
} catch (error) {
  return [{ json: { result: 'Could not read bookings from Supabase: ' + error.message } }];
}
  `.trim()
}

function buildWhatsAppInventoryToolCode() {
  return `
${buildSupabaseHelperCode()}

const args = typeof query === 'object' && query ? query : {};
const requestedType = args.room_type || args.Room_Type || '';

const roomTypes = await getActiveRoomTypes();
const rooms = await getActiveRooms();

const selectedTypes = requestedType
  ? roomTypes.filter((roomType) => normalizeText(roomType.name).includes(normalizeText(requestedType)))
  : roomTypes;

const grouped = selectedTypes.map((roomType) => {
  const matchingRooms = rooms.filter((room) => room.room_type_id === roomType.id);
  return {
    name: roomType.name,
    capacity: roomType.capacity,
    price: roomType.price,
    room_numbers: matchingRooms.map((room) => room.room_number),
    active_room_count: matchingRooms.length,
  };
});

return {
  result: grouped.length > 0
    ? 'Room inventory: ' + grouped.map((entry) => entry.name + ' (' + entry.active_room_count + ' rooms)').join(' | ') + '.'
    : 'No active room inventory found.',
  inventory: grouped,
};
  `.trim()
}

function buildWhatsAppBookedRoomsToolCode() {
  return `
${buildSupabaseHelperCode()}

const args = typeof query === 'object' && query ? query : {};
const checkIn = args.check_in || args.Check_In || '';
const checkOut = args.check_out || args.Check_Out || '';
const roomType = args.room_type || args.Room_Type || '';

const params = {
  hotel_id: 'eq.' + HOTEL_ID,
  status: 'neq.cancelled',
  select: 'check_in,check_out,status,room:rooms(room_number,room_type:room_types(name)),guest:guests(name)',
  order: 'check_in',
};

if (checkIn && checkOut) {
  params.check_in = 'lt.' + checkOut;
  params.check_out = 'gt.' + checkIn;
}

const reservations = await supabaseRequest('reservations', { params });
const filtered = roomType
  ? reservations.filter((reservation) => normalizeText(reservation.room?.room_type?.name || '') === normalizeText(roomType))
  : reservations;

return {
  result: filtered.length > 0
    ? 'Bookings found: ' + filtered.map((reservation) => {
        const guestName = reservation.guest?.name || 'Guest';
        const roomLabel = reservation.room?.room_number || 'Unassigned';
        const typeLabel = reservation.room?.room_type?.name || 'Unknown type';
        return guestName + ' - ' + typeLabel + ' / Room ' + roomLabel + ' (' + reservation.check_in + ' to ' + reservation.check_out + ')';
      }).join(' | ') + '.'
    : 'No overlapping bookings found for the requested criteria.',
  reservations: filtered,
};
  `.trim()
}

function buildWhatsAppBookingToolCode() {
  return `
${buildSupabaseHelperCode()}

const args = typeof query === 'object' && query ? query : {};
const guestName = args.Guest_Name || args.guest_name || args.name || '';
const checkIn = args.Check_In || args.check_in || args.checkIn || '';
const checkOut = args.Check_Out || args.check_out || args.checkOut || '';
const requestedRoomType = args.Room_Type || args.room_type || args.room || '';
const phoneNumber = args.Phone_Number || args.phone_number || args.contact_id || '';
const notes = args.Notes || args.notes || args.email || null;

if (!guestName || !checkIn || !checkOut || !requestedRoomType) {
  return {
    success: false,
    result: 'Missing required fields. Required: Guest_Name, Check_In, Check_Out, Room_Type.',
  };
}

const roomTypes = await getActiveRoomTypes();
const roomType = findMatchingRoomType(roomTypes, requestedRoomType);
if (!roomType) {
  return {
    success: false,
    result: 'Room type not found in the hotel inventory: ' + requestedRoomType,
  };
}

const rooms = (await getActiveRooms()).filter((room) => room.room_type_id === roomType.id);
if (rooms.length === 0) {
  return {
    success: false,
    result: 'No active rooms are configured for room type ' + roomType.name + '.',
  };
}

let guest = null;
if (phoneNumber) {
  const guestsByPhone = await supabaseRequest('guests', {
    params: {
      hotel_id: 'eq.' + HOTEL_ID,
      phone: 'eq.' + phoneNumber,
      select: 'id,name,phone',
      limit: '1',
    },
  });
  guest = guestsByPhone[0] || null;
}

if (!guest) {
  const guestsByName = await supabaseRequest('guests', {
    params: {
      hotel_id: 'eq.' + HOTEL_ID,
      select: 'id,name,phone',
      order: 'created_at.desc',
    },
  });
  guest = guestsByName.find((entry) => normalizeText(entry.name) === normalizeText(guestName)) || null;
}

if (guest) {
  const duplicates = await supabaseRequest('reservations', {
    params: {
      hotel_id: 'eq.' + HOTEL_ID,
      guest_id: 'eq.' + guest.id,
      check_in: 'eq.' + checkIn,
      check_out: 'eq.' + checkOut,
      select: 'id,room:rooms(room_number,room_type:room_types(name))',
    },
  });
  const sameTypeDuplicate = duplicates.find((reservation) => normalizeText(reservation.room?.room_type?.name || '') === normalizeText(roomType.name));
  if (sameTypeDuplicate) {
    return {
      success: true,
      result: 'A booking already exists for ' + guest.name + ' in ' + roomType.name + ' from ' + checkIn + ' to ' + checkOut + '. No new booking was created.',
      duplicate: true,
    };
  }
}

const roomIds = rooms.map((room) => room.id).join(',');
const overlappingReservations = await supabaseRequest('reservations', {
  params: {
    hotel_id: 'eq.' + HOTEL_ID,
    status: 'neq.cancelled',
    room_id: 'in.(' + roomIds + ')',
    check_in: 'lt.' + checkOut,
    check_out: 'gt.' + checkIn,
    select: 'room_id',
  },
});

const bookedRoomIds = new Set(overlappingReservations.map((reservation) => reservation.room_id));
const availableRoom = rooms.find((room) => !bookedRoomIds.has(room.id));

if (!availableRoom) {
  return {
    success: false,
    result: 'No available room of type ' + roomType.name + ' was found for ' + checkIn + ' to ' + checkOut + '.',
  };
}

let guestId = guest?.id || null;
if (!guestId) {
  const createdGuests = await supabaseRequest('guests', {
    method: 'POST',
    body: [{
      hotel_id: HOTEL_ID,
      name: guestName,
      phone: phoneNumber || null,
      notes: notes,
    }],
  });
  guestId = createdGuests[0].id;
}

const createdReservations = await supabaseRequest('reservations', {
  method: 'POST',
  body: [{
    hotel_id: HOTEL_ID,
    room_id: availableRoom.id,
    guest_id: guestId,
    check_in: checkIn,
    check_out: checkOut,
    status: 'confirmed',
    notes: notes,
    source: 'whatsapp',
  }],
});

return {
  success: true,
  duplicate: false,
  reservation_id: createdReservations[0].id,
  room_number: availableRoom.room_number,
  room_type: roomType.name,
  result: 'Booking confirmed for ' + guestName + '. Room type: ' + roomType.name + '. Assigned room: ' + availableRoom.room_number + '. Check-in: ' + checkIn + ', Check-out: ' + checkOut + '.',
};
  `.trim()
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const content = fs.readFileSync(filePath, 'utf8')
  const entries = content
    .split(/\r?\n/)
    .filter((line) => line && !line.trim().startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=')
      return [line.slice(0, index), line.slice(index + 1)]
    })

  return Object.fromEntries(entries)
}

function sanitize(name) {
  return name.replace(/[<>:"/\\\\|?*]+/g, '').replace(/\s+/g, ' ').trim()
}

function assertRequired(name, value) {
  if (!value) throw new Error(`Missing required configuration: ${name}`)
}

main().catch((error) => {
  console.error(error.response?.data || error.message)
  process.exit(1)
})
