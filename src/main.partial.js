/**
 * Copy-paste entry point. Edit the config below and bind an Apps Script
 * time-based trigger to this `main` function.
 *
 * This function is only present in the copy-paste build (dist/standalone.js);
 * it is NOT part of the library surface. Library consumers call `extract()`
 * directly and ignore this.
 *
 * @returns {Promise<Object>|undefined} Execution summary, or undefined if a
 *   concurrent run already holds the lock.
 */
async function main() {
  // Reduce the chance of duplicate rows from a CONCURRENT trigger double-fire:
  // if another invocation is already running, skip this one. tryLock(0) returns
  // immediately without waiting. Note this does not dedupe SEQUENTIAL re-runs
  // (a second fire after the first finishes and releases the lock); for full
  // idempotency, dedupe by date before writing.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) {
    Logger.log(
      "Crux Extractor:: Another execution holds the lock; exiting to avoid duplicate rows"
    );
    return;
  }

  try {
    return await extract({
      urls: [], // Add your URLs
      spreadsheetId: "", // Add your spreadsheet ID
      apiKey: "", // Add your API key (or read it from PropertiesService)
      // Accepted: "PHONE", "DESKTOP", "TABLET", "ALL_FORM_FACTORS"
      // (ALL_FORM_FACTORS returns data aggregated across all form factors).
      formFactor: ["PHONE", "DESKTOP", "ALL_FORM_FACTORS"],
      sheetTabName: "cruxData",
    });
  } catch (error) {
    // Log before rethrowing so a failed trigger run leaves a diagnosable
    // transcript (the async rejection alone may not surface details).
    Logger.log("Crux Extractor:: Run failed: " + (error && error.message));
    if (error && error.stack) {
      Logger.log(error.stack);
    }
    throw error;
  } finally {
    lock.releaseLock();
  }
}
