#!/usr/bin/env node
// Small helper to fetch /api/v2/diag and validate required keys.
// Usage: node scripts/diag-check.js [baseUrl] [accessToken]
const http = require('http');
const https = require('https');
const { URL } = require('url');

const base = process.argv[2] || 'http://localhost:5051';
const token = process.argv[3] || process.env.DIAG_TOKEN || process.env.DIAG_ACCESS_TOKEN || '';
const diagPath = base.replace(/\/$/, '') + '/api/v2/diag';

function fetchJson(u, bearer) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(u);
    const lib = parsed.protocol === 'https:' ? https : http;
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + (parsed.search || ''),
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    };
    if (bearer) {
      opts.headers['Authorization'] = `Bearer ${bearer}`;
    }

    const req = lib.request(opts, (res) => {
      const { statusCode } = res;
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        if (statusCode < 200 || statusCode >= 300) {
          // try to parse body for more context
          try {
            const parsedBody = JSON.parse(raw);
            return reject(new Error(`Status ${statusCode} - ${JSON.stringify(parsedBody)}`));
          } catch (e) {
            return reject(new Error(`Status ${statusCode} - ${raw.slice(0, 200)}`));
          }
        }
        try {
          const parsed = JSON.parse(raw);
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

(async function main(){
  try{
    const diag = await fetchJson(diagPath, token);
    // Validate response structure: vehicles and jobs should be numbers, users should be an array
    const ok = diag
      && typeof diag.vehicles === 'number'
      && typeof diag.jobs === 'number'
      && Array.isArray(diag.users);
    if(!ok){
      console.error('Diag missing or invalid fields. Expected: {vehicles: number, jobs: number, users: array}');
      console.error('Received:', Object.keys(diag||{}), '=', JSON.stringify(diag));
      process.exit(2);
    }
    console.log('Diag OK:', Object.keys(diag));
    console.log('  - vehicles:', diag.vehicles);
    console.log('  - jobs:', diag.jobs);
    console.log('  - users:', diag.users.length);
    process.exit(0);
  }catch(e){
    console.error('Failed to fetch diag:', e && e.message);
    process.exit(3);
  }
})();
