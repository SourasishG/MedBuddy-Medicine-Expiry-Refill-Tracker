import assert from 'node:assert/strict';
import { safeNextPath } from '../src/lib/safe-redirect.ts';

const testCases = [
  // Safe cases
  { input: '/app', expected: '/app', desc: 'exact /app' },
  { input: '/app/cabinet', expected: '/app/cabinet', desc: 'subroute /app/cabinet' },
  { input: '/app/cabinet?x=1', expected: '/app/cabinet?x=1', desc: 'subroute with query params' },
  {
    input: '/app/settings#privacy',
    expected: '/app/settings#privacy',
    desc: 'subroute with hash fragment',
  },
  { input: '/app?tab=today', expected: '/app?tab=today', desc: '/app with query' },

  // Open redirect & unsafe attack vectors
  { input: 'https://evil.com', expected: '/app', desc: 'absolute external URL https' },
  { input: 'http://evil.com', expected: '/app', desc: 'absolute external URL http' },
  { input: '//evil.com', expected: '/app', desc: 'protocol-relative URL' },
  { input: '///evil.com', expected: '/app', desc: 'triple slash URL' },
  { input: '/\\evil.com', expected: '/app', desc: 'slash backslash URL' },
  { input: '\\evil.com', expected: '/app', desc: 'backslash start' },
  { input: '/app/..//evil.com', expected: '/app', desc: 'path traversal escaping /app' },
  { input: '/app/../evil.com', expected: '/app', desc: 'single dot-dot traversal' },
  { input: '/app/./test', expected: '/app', desc: 'dot segment' },
  { input: '%2F%2Fevil.com', expected: '/app', desc: 'percent-encoded protocol-relative' },
  { input: '%2Fapp%2F..%2F..%2Fevil.com', expected: '/app', desc: 'percent-encoded traversal' },
  { input: '/app%5Cevil.com', expected: '/app', desc: 'percent-encoded backslash' },
  { input: 'javascript:alert(1)', expected: '/app', desc: 'javascript: scheme' },
  { input: 'data:text/html,evil', expected: '/app', desc: 'data: scheme' },
  { input: '', expected: '/app', desc: 'empty string' },
  { input: null, expected: '/app', desc: 'null' },
  { input: undefined, expected: '/app', desc: 'undefined' },
  { input: '   /app   ', expected: '/app', desc: 'leading/trailing whitespace' },
  { input: '/app\n/test', expected: '/app', desc: 'control character newline' },
  { input: '/app\x00/test', expected: '/app', desc: 'null byte' },
  { input: '/other-route', expected: '/app', desc: 'non-/app route' },
  { input: '/apple', expected: '/app', desc: 'prefix matching non-app route (/apple)' },
  { input: 'a'.repeat(3000), expected: '/app', desc: 'very long input (> 2048 chars)' },
];

console.log('Running safeNextPath unit tests...');
let passed = 0;

for (const { input, expected, desc } of testCases) {
  const result = safeNextPath(input);
  assert.equal(
    result,
    expected,
    `Failed test: "${desc}". Input: ${JSON.stringify(input)}, Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(result)}`,
  );
  passed++;
}

console.log(`✓ All ${passed} safeNextPath unit tests passed!`);
