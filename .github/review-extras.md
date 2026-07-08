## Repo-specific conventions

This is a Google **Apps Script** tool (Chrome UX Report data into Google Sheets),
not a Node project. Source: `index.js` (extractor) and `create-dashboard.js`
(charts); tests in `tests/`. Read `README.md` for full context.

### Environment (flag violations)

- Runs in the Apps Script V8 runtime, NOT Node.js. Only Apps Script services
  exist: `UrlFetchApp`, `SpreadsheetApp`, `Logger`, `Utilities`, `Session`,
  `PropertiesService`. There is no npm, no `require`/`import`, and no Node or
  browser globals (`fetch`, `process`, `window`, `setTimeout`).
- Must stay **dual-use**: runnable both copy-pasted into an Apps Script project
  and added as an Apps Script library. Only top-level **function declarations**
  are exposed to library consumers; top-level `class`/`const`/`let` are not.
  Internal-only symbols use a trailing underscore (e.g. `CruxExtractor_`) to
  stay private in a library. Flag anything that would break either mode.

### CrUX API correctness (easy to get wrong)

- `formFactor` accepts only `PHONE`, `DESKTOP`, `TABLET`. Data aggregated across
  all form factors is obtained by **omitting** the field — there is no
  `ALL_FORM_FACTORS` API value (sending it returns HTTP 400). The config token
  `ALL_FORM_FACTORS` is intentionally translated to an omitted field.
- `first_input_delay` (FID) was **removed** from the API on 2024-09-09 and is
  never returned; the FID columns are retained empty for layout only. Don't
  treat FID as live data.
- Endpoint is `records:queryRecord`. With no `metrics` array, the API returns
  all available metrics.

### Behaviour to preserve

- Sequential requests with the ~400ms sleep between calls are intentional rate
  limiting — do not suggest `fetchAll`/parallelism.
- Non-200 and JSON-parse failures must be logged, skipped, and recorded in the
  `executionHistory` audit sheet — never crash the run. Missing metrics default
  to `"-"`.
- The main sheet is a fixed 31-column schema; headers and row-building must stay
  aligned.

### Style

- Match surrounding code; JSDoc on public functions.
- No emojis or em-dashes in code or docs (house style).
