import { Reservation } from '@/types';

export async function fetchReservations(): Promise<Reservation[]> {
  const res = await fetch('/api/reservations', { cache: 'no-store' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch reservations');
  }
  return res.json();
}
