const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '../src/assets/data/CS-Schedule-2025-2026.csv');
const JSON_PATH = path.join(__dirname, '../src/assets/data/2526-AcademicCalendar.json');

// Helper to left-pad numbers to 2 digits
const pad2 = (n) => String(n).padStart(2, '0');

const monthIndex = {
  'January': 1,
  'February': 2,
  'March': 3,
  'April': 4,
  'May': 5,
  'June': 6,
  'July': 7,
  'August': 8,
  'September': 9,
  'October': 10,
  'November': 11,
  'December': 12,
};

const dowMap = new Map(); // key: ISO like YYYY-MM-DDT00:00:00.000 -> 'Mon' etc.

function buildDowMapFromCsv() {
  const csv = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = csv.split(/\r?\n/).filter(Boolean);
  // Expect header: Unnamed: 0,Month,Day,Date,...
  const header = lines[0].split(',');
  const monthCol = header.indexOf('Month');
  const dayCol = header.indexOf('Day');
  const dateCol = header.indexOf('Date');

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    // Extract first 4 columns safely by splitting and then rejoining extras
    const parts = raw.split(',');
    if (parts.length < 4) continue;

    const month = parts[monthCol]?.trim();
    const dow = parts[dayCol]?.trim();
    const dayOfMonthStr = parts[dateCol]?.trim();

    if (!month || !dow || !dayOfMonthStr) continue;
    const dayNum = parseInt(dayOfMonthStr, 10);
    if (!Number.isFinite(dayNum)) continue;

    const mm = monthIndex[month];
    if (!mm) continue;

    // Year: Aug-Dec -> 2025, Jan-Jun -> 2026 (for 2025-2026 school year)
    const year = (mm >= 8) ? 2025 : 2026;

    const iso = `${year}-${pad2(mm)}-${pad2(dayNum)}T00:00:00.000`;
    // Normalize DOW to 3-letter with capital first letter
    const norm = dow.slice(0,3);
    dowMap.set(iso, norm);
  }
}

function computeDowFromIso(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    return names[d.getUTCDay()];
  } catch {
    return null;
  }
}

function updateJson() {
  const text = fs.readFileSync(JSON_PATH, 'utf8');
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error('Failed to parse JSON at', JSON_PATH, e);
    process.exit(1);
  }

  if (!Array.isArray(data)) {
    console.error('Unexpected JSON structure: expected top-level array');
    process.exit(1);
  }

  // Skip first two metadata objects if they contain Day Types/Day Colors
  for (let i = 0; i < data.length; i++) {
    const entry = data[i];
    if (entry && typeof entry === 'object' && 'Date' in entry) {
      const iso = entry['Date'];
      const fromCsv = dowMap.get(iso);
      const computed = fromCsv || computeDowFromIso(iso);
      if (computed) {
        entry['Day'] = computed;
      }
    }
  }

  const out = JSON.stringify(data, null, '\t');
  fs.writeFileSync(JSON_PATH, out, 'utf8');
}

(function main(){
  buildDowMapFromCsv();
  updateJson();
  console.log('Updated day-of-week for 2526-AcademicCalendar.json');
})();
