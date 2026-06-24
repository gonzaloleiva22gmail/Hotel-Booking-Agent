import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireHotelAccess } from '@/lib/api-helpers'

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
  return NextResponse.json(hotel)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const access = await requireHotelAccess(slug)
  if ('response' in access) return access.response
  const { hotel } = access

  const { name, phone, address, timezone } = await req.json()
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('hotels')
    .update({ name, phone, address, timezone })
    .eq('id', hotel.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
