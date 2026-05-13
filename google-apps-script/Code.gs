const DEFAULT_SHEET_ID = '1seF_CT-elxxs-uadnvIMPQpwfx0do3ihSY7fzNJv_Lw';
const MONTH_COLUMN_OFFSET = 3;
const TOTAL_COLUMN_INDEX = 15;
const TEST_NAME_COLUMN_INDEX = 2;

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'data';
    const sheetId = (e && e.parameter && e.parameter.sheetId) || DEFAULT_SHEET_ID;

    if (action !== 'data') {
      return jsonOutput_({ success: false, message: 'Unsupported GET action.' });
    }

    return jsonOutput_(serializeSpreadsheet_(sheetId));
  } catch (error) {
    return jsonOutput_({
      success: false,
      message: error.message || 'Unable to load spreadsheet data.'
    });
  }
}

function doPost(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'updateCounts';
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    if (action !== 'updateCounts') {
      throw new Error('Unsupported POST action.');
    }

    const sheetId = payload.sheetId || DEFAULT_SHEET_ID;
    updateCounts_(sheetId, payload);

    return jsonOutput_({
      success: true,
      data: serializeSpreadsheet_(sheetId)
    });
  } catch (error) {
    return jsonOutput_({
      success: false,
      message: error.message || 'Unable to save changes.'
    });
  }
}

function updateCounts_(sheetId, payload) {
  const year = String(payload.year || '').trim();
  const monthIndex = Number(payload.monthIndex);
  const updates = Array.isArray(payload.updates) ? payload.updates : [];

  if (!year) {
    throw new Error('Year is required.');
  }
  if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    throw new Error('Month index is invalid.');
  }
  if (!updates.length) {
    throw new Error('No count changes were provided.');
  }

  const spreadsheet = SpreadsheetApp.openById(sheetId);
  const sheet = spreadsheet.getSheetByName(year);
  if (!sheet) {
    throw new Error('The selected year sheet was not found.');
  }

  const data = sheet.getDataRange().getValues();
  const rowLookup = buildTestRowLookup_(data);
  const targetColumn = MONTH_COLUMN_OFFSET + monthIndex;
  const touchedRows = [];

  updates.forEach((entry) => {
    const testName = normalizeLabel_(entry.test);
    const nextCount = Number(entry.count);

    if (!testName) {
      return;
    }
    if (!Number.isFinite(nextCount) || nextCount < 0) {
      throw new Error('Counts must be zero or greater.');
    }

    const rowNumber = rowLookup[testName];
    if (!rowNumber) {
      throw new Error('Test not found in sheet: ' + entry.test);
    }

    sheet.getRange(rowNumber, targetColumn).setValue(nextCount);
    touchedRows.push(rowNumber);
  });

  recalculateTotals_(sheet, data, touchedRows, targetColumn);
  updateTotalCountSheet_(spreadsheet, year, sheet);
}

function buildTestRowLookup_(data) {
  const lookup = {};

  for (let rowIndex = 1; rowIndex < data.length; rowIndex += 1) {
    const rawLabel = data[rowIndex][TEST_NAME_COLUMN_INDEX - 1];
    const label = normalizeLabel_(rawLabel);

    if (!label || label === 'TEST NAME') {
      continue;
    }
    if (label === 'TOTAL') {
      break;
    }

    lookup[label] = rowIndex + 1;
  }

  return lookup;
}

