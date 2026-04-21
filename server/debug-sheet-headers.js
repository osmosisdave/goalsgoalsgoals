#!/usr/bin/env node
// Prints the raw header row from the Google Sheet for debugging
const { google } = require('googleapis');

const SPREADSHEET_ID = '1hzV50jfIzi7vhZNWMmOxAMAIMZISWMD-H21VLrnHc0M';
const SHEET_TAB      = 'Full Fixture API';

async function main() {
  const auth   = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_TAB}'!A1:Z1`,
  });

  const headers = res.data.values[0];
  console.log('Raw headers:');
  headers.forEach((h, i) => console.log(`  [${i}] ${JSON.stringify(h)}`));
}

main().catch(err => { console.error(err.message); process.exit(1); });
