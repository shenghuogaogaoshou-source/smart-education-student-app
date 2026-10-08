// Dev entry: dynamically import main.tsx and report errors
window.__dbg('dev-entry.js module script start');
import('./src/main.tsx').then(function () {
  window.__dbg('main.tsx loaded OK');
}).catch(function (err) {
  window.__dbg('main.tsx FAILED: ' + (err && err.message || err));
  console.error('main.tsx FAILED:', err);
});
