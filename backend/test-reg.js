const http = require('http');

// Test 1: Register with any email (no domain restriction)
const data = JSON.stringify({
  fullName: "Jane Smith",
  workEmail: "jane.smith@gmail.com",
  department: "HR",
  designation: "HR Manager",
  password: "password123",
  employeeId: "EMP-JANE"
});

const req = http.request({
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/register',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const parsed = JSON.parse(body);
    if (parsed.success) {
      console.log('✅ Registration WORKS! User:', parsed.user.name, '| Role:', parsed.user.role);
      console.log('   Token:', parsed.token ? 'received ✓' : 'MISSING ✗');
    } else {
      console.log('❌ Registration FAILED:', parsed.message);
    }
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(data);
req.end();
