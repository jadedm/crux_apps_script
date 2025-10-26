# Chrome UX Report (CrUX) Data Extractor

Google Apps Script tool that extracts Core Web Vitals data from the Chrome User Experience Report API and writes it to Google Sheets.

## Overview

Fetches CrUX metrics (LCP, FID, CLS, FCP) for specified URLs across different form factors (phone, desktop, all) and automatically appends the data to a Google Sheets spreadsheet with proper formatting.

## Setup

1. Create a new Google Apps Script project
2. Copy the contents of `index.js` into the script editor
3. Enable the V8 runtime (should be default)
4. Get a Google API key with Chrome UX Report API access:
   - https://developers.google.com/web/tools/chrome-user-experience-report/api/guides/getting-started

## Configuration

Edit the `main()` function (starting at line 332) with your settings:

```javascript
const urls = ["https://example.com", "https://example.com/page"];
const spreadsheetId = "your-spreadsheet-id-here";
const apiKey = "your-api-key-here";
const sheetTabName = "cruxData";
const formFactor = ["PHONE", "DESKTOP", "ALL_FORM_FACTORS"];
```

**Security Note**: For production, store the API key in Script Properties instead of hardcoding:

```javascript
const apiKey =
  PropertiesService.getScriptProperties().getProperty("CRUX_API_KEY");
```

## Usage

Run the `main()` function from the Apps Script editor or set up a time-based trigger for automated data collection.

The script will:

1. Create the specified sheet tab if it doesn't exist
2. Add headers on first run
3. Fetch CrUX data for each URL/form factor combination
4. Append new rows with timestamped data

## Architecture Decisions

### Sequential API Requests (Not Parallel)

The implementation uses **sequential requests with 400ms delays** instead of `UrlFetchApp.fetchAll()`. This is intentional:

**Why not use `fetchAll()`?**

- Apps Script has undocumented rate limiting on `fetchAll()` that triggers "Service invoked too many times" errors
- External APIs (like CrUX) have their own rate limits that would cause 429 errors with concurrent requests
- Sequential processing allows better timeout control per request
- Better error logging and debugging (can see exactly which URL failed)

**References:**

- Commit c4ee077: "moved fetching logic from fetch all to fetch individual to control timeout per request"

### Error Handling

Non-200 responses are logged and skipped (line 100-108). Failed URLs won't stop execution but will be missing from the output. Check Apps Script logs to identify failures.

### Execution Flag Workaround

The global `executionFlag` (line 2) prevents duplicate execution within the same run, working around a known Apps Script timing bug where triggers sometimes fire twice.

## Known Issues

1. **Error handling pattern** (lines 68, 119, 226, 298, 328): Uses `throw new Error(error.stack)` which can create malformed error messages
2. **Typo** (line 320): "reponses" should be "responses"
3. **Sheet lookup** (lines 244-254): Could use `getSheetByName()` instead of looping through all sheets
4. **No retry logic**: Transient API failures result in missing data
5. **No input validation**: Malformed URLs will fail silently

## Output Schema

19 columns per row:

```
Date | Platform | URL |
LCP (Good) | LCP (Needs Improvement) | LCP (Poor) | LCP (75th Percentile) |
FID (Good) | FID (Needs Improvement) | FID (Poor) | FID (75th Percentile) |
CLS (Good) | CLS (Needs Improvement) | CLS (Poor) | CLS (75th Percentile) |
FCP (Good) | FCP (Needs Improvement) | FCP (Poor) | FCP (75th Percentile)
```

Missing metrics are denoted with "-".

## Performance

For 10 URLs × 3 form factors:

- 30 API requests
- ~12 seconds of sleep time (400ms × 30)
- ~15-20 seconds total execution time

This is well within Apps Script's 6-minute execution limit.

## Troubleshooting

**Script doesn't run on second execution**

- Not an issue. The `executionFlag` resets each execution. This only prevents double-firing within a single run.

**"Service invoked too many times" error**

- Should not occur with current implementation. If it does, increase the sleep duration on line 95.

**Missing data in spreadsheet**

- Check Apps Script logs (View → Logs) for API errors
- Verify URLs are in the CrUX dataset (not all URLs have data)
- Check API key permissions and quota

**Empty responses**

- Some URLs may not have CrUX data (low traffic sites)
- Form factor data may not be available for all URLs
