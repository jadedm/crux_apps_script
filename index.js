/**
 * Global variable to prevent duplicate execution within the same Apps Script run.
 * This is a workaround for a known Apps Script timing bug where triggers sometimes fire twice.
 */
let executionFlag = false;

/**
 * CruxExtractor - Extracts Chrome User Experience Report (CrUX) data and writes to Google Sheets.
 *
 * Fetches Core Web Vitals metrics (LCP, FID, CLS, FCP) from the Chrome UX Report API
 * for specified URLs and form factors, then appends the data to a Google Sheets spreadsheet.
 */
class CruxExtractor {
  /**
   * Configuration constants for the CruxExtractor.
   * @type {Object}
   * @property {number} SLEEP_DURATION_MS - Delay in milliseconds between API calls to avoid rate limits
   * @property {number} HTTP_STATUS_OK - Expected HTTP status code for successful responses
   * @property {number} COLUMN_COUNT - Number of columns in the spreadsheet output
   * @property {number} HEADER_ROW - Row number where headers are placed
   * @property {number} HEADER_START_COL - Column number where headers start
   */
  static CONFIG = {
    SLEEP_DURATION_MS: 400,
    HTTP_STATUS_OK: 200,
    COLUMN_COUNT: 19,
    HEADER_ROW: 1,
    HEADER_START_COL: 1,
    HISTORY_SHEET_NAME: "executionHistory",
    HISTORY_COLUMN_COUNT: 8,
  };

  /**
   * Creates a new CruxExtractor instance.
   *
   * @param {Object} config - Configuration object
   * @param {string[]} config.urls - Array of URLs to fetch CrUX data for
   * @param {string} config.spreadsheetId - Google Sheets spreadsheet ID
   * @param {string} config.apiKey - Google API key with Chrome UX Report API access
   * @param {string[]} [config.formFactor=["PHONE", "DESKTOP", "ALL_FORM_FACTORS"]] - Form factors to query
   * @param {string} [config.cruxUrl] - Base URL for CrUX API endpoint
   * @param {string} [config.sheetTabName="cruxData"] - Name of the sheet tab to write data to
   * @throws {Error} If any required parameter is missing or empty
   */
  constructor({
    urls = [],
    spreadsheetId = "",
    apiKey = "",
    formFactor = ["PHONE", "DESKTOP", "ALL_FORM_FACTORS"],
    cruxUrl = "https://chromeuxreport.googleapis.com/v1/records:queryRecord?alt=json&key=",
    sheetTabName = "cruxData",
  }) {
    if (!Array.isArray(urls) || urls.length === 0) {
      throw new Error("Crux Extractor: 'urls' must be a non-empty array");
    }

    if (!urls.every((url) => typeof url === "string" && url.trim())) {
      throw new Error("Crux Extractor: All URLs must be non-empty strings");
    }

    if (typeof spreadsheetId !== "string" || !spreadsheetId.trim()) {
      throw new Error(
        "Crux Extractor: 'spreadsheetId' must be a non-empty string"
      );
    }

    if (typeof apiKey !== "string" || !apiKey.trim()) {
      throw new Error("Crux Extractor: 'apiKey' must be a non-empty string");
    }

    if (!Array.isArray(formFactor) || formFactor.length === 0) {
      throw new Error("Crux Extractor: 'formFactor' must be a non-empty array");
    }

    if (
      !formFactor.every((factor) => typeof factor === "string" && factor.trim())
    ) {
      throw new Error(
        "Crux Extractor: All form factors must be non-empty strings"
      );
    }

    this.urls = urls.map((url) => url.trim());
    this.spreadsheetId = spreadsheetId.trim();
    this.apiKey = apiKey.trim();
    this.formFactor = formFactor.map((factor) => factor.trim());
    this.cruxUrl = cruxUrl + this.apiKey;
    this.sheetTabName = sheetTabName;
  }

