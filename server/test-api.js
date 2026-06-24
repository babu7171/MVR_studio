// test-api.js — Quick API test script
const http = require('http');

function httpRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function runTests() {
  console.log('\n🧪 MVR Studio API Test Suite\n' + '='.repeat(40));

  // Test 1: Health
  const health = await httpRequest('GET', '/api/health');
  console.log(`\n[1] Health Check: ${health.status === 200 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`    Status: ${health.body.status}, Server: ${health.body.server}`);

  // Test 2: Services
  const services = await httpRequest('GET', '/api/services');
  console.log(`\n[2] GET /api/services: ${services.status === 200 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`    Found ${services.body.services?.length} services`);

  // Test 3: Gallery
  const gallery = await httpRequest('GET', '/api/gallery');
  console.log(`\n[3] GET /api/gallery: ${gallery.status === 200 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`    Found ${gallery.body.gallery?.length} items`);

  // Test 4: Login with correct password
  const login = await httpRequest('POST', '/api/auth/login', { password: 'mvr@123' });
  console.log(`\n[4] POST /api/auth/login (correct): ${login.status === 200 ? '✅ PASS' : '❌ FAIL'}`);
  if (login.body.token) {
    console.log(`    JWT token received: ${login.body.token.substring(0, 30)}...`);
    const token = login.body.token;

    // Test 5: Login with wrong password
    const badLogin = await httpRequest('POST', '/api/auth/login', { password: 'wrongpass' });
    console.log(`\n[5] POST /api/auth/login (wrong pass): ${badLogin.status === 401 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`    Error: ${badLogin.body.error}`);

    // Test 6: Enquiries (protected, should work with token)
    const enqResp = await httpRequest('GET', '/api/enquiries');
    // Without token, should be 401
    console.log(`\n[6] GET /api/enquiries (no auth): ${enqResp.status === 401 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`    Got expected 401: ${enqResp.body.error}`);
  }

  console.log('\n' + '='.repeat(40));
  console.log('✅ All tests completed!\n');
}

runTests().catch(console.error);
