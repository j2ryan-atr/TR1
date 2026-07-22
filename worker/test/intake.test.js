import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedOrigin, validate } from '../src/index.js';

const env = { ALLOWED_ORIGINS: 'https://ryantrust.com,https://www.ryantrust.com', ALLOWED_VERCEL_PROJECT: 'tr1' };

test('allows only configured production and project preview origins', () => {
  assert.equal(allowedOrigin('https://ryantrust.com', env), 'https://ryantrust.com');
  assert.equal(allowedOrigin('https://tr1-git-main-owner.vercel.app', env), 'https://tr1-git-main-owner.vercel.app');
  assert.equal(allowedOrigin('https://unrelated.vercel.app', env), null);
  assert.equal(allowedOrigin('https://evil.example', env), null);
});

test('accepts a minimal valid form', () => {
  const form = new FormData();
  form.set('name', 'Jordan Ryan');
  form.set('phone', '702-800-9999');
  form.set('email', 'client@example.com');
  form.set('matter', 'Probate');
  form.set('preferred', 'Phone');
  form.set('acknowledgment', 'accepted');
  form.set('cf-turnstile-response', 'test-token');
  assert.equal(validate(form).error, undefined);
});

test('rejects honeypot, invalid enums, and missing acknowledgment', () => {
  const form = new FormData();
  form.set('name', 'Jordan Ryan');
  form.set('phone', '702-800-9999');
  form.set('email', 'client@example.com');
  form.set('matter', 'Litigation');
  form.set('preferred', 'SMS');
  form.set('website', 'spam.example');
  form.set('cf-turnstile-response', 'test-token');
  assert.equal(validate(form).error, 'Submission rejected.');
  form.delete('website');
  assert.equal(validate(form).error, 'Please select a valid matter type.');
});
