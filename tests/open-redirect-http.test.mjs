import assert from 'node:assert/strict';
import { safeNextPath } from '../src/lib/safe-redirect.ts';

const maliciousPayloads = [
  'https://evil.com',
  'http://evil.com',
  '//evil.com',
  '///evil.com',
  '/\\evil.com',
  '\\evil.com',
  '/app/..//evil.com',
  '/app/../evil.com',
  '%2F%2Fevil.com',
  'javascript:alert(1)',
  'data:text/html,evil',
];

console.log('Testing open redirect payloads against safeNextPath...');
for (const payload of maliciousPayloads) {
  const result = safeNextPath(payload);
  assert.equal(result, '/app', `Payload ${payload} should return /app, got ${result}`);

  // Simulate callback route building new URL(next, request.url)
  const simulatedRequestUrl = 'http://localhost:3000/app/auth/callback';
  const targetUrl = new URL(result, simulatedRequestUrl);
  assert.equal(
    targetUrl.origin,
    'http://localhost:3000',
    `Origin must be http://localhost:3000 for ${payload}`,
  );
  assert.equal(targetUrl.pathname, '/app', `Pathname must be /app for ${payload}`);
}

console.log('✓ All open redirect payloads safely neutralized to /app on the local origin!');
