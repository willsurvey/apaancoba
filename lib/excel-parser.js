import { read, utils } from 'xlsx';

export function parseExcel(buffer) {
  const workbook = read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = utils.sheet_to_json(sheet, { header: 1 });

  const result = {};
  
  for (const row of data) {
    if (row.length >= 2) {
      const key = row[0]?.toString()?.replace(/\*\*/g, '').trim();
      const value = row[1]?.toString()?.replace(/\*\*/g, '').trim() || '';
      const fraksi = row[2]?.toString()?.trim() || '-';
      const keterangan = row[3]?.toString()?.trim() || '';

      if (key && value) {
        result[key] = { value, fraksi, keterangan };
      }
    }
  }

  return result;
}