  /**
   * Validates if a string is a valid HTTP or HTTPS URL.
   *
   * @param {string} urlString - The URL string to validate
   * @returns {boolean} True if the URL is valid and uses HTTP/HTTPS protocol, false otherwise
   */
  isValidUrl(urlString) {
    if (typeof urlString !== "string" || !urlString) {
      return false;
    }

    try {
      const url = new URL(urlString);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (error) {
      Logger.log(`Invalid URL format: ${urlString} - ${error.message}`);
      return false;
    }
  }

  /**
   * Builds an array of request payloads for the CrUX API.
   *
   * Creates one request for each combination of URL and form factor.
   * Invalid URLs and form factors are logged and skipped.
   *
   * @async
   * @returns {Promise<Object[]>} Array of request objects for UrlFetchApp.fetch()
   * @throws {Error} If building request payloads fails or no valid requests created
   */
  async buildRequestUrls() {
    try {
      this.requests = [];

      const validFormFactors = ["PHONE", "DESKTOP", "ALL_FORM_FACTORS"];

      for (const currentUrl of this.urls) {
        if (!this.isValidUrl(currentUrl)) {
          Logger.log(`Crux Extractor:: Invalid URL skipped: ${currentUrl}`);
          continue;
        }

        for (const factor of this.formFactor) {
          if (!validFormFactors.includes(factor)) {
            Logger.log(
              `Crux Extractor:: Invalid form factor skipped: ${factor}`
            );
            continue;
          }

          this.requests.push({
            method: "post",
            muteHttpExceptions: true,
            contentType: "application/json",
            payload: JSON.stringify({
              url: currentUrl,
              formFactor: factor,
            }),
          });
        }
      }

      if (this.requests.length === 0) {
        throw new Error("No valid URL/form factor combinations to process");
      }

      Logger.log(
        `Crux Extractor:: Built ${this.requests.length} request payloads`
      );
      return this.requests;
    } catch (error) {
      Logger.log("Crux Extractor:: Error occurred: buildRequestUrls");
      throw error;
    }
  }

  /**
   * Fetches CrUX data from the Chrome UX Report API sequentially.
   *
   * Makes API calls one at a time with a configurable delay between requests
   * to avoid rate limiting. Non-200 responses and JSON parse errors are logged and skipped.
   * Tracks detailed execution history for each request.
   *
   * @async
   * @returns {Promise<Object[]>} Array of successful API response objects
   * @throws {Error} If no requests exist or fetching data fails
   */
  async fetchData() {
    try {
      if (!this.requests || this.requests.length === 0) {
        throw new Error("No requests to fetch. Call buildRequestUrls() first.");
      }

      this.filteredResponse = [];
      this.executionRecords = [];
      const requestsLength = this.requests.length;

      for (let reqIndex = 0; reqIndex < requestsLength; reqIndex++) {
        Logger.log(
          `Crux Extractor:: Making API call ${
            reqIndex + 1
          } of ${requestsLength}`
        );
        Logger.log(`Payload: ${this.requests[reqIndex].payload}`);

        const payload = JSON.parse(this.requests[reqIndex].payload);
        const url = payload.url;
        const formFactor = payload.formFactor;

        let statusCode;
        let errorMessage = "-";
        let status = "FAILED";

        try {
          const response = UrlFetchApp.fetch(
            this.cruxUrl,
            this.requests[reqIndex]
          );

          statusCode = response.getResponseCode();
          Logger.log(`Crux Extractor:: Received status code: ${statusCode}`);

          if (statusCode !== CruxExtractor.CONFIG.HTTP_STATUS_OK) {
            errorMessage = `Non-200 response: ${response.getContentText()}`;
            Logger.log(`Non-200 response for request ${reqIndex + 1}`);
            Logger.log(`Payload: ${this.requests[reqIndex].payload}`);
            Logger.log(`Status: ${statusCode}`);
            Logger.log(`Response: ${response.getContentText()}`);
          } else {
            try {
              const responseContent = JSON.parse(response.getContentText());
              this.filteredResponse.push(responseContent);
              status = "SUCCESS";
              errorMessage = "-";
              Logger.log(`Successfully parsed response ${reqIndex + 1}`);
            } catch (parseError) {
              errorMessage = `JSON parse error: ${parseError.message}`;
              Logger.log(`Failed to parse JSON for request ${reqIndex + 1}`);
              Logger.log(`Error: ${parseError.message}`);
              Logger.log(`Response text: ${response.getContentText()}`);
            }
          }
        } catch (fetchError) {
          statusCode = "-";
          errorMessage = `Fetch error: ${fetchError.message}`;
          Logger.log(`Failed to fetch request ${reqIndex + 1}`);
          Logger.log(`Error: ${fetchError.message}`);
        }

        this.executionRecords.push({
          url,
          formFactor,
          status,
          responseCode: statusCode,
          errorMessage,
          normalized: "NO",
        });

        if (reqIndex < requestsLength - 1) {
          Utilities.sleep(CruxExtractor.CONFIG.SLEEP_DURATION_MS);
          Logger.log(
            `Sleeping ${CruxExtractor.CONFIG.SLEEP_DURATION_MS}ms before next request`
          );
        }
      }

      Logger.log(
        `Crux Extractor:: Successfully fetched ${this.filteredResponse.length} responses`
      );
      return this.filteredResponse;
    } catch (error) {
      Logger.log("Crux Extractor:: Error occurred: fetchData");
      throw error;
    }
  }

  /**
   * Normalizes CrUX API responses into flat arrays for spreadsheet insertion.
   *
   * Extracts Core Web Vitals metrics (LCP, FID, CLS, FCP) from API response objects
   * and formats them as arrays with timestamps. Missing metrics default to "-".
   * Updates execution records to mark successfully normalized responses.
   *
   * @async
   * @returns {Promise<Array[]>} Array of arrays, each containing 19 columns of data:
   *   [Date, Platform, URL, LCP metrics (4), FID metrics (4), CLS metrics (4), FCP metrics (4)]
   * @throws {Error} If no data to normalize or all responses fail normalization
   */
  async normalizeData() {
    try {
      if (!this.filteredResponse || this.filteredResponse.length === 0) {
        throw new Error("No responses to normalize. Call fetchData() first.");
      }

      this.normalizedResponse = [];

      const timeZone = Session.getScriptTimeZone();
      const timeStamp = Utilities.formatDate(
        new Date(),
        timeZone,
        "dd-MM-yyyy"
      );

      for (const response of this.filteredResponse) {
        try {
          if (!response?.record?.key || !response?.record?.metrics) {
            Logger.log("Skipping response with invalid structure");
            continue;
          }

          Logger.log("Crux Extractor:: Extracting values from response");

          const { key, metrics } = response.record;
          const formFactor = key.formFactor || "AGGREGATED";
          const url = key.url;

          const extractMetric = (metric) => {
            if (!metric) return ["-", "-", "-", "-"];
            const hist = metric.histogram || [];
            return [
              hist[0]?.density ?? "-",
              hist[1]?.density ?? "-",
              hist[2]?.density ?? "-",
              metric.percentiles?.p75 ?? "-",
            ];
          };

          const lcp = extractMetric(metrics.largest_contentful_paint);
          const fid = extractMetric(metrics.first_input_delay);
          const cls = extractMetric(metrics.cumulative_layout_shift);
          const fcp = extractMetric(metrics.first_contentful_paint);

          Logger.log(
            "Crux Extractor:: Pushing extracted data to response array"
          );
          this.normalizedResponse.push([
            timeStamp,
            formFactor,
            url,
            ...lcp,
            ...fid,
            ...cls,
            ...fcp,
          ]);

          const recordIndex = this.executionRecords.findIndex(
            (record) =>
              record.url === url &&
              record.formFactor === formFactor &&
              record.status === "SUCCESS"
          );
          if (recordIndex !== -1) {
            this.executionRecords[recordIndex].normalized = "YES";
          }
        } catch (itemError) {
          Logger.log(`Failed to normalize response: ${itemError.message}`);
          Logger.log(`Skipping this response and continuing`);
          continue;
        }
      }

      if (this.normalizedResponse.length === 0) {
        throw new Error("All responses failed normalization");
      }

      Logger.log(
        `Crux Extractor:: Successfully normalized ${this.normalizedResponse.length} responses`
      );
      return this.normalizedResponse;
    } catch (error) {
      Logger.log("Crux Extractor:: Error occurred: normalizeData");
      throw error;
    }
  }

  /**
   * Writes normalized CrUX data to a Google Sheets spreadsheet.
   *
   * Creates the specified sheet tab and headers if they don't exist.
   * Appends new rows of data after the last existing row.
   *
   * @async
   * @returns {Promise<void>}
   * @throws {Error} If no data to write, spreadsheet access fails, or data cannot be written
   */
  async addToSpreadsheet() {
    try {
      if (!this.normalizedResponse || this.normalizedResponse.length === 0) {
        throw new Error(
          "No normalized data to write. Call normalizeData() first."
        );
      }

      Logger.log("Crux Extractor:: Opening spreadsheet");
      const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);

      Logger.log("Crux Extractor:: Checking if sheet tab exists");
      let sheet = spreadsheet.getSheetByName(this.sheetTabName);

      if (!sheet) {
        Logger.log("Crux Extractor:: Creating new sheet and adding headers");
        sheet = spreadsheet.insertSheet(this.sheetTabName);

        const headers = [
          "Date",
          "Platform",
          "URL",
          "LCP (Good)",
          "LCP (Needs Improvement)",
          "LCP (Poor)",
          "LCP (75th Percentile)",
          "FID (Good)",
          "FID (Needs Improvement)",
          "FID (Poor)",
          "FID (75th Percentile)",
          "CLS (Good)",
          "CLS (Needs Improvement)",
          "CLS (Poor)",
          "CLS (75th Percentile)",
          "FCP (Good)",
          "FCP (Needs Improvement)",
          "FCP (Poor)",
          "FCP (75th Percentile)",
        ];

        if (headers.length !== CruxExtractor.CONFIG.COLUMN_COUNT) {
          Logger.log(
            `Warning: Header count (${headers.length}) does not match CONFIG.COLUMN_COUNT (${CruxExtractor.CONFIG.COLUMN_COUNT})`
          );
        }

        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      }

      const numRows = this.normalizedResponse.length;
      const numCols = this.normalizedResponse[0].length;

      if (numCols !== CruxExtractor.CONFIG.COLUMN_COUNT) {
        Logger.log(
          `Warning: Data columns (${numCols}) do not match expected (${CruxExtractor.CONFIG.COLUMN_COUNT})`
        );
      }

      const startRow = sheet.getLastRow() + 1;
      Logger.log(
        `Crux Extractor:: Writing ${numRows} rows starting at row ${startRow}`
      );

      sheet
        .getRange(startRow, 1, numRows, numCols)
        .setValues(this.normalizedResponse);

      Logger.log("Crux Extractor:: Data written successfully");
    } catch (error) {
      Logger.log("Crux Extractor:: Error occurred: addToSpreadsheet");
      throw error;
    }
  }

