import assert from 'assert';
import bcrypt from 'bcryptjs';
import express from 'express';
import http from 'http';
import { userAuthRouter, normalizeEmail, normalizePhone, isValidEmailFormat, isValidPhoneFormat } from '../src/server/userAuthServer';

async function runTests() {
  console.log('🏏 ==========================================');
  console.log('CRICKET ARENA: USER AUTHENTICATION TEST SUITE');
  console.log('No-OTP Gmail & Phone Authentication Testing');
  console.log('==========================================\n');

  // Set up test express app
  const app = express();
  app.use(express.json());
  app.use('/api/auth', userAuthRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api/auth`;

  let passedTests = 0;
  let totalTests = 0;

  function test(name: string, fn: () => Promise<void> | void) {
    totalTests++;
    return (async () => {
      try {
        await fn();
        console.log(`✅ [PASS] ${name}`);
        passedTests++;
      } catch (err: any) {
        console.error(`❌ [FAIL] ${name}:`, err.message || err);
      }
    })();
  }

  // 1. UNIT TESTS: Format validation & normalization
  await test('1. Gmail normalization strips dots and +tags for alias deduplication', () => {
    assert.strictEqual(normalizeEmail('Virat.Kohli@gmail.com'), 'viratkohli@gmail.com');
    assert.strictEqual(normalizeEmail('virat.kohli+test1234@gmail.com'), 'viratkohli@gmail.com');
    assert.strictEqual(normalizeEmail('User.Name.123@googlemail.com'), 'username123@gmail.com');
    assert.strictEqual(normalizeEmail('  Regular.User@domain.com  '), 'regular.user@domain.com');
  });

  await test('2. Phone normalization handles Indian formats, 0 prefix, and international +91', () => {
    assert.strictEqual(normalizePhone('9876543210'), '9876543210');
    assert.strictEqual(normalizePhone('+91 98765 43210'), '9876543210');
    assert.strictEqual(normalizePhone('09876543210'), '9876543210');
  });

  await test('3. Email and Phone format validation correctly accepts/rejects formats', () => {
    assert.strictEqual(isValidEmailFormat('player@gmail.com'), true);
    assert.strictEqual(isValidEmailFormat('player.one@yahoo.com'), true);
    assert.strictEqual(isValidEmailFormat('invalid-email'), false);
    assert.strictEqual(isValidEmailFormat('@gmail.com'), false);
    assert.strictEqual(isValidEmailFormat('user..double@gmail.com'), false);

    assert.strictEqual(isValidPhoneFormat('9876543210'), true);
    assert.strictEqual(isValidPhoneFormat('8123456789'), true);
    assert.strictEqual(isValidPhoneFormat('12345'), false);
    assert.strictEqual(isValidPhoneFormat('abcde12345'), false);
  });

  // 2. INTEGRATION TESTS: Registration (No OTP)
  const timestamp = Date.now();
  const testUserEmail = `testplayer_${timestamp}@gmail.com`;
  const testUserPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
  const testUserPassword = 'SecurePass123!';

  let registeredToken: string = '';
  let registeredUserId: string = '';

  await test('4. Sign Up with Name, Gmail, Phone, and Password (Zero OTP required)', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Virat Player',
        email: testUserEmail,
        phone: testUserPhone,
        password: testUserPassword,
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(data)}`);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.name, 'Virat Player');
    assert.strictEqual(data.user.role, 'user', 'Normal registered user must have role user');
    assert.strictEqual(data.user.email, testUserEmail);
    assert.strictEqual(typeof data.token, 'string');
    assert.strictEqual(data.user.password, undefined, 'Plaintext password must never be in response');
    assert.strictEqual(data.user.passwordHash, undefined, 'Password hash must never be in user response');

    registeredToken = data.token;
    registeredUserId = data.user.id;
  });

  await test('5. Prevent duplicate account using existing Gmail address', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Imposter Player',
        email: testUserEmail,
        password: 'AnotherPassword999!',
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 409, 'Expected 409 Conflict for duplicate email');
    assert.strictEqual(data.success, false);
    assert.match(data.error, /already exists/i);
  });

  await test('6. Prevent duplicate account using existing Mobile Phone number', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Imposter Phone User',
        phone: testUserPhone,
        password: 'AnotherPassword999!',
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 409, 'Expected 409 Conflict for duplicate phone');
    assert.strictEqual(data.success, false);
    assert.match(data.error, /already exists/i);
  });

  await test('7. Prevent duplicate account using Gmail dot variations (e.g. test.player vs testplayer)', async () => {
    // Insert dot into local part of testUserEmail
    const [local, dom] = testUserEmail.split('@');
    const dottedEmail = `${local.slice(0, 4)}.${local.slice(4)}@${dom}`;
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate Dot User',
        email: dottedEmail,
        password: 'Password123!',
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 409, 'Expected 409 for dot-aliased duplicate Gmail');
  });

  await test('8. Sign Up with Gmail + Password only (No Phone, No OTP)', async () => {
    const emailOnly = `emailonly_${Date.now()}@gmail.com`;
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Email Only Fan',
        email: emailOnly,
        password: 'EmailFanPass123!',
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.email, emailOnly);
  });

  await test('9. Sign Up with Phone Number + Password only (No Gmail, No OTP)', async () => {
    const phoneOnly = `97${Math.floor(10000000 + Math.random() * 90000000)}`;
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Mobile Only Fan',
        phone: phoneOnly,
        password: 'PhoneFanPass123!',
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.phone, phoneOnly);
  });

  // 3. INTEGRATION TESTS: Login (No OTP)
  await test('10. Login with Gmail + Password (No OTP)', async () => {
    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testUserEmail,
        password: testUserPassword,
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.id, registeredUserId);
    assert.strictEqual(typeof data.token, 'string');
    assert.strictEqual(data.authMethod, 'email');
  });

  await test('11. Login with Phone Number + Password (No OTP)', async () => {
    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testUserPhone,
        password: testUserPassword,
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.id, registeredUserId);
    assert.strictEqual(typeof data.token, 'string');
    assert.strictEqual(data.authMethod, 'phone');
  });

  await test('12. Login with incorrect password returns clear 401 error', async () => {
    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testUserEmail,
        password: 'TotallyWrongPassword999!',
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 401);
    assert.strictEqual(data.success, false);
    assert.match(data.error, /incorrect password/i);
  });

  await test('13. Login with non-existent account returns clear 404 error', async () => {
    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'nonexistentuser9999@gmail.com',
        password: 'SomePassword123!',
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 404);
    assert.strictEqual(data.success, false);
    assert.match(data.error, /no account found/i);
  });

  await test('14. Session restoration via /api/auth/me returns authenticated user', async () => {
    const res = await fetch(`${baseUrl}/me`, {
      headers: {
        'Authorization': `Bearer ${registeredToken}`,
      },
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.id, registeredUserId);
    assert.strictEqual(data.user.name, 'Virat Player');
  });

  await test('15. Logout invalidates the active session token', async () => {
    const logoutRes = await fetch(`${baseUrl}/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${registeredToken}`,
      },
    });

    const logoutData = await logoutRes.json();
    assert.strictEqual(logoutRes.status, 200);
    assert.strictEqual(logoutData.success, true);

    // Verify token no longer works on /me
    const meRes = await fetch(`${baseUrl}/me`, {
      headers: {
        'Authorization': `Bearer ${registeredToken}`,
      },
    });

    assert.strictEqual(meRes.status, 401);
  });

  await test('16. Verify normal users cannot elevate permissions (strictly role: user)', async () => {
    const hackedUserEmail = `hackattempt_${Date.now()}@gmail.com`;
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Malicious Attacker',
        email: hackedUserEmail,
        password: 'HackerPassword123!',
        role: 'admin', // Malicious payload
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.user.role, 'user', 'Normal users must strictly receive role user');
  });

  server.close();

  console.log('\n==========================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
  console.log('==========================================');

  if (passedTests === totalTests) {
    console.log('🎉 ALL USER AUTHENTICATION TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  } else {
    console.error('⚠️ Some tests failed.');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
