import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { notFound, requireHotelAccess } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params
  const access = await requireHotelAccess(slug)
  if ('response' in access) return access.response
  const { hotel } = access

  const body = await req.json()
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('room_types')
    .update(body)
    .eq('id', id)
    .eq('hotel_id', hotel.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return notFound('Room type not found')
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params
  const access = await requireHotelAccess(slug)
  if ('response' in access) return access.response
  const { hotel } = access

  const supabase = createServiceClient()
  await supabase.from('room_types').update({ active: false }).eq('id', id).eq('hotel_id', hotel.id)
  return NextResponse.json({ ok: true })
}
