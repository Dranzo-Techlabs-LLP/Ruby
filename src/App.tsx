import { useCallback, useEffect, useRef, useState } from 'react'
import { APPS, DEFAULT_APP, appById, type AppId } from './apps'
import { AdminFrame } from './components/AdminFrame'
import { TopBar } from './components/TopBar'
import { ACCESS_LOGOUT_URL, useIdentity } from './lib/identity'
import { cleanPath, parseLocation, portalPath, recallApp, rememberApp } from './lib/route'
import type { AdminUser, FrameState } from './types'

// ------------------------------------------------------------------
//  Messages
//  admin -> portal  { source: 'rubys-admin',  type: 'state', path, user }
//  portal -> admin  { source: 'rubys-portal', type: 'logout' | 'ping' }
//  Accepted only from the admin's exact origin AND from that admin's own frame.
// ------------------------------------------------------------------

function cleanUser(value: unknown): AdminUser | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const str = (x: unknown) => (typeof x === 'string' ? x.slice(0, 120) : '')
  const name = str(v.name)
  return name ? { name, email: str(v.email), role: str(v.role) } : null
}

function initialFrames(first: AppId, path: string): Record<AppId, FrameState> {
  const blank = (id: AppId): FrameState => ({
    mounted: id === first,
    srcPath: id === first ? path : '/',
    reloadKey: 0,
    loaded: false,
    connected: false,
    stalled: false,
    path: id === first ? path : '/',
    user: null,
  })
  return Object.fromEntries(APPS.map((a) => [a.id, blank(a.id)])) as Record<AppId, FrameState>
}

const start = parseLocation(window.location)
const firstApp: AppId = start.app ?? recallApp() ?? DEFAULT_APP
const firstPath = start.app ? start.path : '/'

export default function App() {
  const [activeId, setActiveId] = useState<AppId>(firstApp)
  const [frames, setFrames] = useState(() => initialFrames(firstApp, firstPath))
  const [signingOut, setSigningOut] = useState(false)
  const identity = useIdentity()

  const frameRefs = useRef<Partial<Record<AppId, HTMLIFrameElement | null>>>({})
  const framesRef = useRef(frames)
  framesRef.current = frames

  const active = appById(activeId)
  const patch = useCallback((id: AppId, p: Partial<FrameState>) => {
    setFrames((f) => ({ ...f, [id]: { ...f[id], ...p } }))
  }, [])

  // Keep the address bar and title on the panel and page being shown,
  // so a refresh or a copied link opens the same place.
  const activePath = frames[activeId].path
  useEffect(() => {
    const target = portalPath(activeId, activePath)
    if (window.location.pathname + window.location.search !== target) {
      window.history.replaceState(null, '', target)
    }
    document.title = `${active.name} · Rubys Admin`
  }, [activeId, activePath, active.name])

  // Messages from the admins.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const app = APPS.find((a) => a.origin && a.origin === e.origin)
      if (!app) return
      const frame = frameRefs.current[app.id]
      if (!frame || e.source !== frame.contentWindow) return
      const d = e.data as { source?: unknown; type?: unknown; path?: unknown; user?: unknown } | null
      if (!d || d.source !== 'rubys-admin' || d.type !== 'state') return
      patch(app.id, { connected: true, stalled: false, path: cleanPath(d.path), user: cleanUser(d.user) })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [patch])

  // Once the open panel has loaded, quietly open the other one too, so the
  // first switch is instant as well.
  const activeLoaded = frames[activeId].loaded
  useEffect(() => {
    if (!activeLoaded) return
    const t = setTimeout(() => {
      setFrames((f) => {
        const next = { ...f }
        for (const a of APPS) if (!next[a.id].mounted) next[a.id] = { ...next[a.id], mounted: true }
        return next
      })
    }, 1200)
    return () => clearTimeout(t)
  }, [activeLoaded])

  const switchTo = useCallback((id: AppId) => {
    rememberApp(id)
    setActiveId(id)
    setFrames((f) => (f[id].mounted ? f : { ...f, [id]: { ...f[id], mounted: true } }))
  }, [])

  const retry = useCallback((id: AppId) => {
    setFrames((f) => ({
      ...f,
      [id]: { ...f[id], srcPath: f[id].path, reloadKey: f[id].reloadKey + 1, loaded: false, connected: false, stalled: false },
    }))
  }, [])

  // Sign out of every admin, then out of the portal (Cloudflare Access).
  const signOutAll = useCallback(async () => {
    setSigningOut(true)
    const signedIn = APPS.filter((a) => framesRef.current[a.id].connected && framesRef.current[a.id].user)
    for (const a of signedIn) {
      frameRefs.current[a.id]?.contentWindow?.postMessage({ source: 'rubys-portal', type: 'logout' }, a.origin)
    }
    const deadline = Date.now() + 4000
    while (Date.now() < deadline && signedIn.some((a) => framesRef.current[a.id].user)) {
      await new Promise((r) => setTimeout(r, 100))
    }
    if (identity) {
      window.location.assign(ACCESS_LOGOUT_URL)
    } else {
      setSigningOut(false)
    }
  }, [identity])

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ink">
      <TopBar
        active={active}
        frames={frames}
        identity={identity}
        signingOut={signingOut}
        onSwitch={switchTo}
        onSignOut={signOutAll}
      />
      <main className="relative flex-1 overflow-hidden bg-white">
        {APPS.map((app) => (
          <AdminFrame
            key={app.id}
            ref={(el) => { frameRefs.current[app.id] = el }}
            app={app}
            state={frames[app.id]}
            active={app.id === activeId}
            onLoad={() => patch(app.id, { loaded: true })}
            onStall={() => patch(app.id, { stalled: true })}
            onRetry={() => retry(app.id)}
          />
        ))}
      </main>
    </div>
  )
}
