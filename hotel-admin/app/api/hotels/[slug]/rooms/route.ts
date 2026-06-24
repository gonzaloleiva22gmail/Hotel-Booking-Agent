import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { badRequest, requireHotelAccess } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const access = await requireHotelAccess(slug)
  if ('response' in access) return access.response
  const { hotel } = access

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('rooms')
    .select('*, room_type:room_types(*)')
    .eq('hotel_id', hotel.id)
    .eq('active', true)
    .order('room_number')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const access = await requireHotelAccess(slug)
  if ('response' in access) return access.response
  const { hotel } = access

  const { room_number, room_type_id, floor, notes, active } = await req.json()
  if (!room_number) return badRequest('room_number is required')

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('rooms')
    .insert({
      hotel_id: hotel.id,
      room_number,
      room_type_id: room_type_id || null,
      floor: floor || null,
      notes: notes || null,
      active: active ?? true,
    })
    .select('*, room_type:room_types(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
