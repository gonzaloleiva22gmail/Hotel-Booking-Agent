export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'

export interface Hotel {
  id: string
  slug: string
  name: string
  phone: string | null
  address: string | null
  timezone: string
  created_at: string
}

export interface RoomType {
  id: string
  hotel_id: string
  name: string
  description: string | null
  price: number | null
  capacity: number | null
  active: boolean
}

export interface Room {
  id: string
  hotel_id: string
  room_type_id: string | null
  room_number: string
  floor: string | null
  notes: string | null
  active: boolean
  room_type?: RoomType | null
}

export interface Guest {
  id: string
  hotel_id: string
  name: string
  phone: string | null
  notes: string | null
  created_at: string
}

export interface Reservation {
  id: string
  hotel_id: string
  room_id: string | null
  guest_id: string | null
  check_in: string
  check_out: string
  status: ReservationStatus
  notes: string | null
  source: string | null
  created_at: string
  room?: Room | null
  guest?: Guest | null
}
