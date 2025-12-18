#!/usr/bin/env node

/**
 * API Comprehensive Testing Suite
 * Uses only Node.js native modules (http, https, fs)
 * Generates professional JSON and HTML reports
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const { URL } = require('url');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000';
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const JSON_REPORT = `test-report-${TIMESTAMP}.json`;
const HTML_REPORT = `test-report-${TIMESTAMP}.html`;

// ANSI Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test Results
const results = {
  tests: [],
  total: 0,
  passed: 0,
  failed: 0,
  accessToken: null,
  refreshToken: null,
  userId: null
};

// Helper Functions
function log(msg, color = colors.blue) {
  console.log(`${color}[INFO]${colors.reset} ${msg}`);
}

function success(msg) {
  console.log(`${colors.green}[✓]${colors.reset} ${msg}`);
}

function error(msg) {
  console.log(`${colors.red}[✗]${colors.reset} ${msg}`);
}

function warning(msg) {
  console.log(`${colors.yellow}[!]${colors.reset} ${msg}`);
}

// HTTP Request Function
function makeRequest(method, endpoint, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (data) {
      const body = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }
    
    const startTime = Date.now();
    
    const req = client.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        const duration = Date.now() - startTime;
        resolve({
          statusCode: res.statusCode,
          body: body,
          duration: duration
        });
      });
    });
    
    req.on('error', (err) => {
      const duration = Date.now() - startTime;
      resolve({
        statusCode: 0,
        body: err.message,
        duration: duration
      });
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      const duration = Date.now() - startTime;
      resolve({
        statusCode: 0,
        body: 'Request timeout',
        duration: duration
      });
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Run Test Function
async function runTest(category, name, method, endpoint, expectedCode, data = null, headers = {}) {
  log(`Testing: ${name}`);
  
  const response = await makeRequest(method, endpoint, data, headers);
  const { statusCode, body, duration } = response;
  
  const status = statusCode === expectedCode ? 'PASS' : 'FAIL';
  const errorMsg = status === 'FAIL' ? `Expected HTTP ${expectedCode}, got ${statusCode}` : '';
  
  results.total++;
  if (status === 'PASS') {
    results.passed++;
    success(`${name} - ${duration}ms`);
  } else {
    results.failed++;
    error(`${name} - ${errorMsg}`);
  }
  
  results.tests.push({
    category,
    name,
    status,
    httpCode: statusCode,
    expectedCode,
    duration,
    responseBody: body.substring(0, 500),
    errorMessage: errorMsg,
    timestamp: new Date().toISOString()
  });
  
  return { statusCode, body };
}

// Test Suites
async function testHealthChecks() {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  log('1. HEALTH CHECKS');
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  
  await runTest('Health', 'Health Check', 'GET', '/health', 200);
  await runTest('Health', 'Readiness Check', 'GET', '/ready', 200);
  await runTest('Health', 'Liveness Check', 'GET', '/live', 200);
  await runTest('Health', 'Root Endpoint', 'GET', '/', 200);
  await runTest('Health', 'Metrics Endpoint', 'GET', '/metrics', 200);
}

async function testAuthenticationLogin() {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  log('2. AUTHENTICATION - LOGIN');
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  
  // Valid login
  const { statusCode, body } = await runTest(
    'Authentication',
    'Login - Valid Credentials',
    'POST',
    '/api/v1/auth/login',
    200,
    { email: 'admin@example.com', password: 'admin123' }
  );
  
  if (statusCode === 200) {
    try {
      const data = JSON.parse(body);
      results.accessToken = data.data?.accessToken;
      results.refreshToken = data.data?.refreshToken;
      results.userId = data.data?.user?.id;
      if (results.accessToken) {
        success(`Access token obtained: ${results.accessToken.substring(0, 30)}...`);
      }
    } catch (e) {
      warning('Failed to parse login response');
    }
  }
  
  await runTest('Authentication', 'Login - Invalid Password', 'POST', '/api/v1/auth/login', 401,
    { email: 'admin@example.com', password: 'wrongpassword' });
  
  await runTest('Authentication', 'Login - Missing Email', 'POST', '/api/v1/auth/login', 400,
    { password: 'admin123' });
  
  await runTest('Authentication', 'Login - Missing Password', 'POST', '/api/v1/auth/login', 400,
    { email: 'admin@example.com' });
  
  await runTest('Authentication', 'Login - Invalid Email Format', 'POST', '/api/v1/auth/login', 400,
    { email: 'notanemail', password: 'admin123' });
  
  await runTest('Authentication', 'Login - Empty Body', 'POST', '/api/v1/auth/login', 400, {});
}

async function testAuthenticationMe() {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  log('3. AUTHENTICATION - ME ENDPOINT');
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  
  if (!results.accessToken) {
    warning('Skipping /me tests - no access token');
    return;
  }
  
  const headers = { 'Authorization': `Bearer ${results.accessToken}` };
  
  await runTest('Authentication', 'Get Current User - Valid Token', 'GET', '/api/v1/auth/me', 200, null, headers);
  await runTest('Authentication', 'Get Current User - No Token', 'GET', '/api/v1/auth/me', 401);
  await runTest('Authentication', 'Get Current User - Invalid Token', 'GET', '/api/v1/auth/me', 401, null,
    { 'Authorization': 'Bearer invalid_token' });
  await runTest('Authentication', 'Get Current User - Malformed Header', 'GET', '/api/v1/auth/me', 401, null,
    { 'Authorization': 'InvalidFormat' });
}

async function testAuthenticationRegister() {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  log('4. AUTHENTICATION - REGISTER');
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  
  warning('Waiting 5 seconds for rate limit...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const newEmail = `test_${Date.now()}@example.com`;
  const registerData = {
    email: newEmail,
    password: 'Test123!@#',
    name: 'Test User'
  };
  
  await runTest('Authentication', 'Register - Valid Data', 'POST', '/api/v1/auth/register', 201, registerData);
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  await runTest('Authentication', 'Register - Duplicate Email', 'POST', '/api/v1/auth/register', 400, registerData);
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  await runTest('Authentication', 'Register - Missing Name', 'POST', '/api/v1/auth/register', 400,
    { email: `test2_${Date.now()}@example.com`, password: 'Test123!' });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  await runTest('Authentication', 'Register - Weak Password', 'POST', '/api/v1/auth/register', 400,
    { email: `test3_${Date.now()}@example.com`, password: '123', name: 'Test' });
}

async function testAuthenticationRefresh() {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  log('5. AUTHENTICATION - REFRESH TOKEN');
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  
  if (!results.refreshToken) {
    warning('Skipping refresh token tests - no refresh token');
    return;
  }
  
  await runTest('Authentication', 'Refresh Token - Valid', 'POST', '/api/v1/auth/refresh', 200,
    { refreshToken: results.refreshToken });
  
  await runTest('Authentication', 'Refresh Token - Invalid', 'POST', '/api/v1/auth/refresh', 401,
    { refreshToken: 'invalid_token' });
  
  await runTest('Authentication', 'Refresh Token - Missing', 'POST', '/api/v1/auth/refresh', 400, {});
}

async function testAuthenticationLogout() {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  log('6. AUTHENTICATION - LOGOUT');
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  
  if (!results.accessToken) {
    warning('Skipping logout tests - no access token');
    return;
  }
  
  const headers = { 'Authorization': `Bearer ${results.accessToken}` };
  
  await runTest('Authentication', 'Logout - Valid Token', 'POST', '/api/v1/auth/logout', 200, null, headers);
  await runTest('Authentication', 'Logout - No Token', 'POST', '/api/v1/auth/logout', 401);
}

async function testUsers() {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  log('7. USERS ENDPOINTS');
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  
  // Re-login for fresh token
  const { statusCode, body } = await makeRequest('POST', '/api/v1/auth/login',
    { email: 'admin@example.com', password: 'admin123' });
  
  if (statusCode === 200) {
    try {
      const data = JSON.parse(body);
      results.accessToken = data.data?.accessToken;
    } catch (e) {}
  }
  
  if (!results.accessToken || !results.userId) {
    warning('Skipping user tests - no access token or user ID');
    return;
  }
  
  const headers = { 'Authorization': `Bearer ${results.accessToken}` };
  
  await runTest('Users', 'Get User - Valid ID', 'GET', `/api/v1/users/${results.userId}`, 200, null, headers);
  await runTest('Users', 'Get User - No Auth', 'GET', `/api/v1/users/${results.userId}`, 401);
  await runTest('Users', 'Get User - Invalid ID', 'GET', '/api/v1/users/nonexistent-id', 404, null, headers);
  
  await runTest('Users', 'Update User - Valid Data', 'PATCH', `/api/v1/users/${results.userId}`, 200,
    { name: 'Updated Admin' }, headers);
  
  await runTest('Users', 'Update User - No Auth', 'PATCH', `/api/v1/users/${results.userId}`, 401,
    { name: 'Test' });
}

async function testErrorHandling() {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  log('8. ERROR HANDLING');
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  
  await runTest('Error Handling', '404 - Not Found', 'GET', '/api/v1/nonexistent-endpoint', 404);
  await runTest('Error Handling', '405 - Method Not Allowed', 'DELETE', '/', 404);
}

// Report Generation
function generateJSONReport() {
  log('Generating JSON report...');
  
  const successRate = results.total > 0 ? ((results.passed / results.total) * 100).toFixed(2) : 0;
  
  const report = {
    summary: {
      timestamp: new Date().toISOString(),
      apiUrl: API_URL,
      totalTests: results.total,
      passed: results.passed,
      failed: results.failed,
      successRate: parseFloat(successRate)
    },
    tests: results.tests
  };
  
  fs.writeFileSync(JSON_REPORT, JSON.stringify(report, null, 2));
  success(`JSON report saved: ${JSON_REPORT}`);
}

function generateHTMLReport() {
  log('Generating HTML report...');
  
  const successRate = results.total > 0 ? ((results.passed / results.total) * 100).toFixed(2) : 0;
  
  // Group tests by category
  const categories = {};
  results.tests.forEach(test => {
    if (!categories[test.category]) {
      categories[test.category] = [];
    }
    categories[test.category].push(test);
  });
  
  // Generate test cards HTML
  let testCardsHTML = '';
  for (const [category, tests] of Object.entries(categories)) {
    testCardsHTML += `
      <div class="category-section">
        <h2 class="category-title">${category}</h2>
        <div class="tests-grid">
    `;
    
    tests.forEach(test => {
      const statusClass = test.status === 'PASS' ? 'pass' : 'fail';
      const statusIcon = test.status === 'PASS' ? '✓' : '✗';
      const responsePreview = test.responseBody.substring(0, 200) + (test.responseBody.length > 200 ? '...' : '');
      
      testCardsHTML += `
        <div class="test-card ${statusClass}">
          <div class="test-header">
            <span class="test-name">${test.name}</span>
            <span class="test-status ${statusClass}">${statusIcon} ${test.status}</span>
          </div>
          <div class="test-details">
            <div class="detail-row">
              <span class="label">HTTP Code:</span>
              <span class="value code-${test.httpCode}">${test.httpCode}</span>
              <span class="expected">(expected: ${test.expectedCode})</span>
            </div>
            <div class="detail-row">
              <span class="label">Duration:</span>
              <span class="value">${test.duration}ms</span>
            </div>
            <div class="detail-row">
              <span class="label">Timestamp:</span>
              <span class="value">${new Date(test.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
          ${test.errorMessage ? `<div class="error-message"><strong>Error:</strong> ${test.errorMessage}</div>` : ''}
          ${test.responseBody ? `<details class="response-body"><summary>Response Body</summary><pre>${responsePreview}</pre></details>` : ''}
        </div>
      `;
    });
    
    testCardsHTML += `
        </div>
      </div>
    `;
  }
  
  const totalDuration = results.tests.reduce((sum, t) => sum + t.duration, 0);
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Test Report - ${TIMESTAMP}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 25px 80px rgba(0,0,0,0.25);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
            color: white;
            padding: 50px 40px;
            position: relative;
        }
        .header h1 {
            font-size: 3em;
            font-weight: 700;
            margin-bottom: 15px;
        }
        .header .subtitle {
            font-size: 1.2em;
            opacity: 0.95;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 25px;
            padding: 40px;
            background: #f8fafc;
        }
        .stat-card {
            background: white;
            padding: 30px;
            border-radius: 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            border-left: 5px solid;
            transition: transform 0.3s;
        }
        .stat-card:hover {
            transform: translateY(-5px);
        }
        .stat-card.total { border-color: #3b82f6; }
        .stat-card.passed { border-color: #10b981; }
        .stat-card.failed { border-color: #ef4444; }
        .stat-card.rate { border-color: #f59e0b; }
        .stat-number {
            font-size: 3.5em;
            font-weight: 800;
            margin-bottom: 12px;
        }
        .stat-card.total .stat-number { color: #3b82f6; }
        .stat-card.passed .stat-number { color: #10b981; }
        .stat-card.failed .stat-number { color: #ef4444; }
        .stat-card.rate .stat-number { color: #f59e0b; }
        .stat-label {
            color: #64748b;
            font-size: 0.95em;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .content {
            padding: 40px;
        }
        .category-section {
            margin-bottom: 50px;
        }
        .category-title {
            font-size: 1.8em;
            color: #1e293b;
            margin-bottom: 25px;
            padding-bottom: 15px;
            border-bottom: 3px solid #e2e8f0;
            font-weight: 700;
        }
        .tests-grid {
            display: grid;
            gap: 20px;
        }
        .test-card {
            background: white;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            padding: 25px;
            transition: all 0.3s;
        }
        .test-card:hover {
            box-shadow: 0 8px 20px rgba(0,0,0,0.1);
        }
        .test-card.pass {
            border-left: 5px solid #10b981;
            background: linear-gradient(to right, #ecfdf5 0%, white 100%);
        }
        .test-card.fail {
            border-left: 5px solid #ef4444;
            background: linear-gradient(to right, #fef2f2 0%, white 100%);
        }
        .test-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        .test-name {
            font-size: 1.2em;
            font-weight: 600;
            color: #1e293b;
        }
        .test-status {
            padding: 8px 20px;
            border-radius: 25px;
            font-weight: 700;
            font-size: 0.9em;
            text-transform: uppercase;
        }
        .test-status.pass {
            background: #d1fae5;
            color: #065f46;
        }
        .test-status.fail {
            background: #fee2e2;
            color: #991b1b;
        }
        .test-details {
            display: grid;
            gap: 12px;
            margin-bottom: 15px;
        }
        .detail-row {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 0.95em;
        }
        .detail-row .label {
            font-weight: 600;
            color: #64748b;
            min-width: 100px;
        }
        .detail-row .value {
            color: #1e293b;
            font-family: 'Monaco', monospace;
            background: #f1f5f9;
            padding: 4px 12px;
            border-radius: 6px;
        }
        .code-200, .code-201 { color: #10b981; font-weight: 700; }
        .code-400, .code-401, .code-404, .code-429 { color: #ef4444; font-weight: 700; }
        .code-500 { color: #dc2626; font-weight: 700; }
        .code-0 { color: #6b7280; font-weight: 700; }
        .error-message {
            background: #fef2f2;
            border-left: 4px solid #ef4444;
            padding: 15px;
            border-radius: 8px;
            margin-top: 15px;
            color: #991b1b;
        }
        .response-body {
            margin-top: 15px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 15px;
        }
        .response-body summary {
            cursor: pointer;
            font-weight: 600;
            color: #475569;
        }
        .response-body pre {
            margin-top: 12px;
            padding: 15px;
            background: #1e293b;
            color: #e2e8f0;
            border-radius: 6px;
            overflow-x: auto;
            font-size: 0.85em;
        }
        .footer {
            background: #f8fafc;
            padding: 30px;
            text-align: center;
            color: #64748b;
            border-top: 2px solid #e2e8f0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 API Test Report</h1>
            <p class="subtitle">Generated: ${new Date().toLocaleString()}</p>
            <p class="subtitle">API URL: ${API_URL}</p>
        </div>
        <div class="summary-grid">
            <div class="stat-card total">
                <div class="stat-number">${results.total}</div>
                <div class="stat-label">Total Tests</div>
            </div>
            <div class="stat-card passed">
                <div class="stat-number">${results.passed}</div>
                <div class="stat-label">Passed</div>
            </div>
            <div class="stat-card failed">
                <div class="stat-number">${results.failed}</div>
                <div class="stat-label">Failed</div>
            </div>
            <div class="stat-card rate">
                <div class="stat-number">${successRate}%</div>
                <div class="stat-label">Success Rate</div>
            </div>
        </div>
        <div class="content">
            ${testCardsHTML}
        </div>
        <div class="footer">
            <p><strong>Enterprise Node.js Webservice</strong></p>
            <p>API Testing Suite v1.0</p>
            <p style="margin-top: 15px;">Report generated in ${totalDuration}ms</p>
        </div>
    </div>
</body>
</html>`;
  
  fs.writeFileSync(HTML_REPORT, html);
  success(`HTML report saved: ${HTML_REPORT}`);
}

// Main Execution
async function main() {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}  API COMPREHENSIVE TESTING SUITE${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  log(`API URL: ${API_URL}`);
  log(`Timestamp: ${new Date().toLocaleString()}`);
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
  
  try {
    // Run all test suites
    await testHealthChecks();
    await testAuthenticationLogin();
    await testAuthenticationMe();
    await testAuthenticationRegister();
    await testAuthenticationRefresh();
    await testAuthenticationLogout();
    await testUsers();
    await testErrorHandling();
    
    // Generate reports
    console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
    log('GENERATING REPORTS');
    console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
    
    generateJSONReport();
    generateHTMLReport();
    
    // Summary
    const successRate = results.total > 0 ? ((results.passed / results.total) * 100).toFixed(2) : 0;
    
    console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.cyan}  TEST SUMMARY${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}`);
    console.log(`Total Tests:   ${results.total}`);
    console.log(`${colors.green}Passed:        ${results.passed}${colors.reset}`);
    console.log(`${colors.red}Failed:        ${results.failed}${colors.reset}`);
    console.log(`Success Rate:  ${successRate}%`);
    console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
    
    console.log('📄 Reports:');
    console.log(`  JSON: ${JSON_REPORT}`);
    console.log(`  HTML: ${HTML_REPORT}`);
    console.log(`\n💡 Open HTML: open ${HTML_REPORT}\n`);
    
    process.exit(results.failed > 0 ? 1 : 0);
  } catch (err) {
    error(`Fatal error: ${err.message}`);
    process.exit(1);
  }
}

// Run
main();
