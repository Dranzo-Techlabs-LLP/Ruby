// ------------------------------------------------------------------
//  Portal addresses:  /ww/<admin page>   and   /tt/<admin page>
//  e.g. /tt/bookings/TT-00012 shows Teak Town's booking TT-00012.
//  The choice is also remembered in localStorage, so "/" reopens it.
// ------------------------------------------------------------------
import { APPS, type AppId } from '../apps'

const LAST_APP_KEY = 'rubys.lastApp'

/**
 * An admin page path that is safe to put after /admin: starts with one "/",
 * no backslashes, no "//", no "..", no control characters, and not too long.
 */
export function cleanPath(value: unknown): string {
  if (typeof value !== 'string' || value.length > 512) return '/'
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f]/.test(value) || /(^|\/)\.\.(\/|$|\?)/.test(value)) return '/'
  return value
}

export function parseLocation(loc: Location): { app: AppId | null; path: string } {
  const m = /^\/(ww|tt)(\/.*)?$/.exec(loc.pathname)
  if (!m) return { app: null, path: '/' }
  return { app: m[1] as AppId, path: cleanPath((m[2] || '/') + loc.search) }
}

export function portalPath(app: AppId, path: string): string {
  return `/${app}${path === '/' ? '' : path}`
}

export function recallApp(): AppId | null {
  try {
    const v = localStorage.getItem(LAST_APP_KEY)
    return APPS.some((a) => a.id === v) ? (v as AppId) : null
  } catch {
    return null
  }
}

export function rememberApp(app: AppId): void {
  try { localStorage.setItem(LAST_APP_KEY, app) } catch { /* private mode: fine */ }
}
