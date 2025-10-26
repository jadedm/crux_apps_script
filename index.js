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
    if (
      !urls ||
      !urls.length ||
      !spreadsheetId ||
      !spreadsheetId.length ||
      !apiKey ||
      !apiKey.length ||
      !cruxUrl ||
      !cruxUrl.length ||
      !formFactor ||
      !formFactor.length ||
      !sheetTabName ||
      !sheetTabName.length
    ) {
      throw new Error("Crux Extractor: Initialization error");
    }

    this.urls = urls;
    this.spreadsheetId = spreadsheetId;
    this.apiKey = apiKey;
    this.formFactor = formFactor;
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
    try {
      const url = new URL(urlString);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  /**
   * Builds an array of request payloads for the CrUX API.
   *
   * Creates one request for each combination of URL and form factor.
   * Invalid URLs are logged and skipped.
   *
   * @async
   * @returns {Promise<Object[]>} Array of request objects for UrlFetchApp.fetch()
   * @throws {Error} If building request payloads fails
   */
  async buildRequestUrls() {
    try {
      const self = this;

      self.requests = [];

      for (let urlIndex = 0; urlIndex < self.urls?.length; urlIndex++) {
        const currentUrl = self.urls[urlIndex];

        if (!self.isValidUrl(currentUrl)) {
          Logger.log(`Crux Extractor:: Invalid URL skipped: ${currentUrl}`);
          continue;
        }

        for (
          let formFactorIndex = 0;
          formFactorIndex < self.formFactor?.length;
          formFactorIndex++
        ) {
          self.requests.push({
            method: "post",
            muteHttpExceptions: true,
            contentType: "application/json",
            payload: JSON.stringify({
              url: currentUrl,
              formFactor: self.formFactor[formFactorIndex],
            }),
          });
        }
      }

      Logger.log(
        `Crux Extractor:: Building request payload complete; returning payload for making API calls, payloadLength ${self.requests?.length}`
      );
      return self.requests;
    } catch (error) {
      Logger.log("Crux Extractor:: Error occurred: buildRequestUrls");
      throw error;
    }
  }

  /**
   * Fetches CrUX data from the Chrome UX Report API sequentially.
   *
   * Makes API calls one at a time with a configurable delay between requests
   * to avoid rate limiting. Non-200 responses are logged and skipped.
   *
   * @async
   * @returns {Promise<Object[]>} Array of successful API response objects
   * @throws {Error} If fetching data fails
   */
  async fetchData() {
    try {
      const self = this;

      self.filteredResponse = [];
      const requestsLength = self.requests?.length;

      for (let urlIndex = 0; urlIndex < requestsLength; urlIndex++) {
        Logger.log(
          `Crux Extractor:: making an api call ${
            urlIndex + 1
          } of ${requestsLength} with payload`
        );
        Logger.log(self.requests[urlIndex]?.payload);

        const response = UrlFetchApp.fetch(
          self.cruxUrl,
          self.requests[urlIndex]
        );
        Logger.log(
          `Crux Extractor:: received response with status code ${response.getResponseCode()}`
        );

        Utilities.sleep(CruxExtractor.CONFIG.SLEEP_DURATION_MS);
        Logger.log(
          `Crux Extractor:: sleeping ${CruxExtractor.CONFIG.SLEEP_DURATION_MS} milli-seconds after making an api call`
        );

        if (response.getResponseCode() !== CruxExtractor.CONFIG.HTTP_STATUS_OK) {
          Logger.log("Crux Extractor:: Non 200 response code for ");
          Logger.log(self.requests[urlIndex]);

          Logger.log(response.getResponseCode());
          Logger.log(response.getContentText());

          continue;
        }

        const responseContent = JSON.parse(response.getContentText());
        Logger.log("Crux Extractor:: pushing element to filteredResponse");
        self.filteredResponse.push(responseContent);
      }

      Logger.log("Crux Extractor:: Returning response for normalizing");
      return self.filteredResponse;
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
   *
   * @async
   * @returns {Promise<Array[]>} Array of arrays, each containing 19 columns of data:
   *   [Date, Platform, URL, LCP metrics (4), FID metrics (4), CLS metrics (4), FCP metrics (4)]
   * @throws {Error} If normalizing data fails
   */
  async normalizeData() {
    // Get timezone and format current timestamp for each row
    try {
      const self = this;

      self.normalizedResponse = [];

      for (
        let filterIndex = 0;
        filterIndex < self.filteredResponse?.length;
        filterIndex++
      ) {
        const timeZone = Session.getScriptTimeZone();
        const timeStamp = Utilities.formatDate(
          new Date(),
          timeZone,
          "dd-MM-yyyy"
        );

        Logger.log("Crux Extractor:: Extracting values from response body");
        Logger.log(self.filteredResponse[filterIndex]);
        const {
          record: {
            key: { formFactor = `AGGREGATED`, url },
            metrics: {
              largest_contentful_paint: {
                histogram: [lcpGood, lcpNeeds, lcpPoor],
                percentiles: { p75: lcpP75 },
              } = {
                histogram: [
                  { density: "-" },
                  { density: "-" },
                  { density: "-" },
                ],
                percentiles: { p75: "-" },
              },
              cumulative_layout_shift: {
                histogram: [clsGood, clsNeeds, clsPoor],
                percentiles: { p75: clsP75 },
              } = {
                histogram: [
                  { density: "-" },
                  { density: "-" },
                  { density: "-" },
                ],
                percentiles: { p75: "-" },
              },
              first_input_delay: {
                histogram: [fidGood, fidNeeds, fidPoor],
                percentiles: { p75: fidP75 },
              } = {
                histogram: [
                  { density: "-" },
                  { density: "-" },
                  { density: "-" },
                ],
                percentiles: { p75: "-" },
              },
              first_contentful_paint: {
                histogram: [fcpGood, fcpNeeds, fcpPoor],
                percentiles: { p75: fcpP75 },
              } = {
                histogram: [
                  { density: "-" },
                  { density: "-" },
                  { density: "-" },
                ],
                percentiles: { p75: "-" },
              },
            },
          },
        } = self.filteredResponse[filterIndex];

        Logger.log("Crux Extractor:: Pushing extracted body to response array");
        self.normalizedResponse.push([
          timeStamp,
          formFactor,
          url,
          lcpGood.density,
          lcpNeeds.density,
          lcpPoor.density,
          lcpP75,
          fidGood.density,
          fidNeeds.density,
          fidPoor.density,
          fidP75,
          clsGood.density,
          clsNeeds.density,
          clsPoor.density,
          clsP75,
          fcpGood.density,
          fcpNeeds.density,
          fcpPoor.density,
          fcpP75,
        ]);
      }

      Logger.log(
        "Crux Extractor:: Returning response for pushing to spreadsheet"
      );

      return self.normalizedResponse;
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
   * @throws {Error} If spreadsheet access fails or data cannot be written
   */
  async addToSpreadsheet() {
    try {
      const self = this;

      Logger.log("Crux Extractor:: Setting active spreadsheet");
      const reportSS = SpreadsheetApp.openById(self.spreadsheetId);

      Logger.log("Crux Extractor:: Checking if tab already exists");
      let reportActiveSheet = reportSS.getSheetByName(self.sheetTabName);

      if (reportActiveSheet) {
        Logger.log("Crux Extractor:: Sheet found, setting as active");
        reportSS.setActiveSheet(reportActiveSheet);
      } else {
        Logger.log(
          "Crux Extractor:: Tab does not exist, creating new tab and adding headers"
        );
        const insertedSS = reportSS.insertSheet(self.sheetTabName);
        reportActiveSheet = reportSS.setActiveSheet(insertedSS);
        reportActiveSheet
          .getRange(
            CruxExtractor.CONFIG.HEADER_ROW,
            CruxExtractor.CONFIG.HEADER_START_COL,
            1,
            CruxExtractor.CONFIG.COLUMN_COUNT
          )
          .setValues([
            [
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
            ],
          ]);
      }

      const row = self.normalizedResponse?.length;
      const column = self.normalizedResponse[0]?.length;

      Logger.log("Crux Extractor:: Pushing data to spreadsheet");
      reportActiveSheet
        .getRange(reportActiveSheet.getLastRow() + 1, 1, row, column)
        .setValues(self.normalizedResponse);
    } catch (error) {
      Logger.log("Crux Extractor:: Error occurred: addToSpreadsheet");
      throw error;
    }
  }

  /**
   * Executes the complete CrUX data extraction pipeline.
   *
   * Orchestrates the four-step process:
   * 1. Build request payloads
   * 2. Fetch data from CrUX API
   * 3. Normalize responses into arrays
   * 4. Write data to spreadsheet
   *
   * @async
   * @returns {Promise<void>}
   * @throws {Error} If any step in the pipeline fails or no valid responses are collected
   */
  async run() {
    try {
      Logger.log("Crux Extractor:: Starting CruxExtractor Execution");
      Logger.log(
        "Crux Extractor:: Building request payload for bulk API calls"
      );
      await this.buildRequestUrls();

      Logger.log("Crux Extractor:: Making API calls");
      await this.fetchData();

      Logger.log(
        "Crux Extractor:: Normalizing response before pushing it to sheets"
      );
      await this.normalizeData();

      Logger.log("Crux Extractor:: Adding data to sheets");
      if (!this.normalizedResponse || !this.normalizedResponse.length) {
        throw new Error("Crux Extractor: No responses to add to sheet");
      }
      await this.addToSpreadsheet();

      Logger.log("Crux Extractor Execution complete");
    } catch (error) {
      Logger.log("Crux Extractor:: Error occurred: run");
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
 * @returns {Promise<void>}
 */
const main = async () => {
  try {
    Logger.log("Crux Extractor:: Starting script execution");

    if (executionFlag) {
      Logger.log(
        "Crux Extractor:: Exiting, script running again (Apps script bug probably?)"
      );
      return;
    }

    Logger.log("Crux Extractor:: Setting execution flag to true on first run");
    executionFlag = true;

    const urls = [];
    const spreadsheetId = "";
    const apiKey = "";
    const formFactor = ["PHONE", "DESKTOP", "ALL_FORM_FACTORS"];
    const cruxUrl =
      "https://chromeuxreport.googleapis.com/v1/records:queryRecord?alt=json&key=";
    const sheetTabName = "";

    Logger.log("Crux Extractor:: Initializing extractor");
    const cruxExtractor = new CruxExtractor({
      urls,
      spreadsheetId,
      apiKey,
      formFactor,
      cruxUrl,
      sheetTabName,
    });

    Logger.log("Crux Extractor:: invoking run method");
    await cruxExtractor.run();

    Logger.log("Crux Extractor:: Script execution successful");
  } catch (error) {
    Logger.log("Crux Extractor:: Script execution unsuccessful");
    Logger.log(error.stack);
  }
};
