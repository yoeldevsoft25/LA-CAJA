import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { ESLint } from 'eslint';

const baselinePath = path.resolve(process.cwd(), 'config/ci/lint-baseline.json');
const raw = fs.readFileSync(baselinePath, 'utf8');
const baseline = JSON.parse(raw);

let hasRegression = false;

async function run() {
  for (const target of baseline.targets) {
    const cwd = path.resolve(process.cwd(), target.cwd);
    const eslint = new ESLint({ cwd });
    const results = await eslint.lintFiles(target.patterns);

    let errors = 0;
    let warnings = 0;
    for (const result of results) {
      errors += result.errorCount;
      warnings += result.warningCount;
    }

    const errorDelta = errors - target.maxErrors;
    const warningDelta = warnings - target.maxWarnings;

    const status =
      errorDelta <= 0 && warningDelta <= 0 ? 'OK' : 'REGRESSION';

    console.log(
      `[lint-ratchet] ${target.name}: ${status} | errors=${errors} (max ${target.maxErrors}), warnings=${warnings} (max ${target.maxWarnings})`
    );

    if (errorDelta > 0 || warningDelta > 0) {
      hasRegression = true;
    }
  }

  if (hasRegression) {
    console.error(
      '[lint-ratchet] Lint empeoro respecto al baseline. Reduce errores/warnings o actualiza baseline deliberadamente.'
    );
    process.exit(1);
  }
}

run().catch((error) => {
  console.error('[lint-ratchet] Error ejecutando chequeo:', error);
  process.exit(1);
});