  /**
   * Gets or creates the execution history sheet.
   *
   * Creates a new sheet tab with headers if it doesn't exist.
   * Headers: Execution ID, Timestamp, URL, Form Factor, Status, Response Code, Error Message, Normalized
   *
   * @returns {GoogleAppsScript.Spreadsheet.Sheet} The execution history sheet
   * @throws {Error} If spreadsheet access fails
   */
  getExecutionHistorySheet() {
    try {
      Logger.log("Crux Extractor:: Getting execution history sheet");
      const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
      let historySheet = spreadsheet.getSheetByName(
        CruxExtractor.CONFIG.HISTORY_SHEET_NAME
      );

      if (!historySheet) {
        Logger.log(
          "Crux Extractor:: Creating execution history sheet with headers"
        );
        historySheet = spreadsheet.insertSheet(
          CruxExtractor.CONFIG.HISTORY_SHEET_NAME
        );

        const headers = [
          "Execution ID",
          "Timestamp",
          "URL",
          "Form Factor",
          "Status",
          "Response Code",
          "Error Message",
          "Normalized",
        ];

        if (headers.length !== CruxExtractor.CONFIG.HISTORY_COLUMN_COUNT) {
          Logger.log(
            `Warning: History header count (${headers.length}) does not match CONFIG.HISTORY_COLUMN_COUNT (${CruxExtractor.CONFIG.HISTORY_COLUMN_COUNT})`
          );
        }

        historySheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      }

      return historySheet;
    } catch (error) {
      Logger.log("Crux Extractor:: Error occurred: getExecutionHistorySheet");
      throw error;
    }
  }

