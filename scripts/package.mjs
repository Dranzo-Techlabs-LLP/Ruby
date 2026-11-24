// Zips dist/ into release/rubys-portal-YYYYMMDD-HHMM.zip, laid out like public_html.
// Upload it to the rubys account's public_html, Extract, then delete the zip (see docs/DEPLOY.md).
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stamp, writeZip } from './zip.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')

if (!existsSync(join(dist, 'index.html')) || !existsSync(join(dist, '.htaccess'))) {
  console.error('\ndist/ is missing or incomplete. Run `npm run release`.\n')
  process.exit(1)
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name)
    const rel = relative(dist, abs).split(sep).join('/')
    if (statSync(abs).isDirectory()) {
      out.push({ name: `${rel}/`, dir: true })
      walk(abs, out)
    } else {
      out.push({ name: rel, data: readFileSync(abs) })
    }
  }
  return out
}

const entries = walk(dist)
// The portal has no server code or secrets; refuse anything that looks like either.
const bad = entries.filter((e) => /\.(php|env|sql|zip|gz)$|(^|\/)\.env/i.test(e.name))
if (bad.length) {
  console.error(`\nRefusing to package: ${bad.map((e) => e.name).join(', ')}\n`)
  process.exit(1)
}

mkdirSync(join(root, 'release'), { recursive: true })
const out = join(root, 'release', `rubys-portal-${stamp()}.zip`)
const size = writeZip(entries, out)
console.log(`\n${relative(root, out)}  (${entries.length} entries, ${(size / 1024).toFixed(0)} KB)\n`)
