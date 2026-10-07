import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FIREBASE_WEB_SDK_VERSION, readFirebaseConfiguration } from '@thy-will/client';

test('Firebase web configuration requires the complete public client identity', () => {
  const env = {
    VITE_FIREBASE_API_KEY: ' api-key ',
    VITE_FIREBASE_AUTH_DOMAIN: 'thy-will-dev.firebaseapp.com',
    VITE_FIREBASE_PROJECT_ID: 'thy-will-dev',
    VITE_FIREBASE_APP_ID: '1:123:web:abc',
  };
  assert.deepEqual(readFirebaseConfiguration(env), {
    apiKey: 'api-key',
    authDomain: 'thy-will-dev.firebaseapp.com',
    projectId: 'thy-will-dev',
    appId: '1:123:web:abc',
  });

  for (const missing of Object.keys(env)) {
    const incomplete = { ...env };
    delete incomplete[missing];
    assert.equal(readFirebaseConfiguration(incomplete), null, missing);
  }
});

test('Firebase browser SDK is explicitly version-pinned', () => {
  assert.match(FIREBASE_WEB_SDK_VERSION, /^\d+\.\d+\.\d+$/);
});
