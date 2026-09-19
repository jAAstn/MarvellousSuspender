#!/usr/bin/env node
/**
 * Lint baseline gate.
 *
 * `--check` (default): runs ESLint over the whole project and fails (exit 1) only
 *   on violations that are NOT in lint-baseline.json. Baseline entries are tracked
 *   as `file:line:ruleId` (no message text, so wording changes don't cause churn);
 *   violations that disappeared from the baseline are reported as reducible.
 * `--update`: rewrites lint-baseline.json from the current lint result. Use this
 *   deliberately, e.g. after enabling a new rule or when fixing baseline entries.
 *
 * The baseline exists because the codebase predates the lint setup and carries a
 * large backlog of legacy violations; freezing them lets CI enforce "no new
 * violations" without blocking day-to-day work on the backlog.
 */
const fs = require('fs');
const path = require('path');

const { ESLint } = require('eslint');

const BASELINE_PATH = path.join(__dirname, '..', 'lint-baseline.json');

async function main() {
  const update = process.argv.includes('--update');

  const eslint = new ESLint({
    // Same lookup as `npx eslint .` — config comes from eslint.config.mjs.
    cwd: path.join(__dirname, '..'),
  });

  const results = await eslint.lintFiles(['**/*.js', '**/*.mjs']);
  const formatter = await eslint.loadFormatter('json');
  const json = JSON.parse(await formatter.format(results));

  const current = new Map(); // key -> [{ file, line, ruleId }]
  for (const file of json) {
    for (const msg of file.messages) {
      const key = `${file.filePath.replace(/\\/g, '/').replace(`${process.cwd().replace(/\\/g, '/')}/`, '')}:${msg.line}:${msg.ruleId ?? 'PARSE_ERROR'}`;
      if (!current.has(key)) current.set(key, []);
      current.get(key).push({ file: file.filePath, line: msg.line, ruleId: msg.ruleId ?? 'PARSE_ERROR' });
    }
  }

  if (update) {
    const entries = [...current.keys()].sort();
    fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(entries, null, 2)}\n`);
    console.log(`Baseline updated: ${entries.length} violations frozen in lint-baseline.json`);
    return;
  }

  const baselineKeys = new Set(JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')));
  const newViolations = [...current.keys()].filter((k) => !baselineKeys.has(k));
  const resolved = [...baselineKeys].filter((k) => !current.has(k));

  if (newViolations.length > 0) {
    console.error(`\n${newViolations.length} NEW lint violation(s) not in the baseline:\n`);
    for (const key of newViolations) {
      const { file, line, ruleId } = current.get(key)[0];
      console.error(`  ${path.relative(process.cwd(), file)}:${line}  ${ruleId}`);
    }
    console.error('\nFix them (or, if a new violation is intentional and reviewed, run: npm run lint:baseline)');
    process.exit(1);
  }

  console.log(`Lint gate passed: 0 new violations (${resolved.length} baseline entries could be removed — run npm run lint:baseline to shrink the baseline)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
