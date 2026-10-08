console.log('hello world');
try {
  const r = require('react');
  console.log('react ok, keys:', Object.keys(r).slice(0,5));
} catch(e) { console.log('react fail:', e.message); }
