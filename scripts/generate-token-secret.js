#!/usr/bin/env node

const crypto = require('crypto');

// Generate a secure random JWT secret
const secret = crypto.randomBytes(32).toString('hex');

console.log('Generated JWT_SECRET:');
console.log(secret);
console.log('');
console.log('Add this to your environment variables on Render:');
console.log('JWT_SECRET=' + secret);
