import { createServer } from 'http'
import { readFile, statSync, readFileSync } from 'fs'
import { extname, join, normalize, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { transform } = require('C:/t/sucrase')

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const PORT = 5174
const ROOT = __dirname
const NM = join(ROOT, 'node_modules')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.cjs': 'application/javascript; charset=utf-8',
}

function safePath(url) {
  const decoded = decodeURIComponent(url.split('?')[0])
  const cleaned = decoded.replace(/^\/+/, '')
  const full = normalize(join(ROOT, cleaned))
  if (!full.startsWith(ROOT)) return null
  return full
}

// Rewrite bare specifiers in import/export statements to "/<spec>" URLs
// so the browser can fetch them via the dev server.
// e.g. import { x } from "react" -> import { x } from "/react"
//      import "react/jsx-runtime" -> import "/react/jsx-runtime"
// Relative paths (./xxx, ../xxx) are left untouched (handled elsewhere).
function rewriteBareSpecifiers(code) {
  // Match: import ... from "spec"; export ... from "spec"; import "spec";
  // Only rewrite bare specifiers (not relative paths, not URLs, not data:)
  const isBare = (s) =>
    !s.startsWith('./') && !s.startsWith('../') &&
    !s.startsWith('/') && !s.startsWith('http://') &&
    !s.startsWith('https://') && !s.startsWith('data:') &&
    !s.startsWith('blob:') && !s.startsWith('node:')
  // Static imports/exports: import ... from "..." and export ... from "..."
  const staticPattern = /((?:import|export)\s+[^'";]*?from\s*['"])([^'"]+)(['"])/g
  code = code.replace(staticPattern, (match, prefix, spec, quote) => {
    if (!isBare(spec)) return match
    return `${prefix}/${spec}${quote}`
  })
  // Side-effect imports: import "...";
  const sideEffectPattern = /(import\s+['"])([^'"]+)(['"])/g
  code = code.replace(sideEffectPattern, (match, prefix, spec, quote) => {
    // Skip if it's part of a `from` (already handled above) - but the from pattern
    // is handled first; here we only catch standalone `import "..."`.
    // Use a simpler check: if preceded by `from` it's caught above, so this is fine.
    if (!isBare(spec)) return match
    return `${prefix}/${spec}${quote}`
  })
  // Dynamic imports: import("...")
  const dynamicPattern = /(import\s*\(\s*['"])([^'"]+)(['"]\s*\))/g
  code = code.replace(dynamicPattern, (match, prefix, spec, quote) => {
    if (!isBare(spec)) return match
    return `${prefix}/${spec}${quote}`
  })
  return code
}

function transpile(filePath) {
  return new Promise((resolve, reject) => {
    readFile(filePath, 'utf8', (err, code) => {
      if (err) return reject(err)
      try {
        const result = transform(code, {
          filePath,
          transforms: ['typescript', 'jsx'],
          jsxRuntime: 'automatic',
          production: true,
        })
        resolve(rewriteBareSpecifiers(result.code))
      } catch (e) {
        reject(e)
      }
    })
  })
}

function cssModule(css, href) {
  const escaped = css.replace(/\\/g, '\\\\').replace(/`/g, '\\`')
  return `
const css = \`${escaped}\`;
const style = document.createElement('style');
style.setAttribute('data-href', ${JSON.stringify(href)});
style.textContent = css;
document.head.appendChild(style);
export default { href: ${JSON.stringify(href)} };
`
}

function serveStatic(filePath, res) {
  const ext = extname(filePath)
  readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404)
      res.end('Not found')
      return
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
    res.end(data)
  })
}

// Read package.json's main/module/exports field to resolve entry file
function resolvePackageEntry(pkgDir) {
  try {
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
    if (pkg.module) return join(pkgDir, pkg.module)
    if (pkg.exports && pkg.exports['.'] && pkg.exports['.'].import) return join(pkgDir, pkg.exports['.'].import.default || pkg.exports['.'].import)
    if (pkg.exports && pkg.exports['.'] && typeof pkg.exports['.'] === 'string') return join(pkgDir, pkg.exports['.'])
    if (pkg.main) return join(pkgDir, pkg.main)
    return join(pkgDir, 'index.js')
  } catch {
    return join(pkgDir, 'index.js')
  }
}

