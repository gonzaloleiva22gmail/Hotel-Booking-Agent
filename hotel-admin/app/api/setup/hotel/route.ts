import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const SLUG_PATTERN = /^[a-z0-9-]+$/

export async function POST(req: NextRequest) {
  const {
    hotel_name,
    slug,
    phone,
    address,
    timezone = 'America/Lima',
    admin_email,
    admin_password,
  } = await req.json()

  if (!hotel_name || !slug || !admin_email || !admin_password) {
    return NextResponse.json(
      { error: 'hotel_name, slug, admin_email, and admin_password are required' },
      { status: 400 }
    )
  }

  if (!SLUG_PATTERN.test(slug)) {
    return NextResponse.json(
      { error: 'Slug must be lowercase letters, numbers, and hyphens only' },
      { status: 400 }
    )
  }

  if (admin_password.length < 8) {
    return NextResponse.json(
      { error: 'admin_password must be at least 8 characters' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('hotels')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Slug already taken' }, { status: 409 })
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: admin_email,
    password: admin_password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? 'Failed to create user' }, { status: 400 })
  }

  const userId = authData.user.id

  const { data: hotel, error: hotelError } = await supabase
    .from('hotels')
    .insert({
      slug,
      name: hotel_name,
      phone: phone || null,
      address: address || null,
      timezone,
    })
    .select()
    .single()

  if (hotelError) {
    await supabase.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: hotelError.message }, { status: 500 })
  }

  const { error: memberError } = await supabase
    .from('hotel_members')
    .insert({ hotel_id: hotel.id, user_id: userId, role: 'admin' })

  if (memberError) {
    await supabase.auth.admin.deleteUser(userId)
    await supabase.from('hotels').delete().eq('id', hotel.id)
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, slug, hotel_id: hotel.id }, { status: 201 })
}
