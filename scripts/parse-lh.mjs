import fs from 'node:fs';

const filePath = process.argv[2] || './lighthouse-landing.json';
const report = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const perf = report.categories.performance;
console.log('Performance Score:', Math.round(perf.score * 100));
console.log('\nKey Core Web Vitals:');
const metrics = [
  'first-contentful-paint',
  'largest-contentful-paint',
  'total-blocking-time',
  'cumulative-layout-shift',
  'speed-index',
];
for (const m of metrics) {
  const a = report.audits[m];
  console.log(`  ${a.title} (${m}): ${a.displayValue} [score: ${a.score}]`);
}

console.log('\nLow scoring audits (score < 0.9):');
for (const [k, v] of Object.entries(report.audits)) {
  if (v.score !== null && v.score < 0.9) {
    console.log(`- ${v.title} (${k}): score=${v.score} display=${v.displayValue || ''}`);
    if (v.details && v.details.items && v.details.items.length > 0) {
      console.log('  Items count:', v.details.items.length);
      console.log('  First item:', JSON.stringify(v.details.items[0], null, 2).slice(0, 300));
    }
  }
}
