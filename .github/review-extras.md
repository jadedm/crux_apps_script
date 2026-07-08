## Repo-specific conventions

Google Apps Script tool that pulls Chrome UX Report (CrUX) data into Google
Sheets. Source: `index.js` (extractor) and `create-dashboard.js` (charts); tests
in `tests/`. The general Apps Script conventions come from the `apps-script`
stack prompt — the notes below are specific to this repo.

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

- Non-200 and JSON-parse failures must be logged, skipped, and recorded in the
  `executionHistory` audit sheet — never crash the run. Missing metrics default
  to `"-"`.
- The main sheet is a fixed 31-column schema; headers and row-building must stay
  aligned.

### Style

- No emojis or em-dashes in code or docs (house style).
