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

  const month = req.nextUrl.searchParams.get('month')
  const status = req.nextUrl.searchParams.get('status')
  const supabase = createServiceClient()

  let query = supabase
    .from('reservations')
    .select('*, room:rooms(*, room_type:room_types(*)), guest:guests(*)')
    .eq('hotel_id', hotel.id)
    .order('check_in')

  if (month) {
    const monthStart = `${month}-01`
    const date = new Date(`${month}-01T00:00:00Z`)
    const monthEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
      .toISOString()
      .slice(0, 10)
    query = query.lte('check_in', monthEnd).gt('check_out', monthStart)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
