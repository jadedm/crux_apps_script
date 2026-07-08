/**
 * Build the copy-paste artifact from the single source of truth.
 *
 * Source of truth:
 *   - src/index.js        the library (extract() + private CruxExtractor_)
 *   - src/main.partial.js the copy-paste entry (main())
 *
 * Output:
 *   - dist/standalone.js  = src/index.js + src/main.partial.js
 *
 * The shared extraction logic lives once in src/index.js; main() lives once in
 * src/main.partial.js. Nothing is duplicated, so the two artifacts cannot drift.
 *
 * Run:  node build.js
 * CI verifies dist/ is in sync via `node build.js && git diff --exit-code dist/`.
 */
const fs = require("fs");
const path = require("path");

const root = __dirname;
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const library = read("src/index.js");
const entry = read("src/main.partial.js");

const header =
  "// GENERATED FILE - do not edit directly.\n" +
  "// Source of truth: src/index.js (library) + src/main.partial.js (entry).\n" +
  "// Regenerate with: node build.js\n\n";

const standalone = header + library.trimEnd() + "\n\n" + entry.trimStart();

fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist/standalone.js"), standalone);
console.log("Wrote dist/standalone.js");
