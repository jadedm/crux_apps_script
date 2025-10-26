/**
 * Mock objects for Google Apps Script services used in testing
 */

const TestMocks = {
  /**
   * Mock UrlFetchApp for testing HTTP requests
   */
  createUrlFetchAppMock(responses = []) {
    let callIndex = 0;

    return {
      fetch(url, options) {
        const response = responses[callIndex] || TestMocks.createDefaultResponse();
        callIndex++;
        return response;
      },

      fetchAll(urls, options) {
        return responses.slice(0, urls.length);
      },

      resetCallIndex() {
        callIndex = 0;
      },
    };
  },

  /**
   * Create a mock HTTP response
   */
  createMockResponse(statusCode, content) {
    return {
      getResponseCode() {
        return statusCode;
      },
      getContentText() {
        return typeof content === "string" ? content : JSON.stringify(content);
      },
    };
  },

  /**
   * Create a default successful CrUX API response
   */
  createDefaultResponse() {
    const content = {
      record: {
        key: {
          formFactor: "PHONE",
          url: "https://example.com",
        },
        metrics: {
          largest_contentful_paint: {
            histogram: [
              { density: 0.7 },
              { density: 0.2 },
              { density: 0.1 },
            ],
            percentiles: { p75: 2500 },
          },
          first_input_delay: {
            histogram: [
              { density: 0.8 },
              { density: 0.15 },
              { density: 0.05 },
            ],
            percentiles: { p75: 100 },
          },
          cumulative_layout_shift: {
            histogram: [
              { density: 0.75 },
              { density: 0.2 },
              { density: 0.05 },
            ],
            percentiles: { p75: 0.1 },
          },
          first_contentful_paint: {
            histogram: [
              { density: 0.65 },
              { density: 0.25 },
              { density: 0.1 },
            ],
            percentiles: { p75: 1800 },
          },
        },
      },
    };

    return TestMocks.createMockResponse(200, content);
  },

  /**
   * Mock SpreadsheetApp for testing spreadsheet operations
   */
  createSpreadsheetAppMock(sheetExists = false) {
    const mockSheet = TestMocks.createMockSheet();
    const sheets = sheetExists ? [mockSheet] : [];

    return {
      openById(id) {
        return {
          getSheets() {
            return sheets;
          },
          getSheetByName(name) {
            return sheetExists ? mockSheet : null;
          },
          insertSheet(name) {
            const newSheet = TestMocks.createMockSheet(name);
            sheets.push(newSheet);
            return newSheet;
          },
          setActiveSheet(sheet) {
            return sheet;
          },
        };
      },
    };
  },

  /**
   * Create a mock sheet object
   */
  createMockSheet(name = "cruxData") {
    const data = [];
    let lastRow = 0;

    return {
      getName() {
        return name;
      },
      getLastRow() {
        return lastRow;
      },
      getRange(row, col, numRows, numCols) {
        return {
          setValues(values) {
            values.forEach((rowData, index) => {
              data[row + index - 1] = rowData;
              if (row + index > lastRow) {
                lastRow = row + index;
              }
            });
          },
          getValues() {
            const result = [];
            for (let i = 0; i < numRows; i++) {
              result.push(data[row + i - 1] || []);
            }
            return result;
          },
        };
      },
      getData() {
        return data;
      },
    };
  },

  /**
   * Mock Utilities service
   */
  createUtilitiesMock() {
    return {
      sleep(ms) {
        // In tests, we don't actually sleep
        return;
      },
      formatDate(date, timeZone, format) {
        return "01-01-2024";
      },
    };
  },

  /**
   * Mock Session service
   */
  createSessionMock() {
    return {
      getScriptTimeZone() {
        return "America/Los_Angeles";
      },
    };
  },

  /**
   * Mock Logger service
   */
  createLoggerMock() {
    const logs = [];

    return {
      log(message) {
        logs.push(message);
      },
      getLogs() {
        return logs;
      },
      clear() {
        logs.length = 0;
      },
    };
  },

  /**
   * Setup all mocks in global scope
   */
  setupGlobalMocks(options = {}) {
    const {
      urlFetchResponses = [],
      sheetExists = false,
    } = options;

    global.UrlFetchApp = TestMocks.createUrlFetchAppMock(urlFetchResponses);
    global.SpreadsheetApp = TestMocks.createSpreadsheetAppMock(sheetExists);
    global.Utilities = TestMocks.createUtilitiesMock();
    global.Session = TestMocks.createSessionMock();
    global.Logger = TestMocks.createLoggerMock();
  },

  /**
   * Clean up global mocks
   */
  cleanupGlobalMocks() {
    delete global.UrlFetchApp;
    delete global.SpreadsheetApp;
    delete global.Utilities;
    delete global.Session;
    delete global.Logger;
  },
};
