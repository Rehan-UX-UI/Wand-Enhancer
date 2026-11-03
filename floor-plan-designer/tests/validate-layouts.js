#!/usr/bin/env node
/* Headless check: loads the model + validator and reports findings for every layout.
 * Usage: node tests/validate-layouts.js [--all]   (exit code 1 on any error) */
'use strict';
const path = require('path');
const root = path.join(__dirname, '..', 'js');
['core.js', 'layouts.js', 'validate.js'].forEach((f) => require(path.join(root, f)));
const FP = globalThis.FP;
const showAll = process.argv.includes('--all');
let errors = 0;
for (const id of Object.keys(FP.LAYOUTS)) {
  const res = FP.validate(FP.LAYOUTS[id]);
  console.log(`\n== ${FP.LAYOUTS[id].name}  ${JSON.stringify(res.counts)}`);
  res.issues.forEach((i) => {
    if (i.level === 'error') errors++;
    if (showAll || i.level === 'error' || i.level === 'warn') console.log(`  [${i.level}] ${i.cat}: ${i.msg}`);
  });
  const cols = FP.core.computeColumns(FP.LAYOUTS[id]);
  if (showAll) console.log('  columns', cols.map((c) => `${c.gx},${c.gy}`).join(' '));
}
process.exit(errors ? 1 : 0);
