// Zips one admin's built frontend (its dist/admin) as admin/... for upload to that
// account's public_html. Only the admin frontend: the API, config.php, the website
// and the database are not in it.
//
//   node scripts/package-admin.mjs C:/TeakTownAdmin teaktown
//   -> release/teaktown-admin-portal-YYYYMMDD-HHMM.zip
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stamp, writeZip } from './zip.mjs'

const [project, label] = process.argv.slice(2)
if (!project || !label) {
  console.error('Usage: node scripts/package-admin.mjs <admin project folder> <label>')
  process.exit(1)
}
const adminDir = join(project, 'dist', 'admin')
if (!existsSync(join(adminDir, 'index.html')) || !existsSync(join(adminDir, '.htaccess'))) {
  console.error(`\n${adminDir} is missing or incomplete. Run \`npm run build\` in ${project}.\n`)
  process.exit(1)
}
const base = join(project, 'dist')

function walk(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name)
    const rel = relative(base, abs).split(sep).join('/')
    if (statSync(abs).isDirectory()) {
      out.push({ name: `${rel}/`, dir: true })
      walk(abs, out)
    } else {
      out.push({ name: rel, data: readFileSync(abs) })
    }
  }
  return out
}

const entries = [{ name: 'admin/', dir: true }, ...walk(adminDir)]
const bad = entries.filter((e) => !e.name.startsWith('admin/') || /\.(php|sql|env|zip|gz)$/i.test(e.name))
if (bad.length) {
  console.error(`\nRefusing to package: ${bad.map((e) => e.name).join(', ')}\n`)
  process.exit(1)
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
mkdirSync(join(root, 'release'), { recursive: true })
const out = join(root, 'release', `${label}-admin-portal-${stamp()}.zip`)
const size = writeZip(entries, out)
console.log(`${relative(root, out)}  (${entries.length} entries, ${(size / 1024).toFixed(0)} KB)`)
