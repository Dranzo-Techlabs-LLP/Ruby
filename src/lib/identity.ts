// ------------------------------------------------------------------
//  Who opened the portal, from Cloudflare Access (production only).
//  Access answers /cdn-cgi/access/get-identity on the portal's own domain
//  for a signed-in visitor. Locally there is no Access, so this stays null.
// ------------------------------------------------------------------
import { useEffect, useState } from 'react'

export interface PortalIdentity {
  email: string
  name: string
}

export const ACCESS_LOGOUT_URL = '/cdn-cgi/access/logout'

export function useIdentity(): PortalIdentity | null {
  const [identity, setIdentity] = useState<PortalIdentity | null>(null)

  useEffect(() => {
    if (!import.meta.env.PROD) return
    let alive = true
    fetch('/cdn-cgi/access/get-identity', { credentials: 'same-origin' })
      .then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : null))
      .then((d: unknown) => {
        if (!alive || !d || typeof d !== 'object') return
        const o = d as { email?: unknown; name?: unknown }
        if (typeof o.email !== 'string' || !o.email) return
        setIdentity({ email: o.email, name: typeof o.name === 'string' && o.name ? o.name : o.email })
      })
      .catch(() => { /* no Access in front: nothing to show */ })
    return () => { alive = false }
  }, [])

  return identity
}
