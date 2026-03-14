import os
import json
import pandas as pd
from google.oauth2 import service_account
from googleapiclient.discovery import build
import re

# Constants
SPREADSHEET_ID = '1jsarmmM7gbYe3ZJ__RuooWBd1zhegdcKG2F2P5CrPEc'
RANGE_NAME = 'RESERVA 2026'
CREDENTIALS_FILE = 'groovy-datum-284702-25d0f11508f8.json'
OUTPUT_FILE = 'airtable_ready_export.csv'

# Spanish month mapping
MONTH_MAP = {
    'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04',
    'may': '05', 'jun': '06', 'jul': '07', 'ago': '08',
    'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12'
}

def parse_spanish_date(date_str):
    """Converts 'DD/mon' (e.g., '01/ene') to '2026-MM-DD'."""
    try:
        match = re.search(r'(\d{1,2})/(\w{3})', date_str.lower())
        if match:
            day = match.group(1).zfill(2)
            month_abbr = match.group(2)
            month = MONTH_MAP.get(month_abbr)
            if month:
                return f"2026-{month}-{day}"
    except Exception:
        pass
    return None

def main():
    # Authentication
    if not os.path.exists(CREDENTIALS_FILE):
        print(f"Error: {CREDENTIALS_FILE} not found.")
        return

    scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly']
    creds = service_account.Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=scopes)
    service = build('sheets', 'v4', credentials=creds)

    # Fetch data including grid data for notes
    print("Fetching spreadsheet data (including grid data for notes)...")
    request = service.spreadsheets().get(
        spreadsheetId=SPREADSHEET_ID,
        ranges=[RANGE_NAME],
        includeGridData=True
    )
    spreadsheet = request.execute()
    
    sheet = spreadsheet['sheets'][0]
    data = sheet['data'][0]
    row_data = data.get('rowData', [])

    if not row_data:
        print("No data found in the specified range.")
        return

    # Extract dates from Row 4 (index 3)
    # Assuming Column C starts at index 2
    dates_row = row_data[3].get('values', [])
    extracted_dates = {} # index: formatted_date
    for col_idx in range(2, len(dates_row)):
        cell = dates_row[col_idx]
        val = cell.get('formattedValue', '')
        if val:
            formatted_date = parse_spanish_date(val)
            if formatted_date:
                extracted_dates[col_idx] = formatted_date

    results = []

    last_room_number = ''
    last_room_type = ''

    # Iterate through rows starting at Row 5 (index 4)
    for row_idx in range(4, len(row_data)):
        row = row_data[row_idx]
        cells = row.get('values', [])
        if not cells:
            continue

        # Column A (index 0): Room Number
        current_room_number = cells[0].get('formattedValue', '').strip() if len(cells) > 0 else ''
        if current_room_number:
            last_room_number = current_room_number
            
        # Column B (index 1): Room Type
        current_room_type = cells[1].get('formattedValue', '').strip() if len(cells) > 1 else ''
        if current_room_type:
            last_room_type = current_room_type

        # Iterate through date columns and group stays
        current_stay = None
        
        # Sort column indices to process dates in order
        sorted_col_indices = sorted(extracted_dates.keys())
        
        for col_idx in sorted_col_indices:
            date_val = extracted_dates[col_idx]
            
            if col_idx >= len(cells):
                # End current stay if table ends abruptly
                if current_stay:
                    # Check-Out is the day after the last day of stay
                    next_day = pd.to_datetime(current_stay['last_date']) + pd.Timedelta(days=1)
                    results.append({
                        'Room Number': current_stay['Room Number'],
                        'Room Type': current_stay['Room Type'],
                        'Check_In': current_stay['Check_In'],
                        'Check_Out': next_day.strftime('%Y-%m-%d'),
                        'Guest Name': current_stay['Guest Name'],
                        'Cell Notes': current_stay['Cell Notes']
                    })
                    current_stay = None
                continue
            
            cell = cells[col_idx]
            guest_name = cell.get('formattedValue', '').strip()
            note = cell.get('note', '').strip()

            if guest_name:
                if current_stay and current_stay['Guest Name'] == guest_name:
                    # Continue stay
                    current_stay['last_date'] = date_val
                else:
                    # Close previous stay if exists
                    if current_stay:
                        next_day = pd.to_datetime(current_stay['last_date']) + pd.Timedelta(days=1)
                        results.append({
                            'Room Number': current_stay['Room Number'],
                            'Room Type': current_stay['Room Type'],
                            'Check_In': current_stay['Check_In'],
                            'Check_Out': next_day.strftime('%Y-%m-%d'),
                            'Guest Name': current_stay['Guest Name'],
                            'Cell Notes': current_stay['Cell Notes']
                        })
                    
                    # Start new stay
                    current_stay = {
                        'Room Number': last_room_number,
                        'Room Type': last_room_type,
                        'Check_In': date_val,
                        'last_date': date_val,
                        'Guest Name': guest_name,
                        'Cell Notes': note # Capture notes from the first day
                    }
            else:
                # Empty cell, close current stay if any
                if current_stay:
                    next_day = pd.to_datetime(current_stay['last_date']) + pd.Timedelta(days=1)
                    results.append({
                        'Room Number': current_stay['Room Number'],
                        'Room Type': current_stay['Room Type'],
                        'Check_In': current_stay['Check_In'],
                        'Check_Out': next_day.strftime('%Y-%m-%d'),
                        'Guest Name': current_stay['Guest Name'],
                        'Cell Notes': current_stay['Cell Notes']
                    })
                    current_stay = None
        
        # End of row: Close any remaining stay
        if current_stay:
            next_day = pd.to_datetime(current_stay['last_date']) + pd.Timedelta(days=1)
            results.append({
                'Room Number': current_stay['Room Number'],
                'Room Type': current_stay['Room Type'],
                'Check_In': current_stay['Check_In'],
                'Check_Out': next_day.strftime('%Y-%m-%d'),
                'Guest Name': current_stay['Guest Name'],
                'Cell Notes': current_stay['Cell Notes']
            })

    # Create DataFrame
    df = pd.DataFrame(results)

    if df.empty:
        print("Extraction complete. No guest data found.")
        return

    # Filter for valid rooms
    valid_rooms = [f'H{i}' for i in range(1, 17)] + ['B8', 'B9', 'C13', 'C14', 'C15', 'CNiños', 'Eventos', 'Salon']
    
    # Ensure Room Number is treated as string and strip whitespace
    df['Room Number'] = df['Room Number'].astype(str).str.strip()
    
    # Filter only valid rooms
    df = df[df['Room Number'].isin(valid_rooms)]

    # Export to CSV
    df.to_csv(OUTPUT_FILE, index=False)
    print(f"Successfully exported {len(df)} records to {OUTPUT_FILE}")

if __name__ == '__main__':
    main()
