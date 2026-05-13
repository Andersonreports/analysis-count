const DEFAULT_SHEET_ID = '1seF_CT-elxxs-uadnvIMPQpwfx0do3ihSY7fzNJv_Lw';

function doGet(e) {
  return jsonResponse(buildResponse_(e));
}

function doPost(e) {
  return jsonResponse(buildResponse_(e));
}

function buildResponse_(e) {
  try {
    const params = (e && e.parameter) || {};
    const payload = parseBody_(e);
    const action = payload.action || params.action || 'data';

    if (action === 'updateCounts') {
      return updateCounts_(payload);
    }

    return {
      success: true,
      data: exportWorkbook_(payload.sheetId || params.sheetId || DEFAULT_SHEET_ID)
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || String(error)
    };
  }
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }
  return JSON.parse(e.postData.contents);
}

function updateCounts_(payload) {
  const sheetId = payload.sheetId || DEFAULT_SHEET_ID;
  const year = String(payload.year || '');
  const monthIndex = Number(payload.monthIndex);
  const updates = Array.isArray(payload.updates) ? payload.updates : [];

  if (!/^\d{4}$/.test(year)) {
    throw new Error('A valid year is required.');
  }
  if (Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    throw new Error('A valid month index is required.');
  }
  if (!updates.length) {
    throw new Error('At least one update is required.');
  }

  const spreadsheet = SpreadsheetApp.openById(sheetId);
  const sheet = spreadsheet.getSheetByName(year);
  if (!sheet) {
    throw new Error(`Sheet not found for year ${year}.`);
  }

  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length < 2) {
    throw new Error(`No data found in sheet ${year}.`);
  }

  const monthColumn = monthIndex + 2;
  const lookup = {};
  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const testName = normalizeTest_(values[rowIndex][1]);
    if (testName) {
      lookup[testName] = rowIndex + 1;
    }
  }

  updates.forEach(function (item) {
    const testName = normalizeTest_(item.test);
    const rowNumber = lookup[testName];
    const count = Number(item.count);

    if (!rowNumber) {
      throw new Error(`Test name not found in ${year}: ${item.test}`);
    }
    if (Number.isNaN(count) || count < 0) {
      throw new Error(`Invalid count for ${item.test}`);
    }

    sheet.getRange(rowNumber, monthColumn + 1).setValue(count);
  });

  SpreadsheetApp.flush();

  return {
    success: true,
    message: `Updated ${updates.length} entries in ${year}.`,
    data: exportWorkbook_(sheetId)
  };
}

function exportWorkbook_(sheetId) {
  const spreadsheet = SpreadsheetApp.openById(sheetId);
  const data = {};

  spreadsheet.getSheets().forEach(function (sheet) {
    const values = sheet.getDataRange().getValues();
    if (!values.length) {
      data[sheet.getName()] = [];
      return;
    }

    const headers = values[0].map(function (header, index) {
      return header !== '' ? String(header) : `Unnamed: ${index}`;
    });

    data[sheet.getName()] = values.map(function (row) {
      const record = {};
      headers.forEach(function (header, index) {
        const cell = row[index];
        record[header] = cell === '' ? null : cell;
      });
      return record;
    });
  });

  return data;
}

function normalizeTest_(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