  /**
   * Logs execution history records to the execution history sheet.
   *
   * Records include execution ID, timestamp, URL, form factor, status, response code,
   * error message (if any), and whether the response was normalized successfully.
   *
   * @param {string} executionId - Unique identifier for this execution run
   * @param {Array<Object>} records - Array of execution record objects
   * @param {string} records[].url - The URL that was requested
   * @param {string} records[].formFactor - Form factor (PHONE, DESKTOP, ALL_FORM_FACTORS)
   * @param {string} records[].status - SUCCESS or FAILED
   * @param {number} [records[].responseCode] - HTTP response code
   * @param {string} [records[].errorMessage] - Error message if failed
   * @param {string} records[].normalized - Whether response was normalized (YES/NO)
   * @returns {void}
   * @throws {Error} If writing to history sheet fails
   */
  logExecutionHistory(executionId, records) {
    try {
      if (!records || records.length === 0) {
        Logger.log("Crux Extractor:: No execution history records to log");
        return;
      }

      Logger.log(
        `Crux Extractor:: Logging ${records.length} execution history records`
      );
      const historySheet = this.getExecutionHistorySheet();

      const timeZone = Session.getScriptTimeZone();
      const timestamp = Utilities.formatDate(
        new Date(),
        timeZone,
        "dd-MM-yyyy HH:mm:ss"
      );

      const rows = records.map((record) => [
        executionId,
        timestamp,
        record.url || "-",
        record.formFactor || "-",
        record.status || "UNKNOWN",
        record.responseCode || "-",
        record.errorMessage || "-",
        record.normalized || "NO",
      ]);

      const startRow = historySheet.getLastRow() + 1;
      historySheet
        .getRange(startRow, 1, rows.length, CruxExtractor.CONFIG.HISTORY_COLUMN_COUNT)
        .setValues(rows);

      Logger.log(
        `Crux Extractor:: Successfully logged execution history to row ${startRow}`
      );
    } catch (error) {
      Logger.log("Crux Extractor:: Error occurred: logExecutionHistory");
      Logger.log(`Error details: ${error.message}`);
    }
  }

