import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServiceClient } from './supabase'
import { createServerSupabaseClient } from './supabase-server'

export async function getHotelBySlug(slug: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('hotels')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !data) return null
  return data
}

export async function getClinicBySlug(slug: string) {
  return getHotelBySlug(slug)
}

export async function requireHotelAccess(slug: string) {
  const cookieStore = await cookies()
  const hasSupabaseAuthCookie = cookieStore
    .getAll()
    .some(({ name }) => name.startsWith('sb-') && name.includes('-auth-token'))

  if (!hasSupabaseAuthCookie) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const hotel = await getHotelBySlug(slug)
  if (!hotel) {
    return {
      response: notFound('Hotel not found'),
    }
  }

  const serviceSupabase = createServiceClient()
  const { data: membership, error } = await serviceSupabase
    .from('hotel_members')
    .select('role')
    .eq('hotel_id', hotel.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !membership) {
    return {
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return {
    hotel,
    user,
    role: membership.role,
  }
}

export function notFound(message = 'Not found') {
  return NextResponse.json({ error: message }, { status: 404 })
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 })
}