function recalculateTotals_(sheet, originalData, touchedRows, targetColumn) {
  const totalRowNumber = findTotalRowNumber_(originalData);
  const uniqueRows = Array.from(new Set(touchedRows));

  uniqueRows.forEach((rowNumber) => {
    const monthlyValues = sheet.getRange(rowNumber, MONTH_COLUMN_OFFSET, 1, 12).getValues()[0];
    const rowTotal = monthlyValues.reduce((sum, value) => sum + toNumber_(value), 0);
    sheet.getRange(rowNumber, TOTAL_COLUMN_INDEX).setValue(rowTotal);
  });

  if (!totalRowNumber) {
    return;
  }

  const firstDataRow = 3;
  const testRowCount = Math.max(totalRowNumber - firstDataRow, 0);
  if (testRowCount > 0) {
    const monthValues = sheet.getRange(firstDataRow, targetColumn, testRowCount, 1).getValues();
    const monthTotal = monthValues.reduce((sum, row) => sum + toNumber_(row[0]), 0);
    sheet.getRange(totalRowNumber, targetColumn).setValue(monthTotal);

    const totalRowValues = [];
    for (let month = 0; month < 12; month += 1) {
      const monthColumn = MONTH_COLUMN_OFFSET + month;
      const values = sheet.getRange(firstDataRow, monthColumn, testRowCount, 1).getValues();
      totalRowValues.push(values.reduce((sum, row) => sum + toNumber_(row[0]), 0));
    }
    sheet.getRange(totalRowNumber, MONTH_COLUMN_OFFSET, 1, 12).setValues([totalRowValues]);
    sheet.getRange(totalRowNumber, TOTAL_COLUMN_INDEX).setValue(
      totalRowValues.reduce((sum, value) => sum + toNumber_(value), 0)
    );
  }
}

function findTotalRowNumber_(data) {
  for (let rowIndex = 1; rowIndex < data.length; rowIndex += 1) {
    if (normalizeLabel_(data[rowIndex][TEST_NAME_COLUMN_INDEX - 1]) === 'TOTAL') {
      return rowIndex + 1;
    }
  }
  return 0;
}

function updateTotalCountSheet_(spreadsheet, year, yearSheet) {
  const totalSheet = spreadsheet.getSheetByName('TOTAL COUNT');
  if (!totalSheet) {
    return;
  }

  const totalYearCount = calculateYearTotal_(yearSheet);
  const totalData = totalSheet.getDataRange().getValues();
  const yearRowIndex = totalData.findIndex((row) => normalizeLabel_(row[0]) === 'YEAR');
  const countRowIndex = totalData.findIndex((row) => normalizeLabel_(row[0]) === 'COUNT');

  if (yearRowIndex === -1 || countRowIndex === -1) {
    return;
  }

  const yearRow = totalData[yearRowIndex];
  for (let columnIndex = 1; columnIndex < yearRow.length; columnIndex += 1) {
    if (String(yearRow[columnIndex]).trim() === year) {
      totalSheet.getRange(countRowIndex + 1, columnIndex + 1).setValue(totalYearCount);
      return;
    }
  }
}

function calculateYearTotal_(sheet) {
  const data = sheet.getDataRange().getValues();
  const totalRowNumber = findTotalRowNumber_(data);

  if (totalRowNumber) {
    return toNumber_(sheet.getRange(totalRowNumber, TOTAL_COLUMN_INDEX).getValue());
  }

  const rowLookup = buildTestRowLookup_(data);
  return Object.keys(rowLookup).reduce((sum, key) => {
    const rowNumber = rowLookup[key];
    const monthlyValues = sheet.getRange(rowNumber, MONTH_COLUMN_OFFSET, 1, 12).getValues()[0];
    return sum + monthlyValues.reduce((rowSum, value) => rowSum + toNumber_(value), 0);
  }, 0);
}

function serializeSpreadsheet_(sheetId) {
  const spreadsheet = SpreadsheetApp.openById(sheetId);
  const result = {};

  spreadsheet.getSheets().forEach((sheet) => {
    const values = sheet.getDataRange().getValues();
    if (!values.length) {
      result[sheet.getName()] = [];
      return;
    }

    const headers = values[0].map((header, index) => {
      const normalized = String(header || '').trim();
      return normalized || 'Unnamed: ' + index;
    });

    result[sheet.getName()] = values.slice(1).map((row) => {
      const record = {};
      headers.forEach((header, index) => {
        const value = index < row.length ? row[index] : '';
        record[header] = value === '' ? null : value;
      });
      return record;
    });
  });

  return result;
}

function normalizeLabel_(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function toNumber_(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function jsonOutput_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
