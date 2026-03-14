import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const BASE_ID = 'appe9ophN5EpDuPHZ';
const TABLE_NAME = 'Reservations';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ error: 'AIRTABLE_API_KEY environment variable is not set' });
  }

  try {
    const allRecords: any[] = [];
    let offset: string | undefined;

    // Handle Airtable pagination (max 100 records per request)
    do {
      const params: Record<string, string> = {};
      if (offset) params.offset = offset;

      const response = await axios.get(
        `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`,
        {
          headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
          params,
          timeout: 10000,
        }
      );

      allRecords.push(...response.data.records);
      offset = response.data.offset;
    } while (offset);

    // Normalize field names — handles both CamelCase and Snake_Case variants
    const reservations = allRecords
      .map((rec: any) => {
        const f = rec.fields;
        return {
          id: rec.id,
          guestName:  f.GuestName   || f.Guest_Name   || 'Unknown Guest',
          checkIn:    f.CheckIn     || f.Check_In     || '',
          checkOut:   f.CheckOut    || f.Check_Out    || '',
          roomNumber: String(f.RoomNumber || f.Room_Number || f.Room_Num || '').trim(),
          roomType:   f.RoomType    || f.Room_Type    || '',
        };
      })
      .filter(r => r.checkIn && r.checkOut && r.roomNumber);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(reservations);
  } catch (error: any) {
    const msg = error.response?.data?.error?.message || error.message || 'Unknown error';
    console.error('Airtable fetch error:', msg);
    return res.status(500).json({ error: `Airtable error: ${msg}` });
  }
}