  /**
   * Executes the complete CrUX data extraction pipeline.
   *
   * Orchestrates the five-step process:
   * 1. Build request payloads
   * 2. Fetch data from CrUX API
   * 3. Normalize responses into arrays
   * 4. Write data to spreadsheet
   * 5. Log execution history
   *
   * @async
   * @returns {Promise<Object>} Summary object with execution statistics
   * @throws {Error} If any step in the pipeline fails or no valid responses are collected
   */
  async run() {
    const executionId = `exec_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    try {
      Logger.log("Crux Extractor:: Starting execution");
      Logger.log(`Execution ID: ${executionId}`);

      Logger.log("Step 1: Building request payloads");
      const requests = await this.buildRequestUrls();
      if (!requests || requests.length === 0) {
        throw new Error("No valid requests to process");
      }
      Logger.log(`Built ${requests.length} requests`);

      Logger.log("Step 2: Fetching data from CrUX API");
      const responses = await this.fetchData();
      if (!responses || responses.length === 0) {
        throw new Error("No successful API responses received");
      }
      Logger.log(`Received ${responses.length} successful responses`);

      Logger.log("Step 3: Normalizing responses");
      const normalized = await this.normalizeData();
      if (!normalized || normalized.length === 0) {
        throw new Error("All responses failed normalization");
      }
      Logger.log(`Normalized ${normalized.length} rows`);

      Logger.log("Step 4: Writing data to spreadsheet");
      await this.addToSpreadsheet();

      Logger.log("Step 5: Logging execution history");
      this.logExecutionHistory(executionId, this.executionRecords);

      const summary = {
        executionId,
        totalRequests: requests.length,
        successfulResponses: responses.length,
        rowsWritten: normalized.length,
        failedRequests: requests.length - responses.length,
      };

      Logger.log(`Execution complete: ${JSON.stringify(summary)}`);
      return summary;
    } catch (error) {
      Logger.log("Crux Extractor:: Error occurred during execution");
      Logger.log(`Error details: ${error.message}`);

      if (this.executionRecords && this.executionRecords.length > 0) {
        Logger.log("Logging partial execution history before throwing error");
        try {
          this.logExecutionHistory(executionId, this.executionRecords);
        } catch (historyError) {
          Logger.log(
            `Failed to log execution history: ${historyError.message}`
          );
        }
      }

      throw error;
    }
  }
}

/**
 * Main entry point for the CrUX data extraction script.
 *
 * Configures and executes the CruxExtractor to fetch Chrome UX Report data
 * and write it to Google Sheets. Uses executionFlag to prevent duplicate runs
 * within the same execution (Apps Script timing bug workaround).
 *
 * Configuration Instructions:
 * - urls: Array of URLs to extract data for
 * - spreadsheetId: Google Sheets spreadsheet ID to write data to
 * - apiKey: Google API key with Chrome UX Report API access
 *   (See: https://developers.google.com/web/tools/chrome-user-experience-report/api/guides/getting-started)
 * - formFactor: Screen types to query (PHONE, DESKTOP, ALL_FORM_FACTORS)
 * - sheetTabName: Name of the sheet tab (will create if not present)
 *
 * @async
 * @returns {Promise<Object>} Execution summary or undefined if duplicate run detected
 */
const main = async () => {
  try {
    Logger.log("Crux Extractor:: Starting script execution");

    if (executionFlag) {
      Logger.log("Duplicate execution detected, exiting");
      return;
    }

    executionFlag = true;

    const config = {
      urls: [],
      spreadsheetId: "",
      apiKey: "",
      formFactor: ["PHONE", "DESKTOP", "ALL_FORM_FACTORS"],
      sheetTabName: "cruxData",
    };

    if (!config.urls.length) {
      throw new Error(
        "Configuration error: 'urls' array is empty. Please add URLs to process."
      );
    }

    if (!config.spreadsheetId) {
      throw new Error(
        "Configuration error: 'spreadsheetId' is required. Please add your spreadsheet ID."
      );
    }

    if (!config.apiKey) {
      throw new Error(
        "Configuration error: 'apiKey' is required. Please add your API key."
      );
    }

    Logger.log("Crux Extractor:: Initializing extractor");
    const cruxExtractor = new CruxExtractor(config);

    Logger.log("Crux Extractor:: Starting extraction");
    const summary = await cruxExtractor.run();

    Logger.log(`Script execution successful: ${JSON.stringify(summary)}`);
    return summary;
  } catch (error) {
    Logger.log("Script execution failed");
    Logger.log(error.message || error.toString());
    if (error.stack) {
      Logger.log(error.stack);
    }
    throw error;
  }
};
