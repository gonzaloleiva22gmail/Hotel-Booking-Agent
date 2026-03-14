export interface Reservation {
  id: string;
  guestName: string;
  checkIn: string;  // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  roomNumber: string;
  roomType: string;
}
