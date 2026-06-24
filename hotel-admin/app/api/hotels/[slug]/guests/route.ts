import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireHotelAccess } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const access = await requireHotelAccess(slug)
  if ('response' in access) return access.response
  const { hotel } = access

  const search = req.nextUrl.searchParams.get('search')
  const supabase = createServiceClient()
  let query = supabase
    .from('guests')
    .select('*')
    .eq('hotel_id', hotel.id)
    .order('name')

  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