// Resolve a bare module specifier to a file path
// Supports: 'react', 'react/jsx-runtime', 'react-dom/client', 'lodash/merge'
function resolveBare(specifier) {
  const parts = specifier.split('/')
  let pkgName, subPath
  if (specifier.startsWith('@')) {
    pkgName = parts.slice(0, 2).join('/')
    subPath = parts.slice(2).join('/')
  } else {
    pkgName = parts[0]
    subPath = parts.slice(1).join('/')
  }
  const pkgDir = join(NM, pkgName)
  if (!statSyncDir(pkgDir)) return null
  if (!subPath) {
    return resolvePackageEntry(pkgDir)
  }
  // Try to resolve subPath as file path within package
  const candidates = [
    join(pkgDir, subPath),
    join(pkgDir, subPath + '.js'),
    join(pkgDir, subPath + '.mjs'),
    join(pkgDir, subPath, 'index.js'),
    join(pkgDir, subPath, 'index.mjs'),
  ]
  for (const c of candidates) {
    if (statSyncSafe(c)) return c
  }
  // For react/jsx-runtime etc., try the entry field in package.json
  try {
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
    if (pkg.exports && pkg.exports['./' + subPath]) {
      const exp = pkg.exports['./' + subPath]
      const target = exp.import ? (exp.import.default || exp.import) : (typeof exp === 'string' ? exp : exp.default)
      if (target) {
        const full = join(pkgDir, target)
        if (statSyncSafe(full)) return full
      }
    }
  } catch { }
  return null
}

function statSyncSafe(p) {
  try { return statSync(p).isFile() } catch { return false }
}

function statSyncDir(p) {
  try { return statSync(p).isDirectory() } catch { return false }
}

// Resolve a require() specifier relative to the importing file
// Returns a URL path that the dev server can handle
function resolveBarePath(spec, fromFile) {
  // Relative path (./xxx or ../xxx)
  if (spec.startsWith('./') || spec.startsWith('../')) {
    return resolveRelToUrl(spec, fromFile)
  }
  // Bare specifier (react, react-dom/client) -> use same path
  return '/' + spec
}

// Resolve a relative path (./xxx or ../xxx) from a file to a URL path
// that the dev server can handle (starting with /node_modules/... or /src/...)
function resolveRelToUrl(rel, fromFile) {
  const fromDir = dirname(fromFile)
  let resolved = normalize(join(fromDir, rel))
  // Add extension if missing
  if (!extname(resolved)) {
    if (statSyncSafe(resolved + '.mjs')) resolved += '.mjs'
    else if (statSyncSafe(resolved + '.js')) resolved += '.js'
    else if (statSyncSafe(resolved + '.cjs')) resolved += '.cjs'
    else if (statSyncSafe(join(resolved, 'index.mjs'))) resolved = join(resolved, 'index.mjs')
    else if (statSyncSafe(join(resolved, 'index.js'))) resolved = join(resolved, 'index.js')
  }
  let urlPath = resolved.replace(/\\/g, '/')
  const rootNorm = ROOT.replace(/\\/g, '/')
  if (urlPath.startsWith(rootNorm)) {
    urlPath = urlPath.substring(rootNorm.length)
  }
  if (!urlPath.startsWith('/')) urlPath = '/' + urlPath
  return urlPath
}

