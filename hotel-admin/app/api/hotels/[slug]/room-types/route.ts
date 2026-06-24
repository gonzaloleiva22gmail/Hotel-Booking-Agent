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
    .from('room_types')
    .select('*')
    .eq('hotel_id', hotel.id)
    .eq('active', true)
    .order('name')

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

  const { name, description, price, capacity, active } = await req.json()
  if (!name) return badRequest('name is required')

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('room_types')
    .insert({
      hotel_id: hotel.id,
      name,
      description: description ?? null,
      price: price ?? null,
      capacity: capacity ?? null,
      active: active ?? true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
