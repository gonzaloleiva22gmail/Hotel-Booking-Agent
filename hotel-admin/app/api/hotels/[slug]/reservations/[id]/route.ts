import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { badRequest, notFound, requireHotelAccess } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const ALLOWED_STATUSES = new Set(['pending', 'confirmed', 'cancelled', 'completed'])

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params
  const access = await requireHotelAccess(slug)
  if ('response' in access) return access.response
  const { hotel } = access

  const body = await req.json()
  const updates: Record<string, unknown> = {}

  if ('room_id' in body) {
    updates.room_id = body.room_id || null
  }

  if ('guest_id' in body) {
    updates.guest_id = body.guest_id || null
  }

  if ('notes' in body) {
    updates.notes = body.notes || null
  }

  if ('status' in body) {
    if (!ALLOWED_STATUSES.has(body.status)) {
      return badRequest('Invalid reservation status')
    }
    updates.status = body.status
  }

  if ('check_in' in body) {
    updates.check_in = body.check_in
  }

  if ('check_out' in body) {
    updates.check_out = body.check_out
  }

  if (
    typeof updates.check_in === 'string' &&
    typeof updates.check_out === 'string' &&
    updates.check_in >= updates.check_out
  ) {
    return badRequest('check_out must be after check_in')
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('reservations')
    .update(updates)
    .eq('id', id)
    .eq('hotel_id', hotel.id)
    .select('*, room:rooms(*, room_type:room_types(*)), guest:guests(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return notFound('Reservation not found')
  return NextResponse.json(data)
}
