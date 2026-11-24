// Production build of the portal into dist/, laid out like public_html:
//   index.html, assets/, apps/, favicon.svg and a generated .htaccess.
//
// Refuses to build unless both admin addresses in .env.production are real
// https origins, because a wrong address would frame the wrong site.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, loadEnv } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function fail(message) {
  console.error(`\n${message}\n`)
  process.exit(1)
}

const env = loadEnv('production', root, 'VITE_')
const origins = {
  VITE_WW_ORIGIN: (env.VITE_WW_ORIGIN ?? '').trim(),
  VITE_TT_ORIGIN: (env.VITE_TT_ORIGIN ?? '').trim(),
}
for (const [key, value] of Object.entries(origins)) {
  if (!value) fail(`${key} is blank in .env.production. Set it to the admin's https address (e.g. https://example.com).`)
  let u
  try { u = new URL(value) } catch { fail(`${key}="${value}" is not an address.`) }
  if (u.protocol !== 'https:' || u.origin !== value) {
    fail(`${key}="${value}" must be an https origin only: https://host, with no path or trailing slash.`)
  }
}
if (origins.VITE_WW_ORIGIN === origins.VITE_TT_ORIGIN) fail('The two admins must have different addresses.')

await build({ root, mode: 'production', logLevel: 'info' })

const frameSrc = `${origins.VITE_WW_ORIGIN} ${origins.VITE_TT_ORIGIN}`
const htaccess = readFileSync(join(root, 'deploy', 'htaccess.template'), 'utf8').replaceAll('__FRAME_SRC__', frameSrc)
writeFileSync(join(root, 'dist', '.htaccess'), htaccess.replace(/\r\n/g, '\n'))

console.log(`\nPortal built in dist/. It frames:\n  Whispering Willows  ${origins.VITE_WW_ORIGIN}/admin/\n  TeakTown            ${origins.VITE_TT_ORIGIN}/admin/\n`)