// Rewrite relative import/export specifiers in ESM code to absolute URLs
// so the browser can resolve them correctly regardless of the serving URL.
// e.g. import { x } from "./chunk-ABC.mjs" -> import { x } from "/node_modules/pkg/dist/chunk-ABC.mjs"
function rewriteRelativeImports(code, fromFile) {
  // Static imports/exports: import ... from "..." and export ... from "..."
  const staticPattern = /((?:import|export)\s+[^'";]*?from\s*['"])(\.\/[^'"]+|\.\.\/[^'"]+)(['"])/g
  code = code.replace(staticPattern, (match, prefix, rel, quote) => {
    const urlPath = resolveRelToUrl(rel, fromFile)
    return `${prefix}${urlPath}${quote}`
  })
  // Dynamic imports: import("...")
  const dynamicPattern = /(import\s*\(\s*['"])(\.\/[^'"]+|\.\.\/[^'"]+)(['"]\s*\))/g
  code = code.replace(dynamicPattern, (match, prefix, rel, quote) => {
    const urlPath = resolveRelToUrl(rel, fromFile)
    return `${prefix}${urlPath}${quote}`
  })
  return code
}

const server = createServer(async (req, res) => {
  const url = req.url
  console.log(`${req.method} ${url}`)

  // Vite client shim (for IDE preview compatibility)
  if (url.split('?')[0] === '/@vite/client' || url.split('?')[0] === '/@react-refresh') {
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' })
    res.end('export default {}; export function createHotContext() { return { accept() {} } }')
    return
  }

  // Root -> serve built dist/index.html if available, otherwise dev HTML
  if (url === '/' || url === '/index.html') {
    // Prefer built dist/index.html (production build with all modules bundled)
    const distHtml = join(ROOT, 'dist', 'index.html')
    try {
      if (statSyncSafe(distHtml)) {
        let html = readFileSync(distHtml, 'utf8')
        // Inline the JS bundle directly into the HTML to bypass webview script-loading issues.
        // Find the script src and embed the file contents inline.
        const distDir = join(ROOT, 'dist')
        html = html.replace(/<script\s+type="module"\s+crossorigin\s+src="([^"]+)"><\/script>/g, (m, src) => {
          const filePath = join(distDir, src.replace(/^\//, ''))
          if (statSyncSafe(filePath)) {
            const code = readFileSync(filePath, 'utf8')
            return `<script>${code}</script>`
          }
          return m
        })
        html = html.replace(/<script\s+type="module"\s+src="([^"]+)"><\/script>/g, (m, src) => {
          const filePath = join(distDir, src.replace(/^\//, ''))
          if (statSyncSafe(filePath)) {
            const code = readFileSync(filePath, 'utf8')
            return `<script>${code}</script>`
          }
          return m
        })
        html = html.replace(/<script\s+crossorigin\s+src="([^"]+)"><\/script>/g, (m, src) => {
          const filePath = join(distDir, src.replace(/^\//, '').split('?')[0])
          if (statSyncSafe(filePath)) {
            const code = readFileSync(filePath, 'utf8')
            return `<script>${code}</script>`
          }
          return m
        })
        // Inline CSS too
        html = html.replace(/<link\s+rel="stylesheet"\s+crossorigin\s+href="([^"]+)">/g, (m, href) => {
          const filePath = join(distDir, href.replace(/^\//, '').split('?')[0])
          if (statSyncSafe(filePath)) {
            const css = readFileSync(filePath, 'utf8')
            return `<style>${css}</style>`
          }
          return m
        })
        // Disable caching headers
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        })
        res.end(html)
        return
      }
    } catch { }
    // Fallback: dev HTML
    try {
      const html = await new Promise((resolve, reject) => {
        readFile(join(ROOT, 'index-dev.html'), 'utf8', (e, d) => e ? reject(e) : resolve(d))
      })
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
      return
    } catch {
      res.writeHead(404)
      res.end('index-dev.html not found')
      return
    }
  }

  // Bare module imports: /node:react, /bare/react, /bare/react/jsx-runtime
  // We intercept non-file URLs that don't start with /src or /assets
  const pathOnly = url.split('?')[0]
  const cleaned = pathOnly.replace(/^\/+/, '')

  // Bare specifier resolution (react, react-dom, etc.)
  // Heuristic: no file extension and not a known static directory
  const isBare = !cleaned.startsWith('src/') &&
    !cleaned.startsWith('dist/') &&
    !cleaned.startsWith('public/') &&
    !cleaned.startsWith('assets/') &&
    !cleaned.startsWith('games/') &&
    !cleaned.startsWith('icons/') &&
    !cleaned.startsWith('node_modules/') &&
    !cleaned.includes('.') &&
    cleaned.length > 0

  // Handle /node_modules/xxx paths directly
  if (cleaned.startsWith('node_modules/')) {
    const filePath = join(ROOT, cleaned)
    if (statSyncSafe(filePath)) {
      const ext = extname(filePath)
      if (ext === '.js' || ext === '.cjs' || ext === '.mjs') {
        const code = readFileSync(filePath, 'utf8')
        if (/\b(require|module\.exports|exports\.)\b/.test(code) && !code.includes('export ')) {
          const exportNames = new Set()
          const exportMatches = code.matchAll(/^\s*exports\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=/gm)
          for (const m of exportMatches) exportNames.add(m[1])
          const hasModuleExports = /\bmodule\.exports\s*=/.test(code)
          const namedExports = [...exportNames].map(n => `export const ${n} = __mod.exports.${n};`).join('\n')
          const requirePattern = /require\(['"]([^'"]+)['"]\)/g
          const requires = new Map()
          let counter = 0
          const wrappedCode = code.replace(requirePattern, (match, spec) => {
            const varName = `__req_${counter++}`
            requires.set(varName, spec)
            return varName
          })
          const importStatements = [...requires.entries()].map(([varName, spec]) => {
            const reqResolved = resolveBarePath(spec, filePath)
            return `import * as ${varName}_ns from '${reqResolved}';
const ${varName} = ${varName}_ns.default || ${varName}_ns;`
          }).join('\n')
          const wrapped = `${importStatements}
const __mod = { exports: {} };
const module = __mod;
const exports = __mod.exports;
${wrappedCode}
${namedExports}
${hasModuleExports ? 'export default __mod.exports;' : 'export default __mod.exports;'}
`
          res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' })
          res.end(wrapped)
          return
        }
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' })
        res.end(rewriteRelativeImports(rewriteBareSpecifiers(code), filePath))
        return
      }
      serveStatic(filePath, res)
      return
    }
    res.writeHead(404)
    res.end(`Not found: ${url}`)
    return
  }

  if (isBare) {
    const resolved = resolveBare(cleaned)
    if (resolved) {
      const ext = extname(resolved)
      // Transpile .ts/.tsx
      if (ext === '.ts' || ext === '.tsx') {
        try {
          const code = await transpile(resolved)
          res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' })
          res.end(code)
          return
        } catch (e) {
          console.error('Transpile error (bare):', e.message)
          res.writeHead(500)
          res.end(`Transpile error: ${e.message}`)
          return
        }
      }
      // For CommonJS modules (.cjs or .js using CJS), wrap as ESM
      if (ext === '.js' || ext === '.cjs' || ext === '.mjs') {
        // Check if it's CJS by looking for module.exports/require
        const code = readFileSync(resolved, 'utf8')
        if (/\b(require|module\.exports|exports\.)\b/.test(code) && !code.includes('export ')) {
          // Find all exports.xxx = and module.exports = to create named exports
          const exportNames = new Set()
          // Match exports.xxx = ... (only top-level, simple names)
          const exportMatches = code.matchAll(/^\s*exports\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=/gm)
          for (const m of exportMatches) exportNames.add(m[1])
          // Match module.exports = ... (default export)
          const hasModuleExports = /\bmodule\.exports\s*=/.test(code)
          // Build named exports
          const namedExports = [...exportNames].map(n => `export const ${n} = __mod.exports.${n};`).join('\n')
          // Wrap CJS module as ESM, converting require() calls to import statements
          // We need to track requires and replace them
          const requirePattern = /require\(['"]([^'"]+)['"]\)/g
          const requires = new Map()
          let counter = 0
          const wrappedCode = code.replace(requirePattern, (match, spec) => {
            const varName = `__req_${counter++}`
            requires.set(varName, spec)
            return varName
          })
          // Generate import statements for requires
          const importStatements = [...requires.entries()].map(([varName, spec]) => {
            // Resolve relative to current package
            const reqResolved = resolveBarePath(spec, resolved)
            return `import * as ${varName}_ns from '${reqResolved}';
const ${varName} = ${varName}_ns.default || ${varName}_ns;`
          }).join('\n')
          const wrapped = `${importStatements}
const __mod = { exports: {} };
const module = __mod;
const exports = __mod.exports;
${wrappedCode}
${namedExports}
${hasModuleExports ? 'export default __mod.exports;' : 'export default __mod.exports;'}
`
          res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' })
          res.end(wrapped)
          return
        }
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' })
        res.end(rewriteRelativeImports(rewriteBareSpecifiers(code), resolved))
        return
      }
      serveStatic(resolved, res)
      return
    }
  }

  let filePath = safePath(url)
  if (!filePath) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  let ext = extname(filePath)

  // Extensionless imports (e.g., ./app/App) -> try common extensions
  if (!ext) {
    const tryExts = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs']
    for (const e of tryExts) {
      if (statSyncSafe(filePath + e)) { filePath = filePath + e; break }
    }
    if (!extname(filePath)) {
      // Try index files (e.g., ./components -> ./components/index.tsx)
      for (const ie of ['index.tsx', 'index.ts', 'index.jsx', 'index.js', 'index.mjs']) {
        const p = join(filePath, ie)
        if (statSyncSafe(p)) { filePath = p; break }
      }
    }
    ext = extname(filePath)
  }

  // TypeScript / TSX files -> transpile
  if (ext === '.ts' || ext === '.tsx') {
    try {
      const code = await transpile(filePath)
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' })
      res.end(code)
    } catch (e) {
      console.error('Transpile error:', e.message)
      res.writeHead(500)
      res.end(`Transpile error: ${e.message}`)
    }
    return
  }

  // CSS files -> serve as JS module (style injection)
  if (ext === '.css') {
    readFile(filePath, 'utf8', (err, css) => {
      if (err) {
        res.writeHead(404)
        res.end('Not found')
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' })
      res.end(cssModule(css, url))
    })
    return
  }

  // Vite environment variables shim
  if (url === '/vite-env' || filePath.endsWith('vite-env.d.ts')) {
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' })
    res.end('export default {};')
    return
  }

  // Static files
  try {
    statSync(filePath)
    serveStatic(filePath, res)
    return
  } catch {
    // Try public/ directory
    const publicPath = join(ROOT, 'public', url)
    try {
      statSync(publicPath)
      serveStatic(publicPath, res)
      return
    } catch {
      // Try dist/ directory for assets
      const distPath = join(ROOT, 'dist', url)
      try {
        statSync(distPath)
        serveStatic(distPath, res)
        return
      } catch {
        res.writeHead(404)
        res.end(`Not found: ${url}`)
      }
    }
  }
})

server.listen(PORT, () => {
  console.log(`\n  Dev server running at http://localhost:${PORT}/\n`)
})
