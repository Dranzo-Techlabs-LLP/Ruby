// ------------------------------------------------------------------
//  The admin panels the portal can show.
//
//  Each one is the real admin, running on its own domain with its own API,
//  database, users and roles. The portal only frames <origin>/admin/ and
//  never talks to either API itself.
// ------------------------------------------------------------------

export type AppId = 'ww' | 'tt'

export interface AdminApp {
  id: AppId
  /** Shown in the switcher and the top bar. */
  name: string
  /** Where the live admin runs, e.g. https://theteaktown.com (from .env.*). */
  origin: string
  /** Logo in public/apps/. */
  logo: string
  /** Top-bar stripe and badge colour. */
  accent: string
  /** The admin's own sidebar colour, used for the loading placeholder. */
  sidebar: string
  /** The admin's own page colour, used for the loading placeholder. */
  canvas: string
}

const env = import.meta.env

function cleanOrigin(value: string | undefined): string {
  const v = (value ?? '').trim().replace(/\/+$/, '')
  try {
    const u = new URL(v)
    return u.origin === v ? v : ''
  } catch {
    return ''
  }
}

export const APPS: AdminApp[] = [
  {
    id: 'ww',
    name: 'Whispering Willows',
    origin: cleanOrigin(env.VITE_WW_ORIGIN),
    logo: '/apps/whispering-willows.png',
    accent: '#4fa3a9',
    sidebar: '#0c2529',
    canvas: '#faf7f0',
  },
  {
    id: 'tt',
    name: 'TeakTown',
    origin: cleanOrigin(env.VITE_TT_ORIGIN),
    logo: '/apps/teaktown.png',
    accent: '#c4a56a',
    sidebar: '#13261f',
    canvas: '#f7f4ee',
  },
]

/** Opened when there is no earlier choice. */
export const DEFAULT_APP: AppId = 'ww'

export function appById(id: AppId): AdminApp {
  return APPS.find((a) => a.id === id)!
}

/** The admin page `path` (e.g. "/bookings/TT-00012"), framed in embed mode. */
export function frameUrl(app: AdminApp, path: string): string {
  const url = new URL(`/admin${path === '/' ? '/' : path}`, app.origin)
  url.searchParams.set('embed', 'rubys')
  return url.toString()
}

/** The admin opened on its own, for "Open in new tab". */
export function directUrl(app: AdminApp, path: string): string {
  return new URL(`/admin${path}`, app.origin).toString()
}
