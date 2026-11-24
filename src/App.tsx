import { useCallback, useEffect, useRef, useState } from 'react'
import { APPS, DEFAULT_APP, appById, type AppId } from './apps'
import { AdminFrame } from './components/AdminFrame'
import { LoginScreen } from './components/LoginScreen'
import { SignInCard } from './components/SignInCard'
import { TopBar } from './components/TopBar'
import { cleanPath, parseLocation, portalPath, recallApp, rememberApp } from './lib/route'
import type { AdminUser, FrameState } from './types'

// ------------------------------------------------------------------
//  One portal sign-in for both admins.
//
//  Both admins are framed (hidden) from the start. The portal's login page
//  sends the Admin ID and password to each admin's own frame, and each admin
//  signs in through its own API, so tokens never leave their own site and
//  the portal never stores the password. The switcher and panels appear
//  only once at least one admin has accepted the sign-in.
//
//  Messages
//  admin -> portal  { source: 'rubys-admin',  type: 'state', path, user }
//                   { source: 'rubys-admin',  type: 'login-result', id, ok, error }
//  portal -> admin  { source: 'rubys-portal', type: 'login', id, email, password }
//                   { source: 'rubys-portal', type: 'logout' | 'ping' }
//  Accepted only from the admin's exact origin AND from that admin's own frame.
// ------------------------------------------------------------------

/** How long to wait for an admin to say whether a session already exists. */
const BOOT_TIMEOUT_MS = 15_000
/** How long one admin may take to answer a sign-in. */
const LOGIN_TIMEOUT_MS = 20_000

type LoginResult = { ok: boolean; error: string }

function cleanUser(value: unknown): AdminUser | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const str = (x: unknown) => (typeof x === 'string' ? x.slice(0, 120) : '')
  const name = str(v.name)
  return name ? { name, email: str(v.email), role: str(v.role) } : null
}

function initialFrames(first: AppId, path: string): Record<AppId, FrameState> {
  const blank = (id: AppId): FrameState => ({
    mounted: true, // every admin loads at once: the portal needs each one's session state
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

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function App() {
  const [activeId, setActiveId] = useState<AppId>(firstApp)
  const [frames, setFrames] = useState(() => initialFrames(firstApp, firstPath))
  const [bootTimedOut, setBootTimedOut] = useState(false)
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [lastEmail, setLastEmail] = useState('')
  /** Why an admin turned down the portal sign-in, per admin. */
  const [refused, setRefused] = useState<Partial<Record<AppId, string>>>({})
  const [appBusy, setAppBusy] = useState<AppId | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  const frameRefs = useRef<Partial<Record<AppId, HTMLIFrameElement | null>>>({})
  const framesRef = useRef(frames)
  framesRef.current = frames
  const pending = useRef(new Map<string, (r: LoginResult) => void>())

  const active = appById(activeId)
  const patch = useCallback((id: AppId, p: Partial<FrameState>) => {
    setFrames((f) => ({ ...f, [id]: { ...f[id], ...p } }))
  }, [])

  // Signed in to the portal = at least one admin has a session.
  const signedIn = APPS.some((a) => frames[a.id].user)
  const everyoneAnswered = APPS.every((a) => !a.origin || frames[a.id].connected || frames[a.id].stalled)
  const checking = !signedIn && !everyoneAnswered && !bootTimedOut

  useEffect(() => {
    const t = setTimeout(() => setBootTimedOut(true), BOOT_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [])

  // Address and title: the panel and page while signed in, "/" on the login page.
  const activePath = frames[activeId].path
  useEffect(() => {
    if (checking) return
    const target = signedIn ? portalPath(activeId, activePath) : '/'
    if (window.location.pathname + window.location.search !== target) {
      window.history.replaceState(null, '', target)
    }
    document.title = signedIn ? `${active.name} · Rubys Admin` : 'Sign in · Rubys Admin'
  }, [checking, signedIn, activeId, activePath, active.name])

  // Messages from the admins.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const app = APPS.find((a) => a.origin && a.origin === e.origin)
      if (!app) return
      const frame = frameRefs.current[app.id]
      if (!frame || e.source !== frame.contentWindow) return
      const d = e.data as Record<string, unknown> | null
      if (!d || d.source !== 'rubys-admin') return
      if (d.type === 'state') {
        patch(app.id, { connected: true, stalled: false, path: cleanPath(d.path), user: cleanUser(d.user) })
      } else if (d.type === 'login-result' && typeof d.id === 'string' && d.id.startsWith(`${app.id}:`)) {
        const done = pending.current.get(d.id)
        if (done) {
          pending.current.delete(d.id)
          done({ ok: d.ok === true, error: typeof d.error === 'string' ? d.error.slice(0, 200) : '' })
        }
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [patch])

  /** Ask one admin to sign in with these details; resolves with its answer. */
  const askLogin = useCallback((id: AppId, email: string, password: string): Promise<LoginResult> => {
    const app = appById(id)
    const win = frameRefs.current[id]?.contentWindow
    if (!app.origin || !win || !framesRef.current[id].connected) {
      return Promise.resolve({ ok: false, error: `${app.name} is not reachable right now.` })
    }
    const reqId = `${id}:${crypto.randomUUID()}`
    return new Promise<LoginResult>((resolve) => {
      const timer = setTimeout(() => {
        pending.current.delete(reqId)
        resolve({ ok: false, error: `${app.name} did not answer. Try again.` })
      }, LOGIN_TIMEOUT_MS)
      pending.current.set(reqId, (r) => { clearTimeout(timer); resolve(r) })
      win.postMessage({ source: 'rubys-portal', type: 'login', id: reqId, email, password }, app.origin)
    })
  }, [])

  /** Wait until the admins that accepted have reported their user (no flash of the login page). */
  const waitForUsers = async (ids: AppId[]) => {
    const deadline = Date.now() + 4000
    while (Date.now() < deadline && ids.some((id) => !framesRef.current[id].user)) await wait(50)
  }

  // The portal's single sign-in: every admin at once.
  const signIn = useCallback(async (email: string, password: string) => {
    setLoginBusy(true)
    setLoginError('')
    setLastEmail(email)
    const results = await Promise.all(APPS.map(async (a) => [a.id, await askLogin(a.id, email, password)] as const))
    const accepted = results.filter(([, r]) => r.ok).map(([id]) => id)
    if (accepted.length === 0) {
      const errors = [...new Set(results.map(([, r]) => r.error).filter(Boolean))]
      setLoginError(errors.length === 1 ? errors[0] : 'Incorrect Admin ID or password.')
      setLoginBusy(false)
      return
    }
    setRefused(Object.fromEntries(results.filter(([, r]) => !r.ok).map(([id, r]) => [id, r.error])))
    await waitForUsers(accepted)
    const remembered = recallApp()
    const next = remembered && accepted.includes(remembered) ? remembered : accepted[0]
    setActiveId(next)
    rememberApp(next)
    setLoginBusy(false)
  }, [askLogin])

  // Signing in to one admin from its panel (portal sign-in refused there, or its session ended).
  const signInOne = useCallback(async (id: AppId, email: string, password: string) => {
    setAppBusy(id)
    const r = await askLogin(id, email, password)
    if (r.ok) {
      await waitForUsers([id])
      setRefused((x) => ({ ...x, [id]: '' }))
    } else {
      setRefused((x) => ({ ...x, [id]: r.error || 'Incorrect Admin ID or password.' }))
    }
    setAppBusy(null)
  }, [askLogin])

  const switchTo = useCallback((id: AppId) => {
    rememberApp(id)
    setActiveId(id)
  }, [])

  const retry = useCallback((id: AppId) => {
    setFrames((f) => ({
      ...f,
      [id]: { ...f[id], srcPath: f[id].path, reloadKey: f[id].reloadKey + 1, loaded: false, connected: false, stalled: false },
    }))
  }, [])

  // Sign out of every admin; the portal then shows its login page.
  const signOutAll = useCallback(async () => {
    setSigningOut(true)
    const signedInApps = APPS.filter((a) => framesRef.current[a.id].user)
    for (const a of signedInApps) {
      frameRefs.current[a.id]?.contentWindow?.postMessage({ source: 'rubys-portal', type: 'logout' }, a.origin)
    }
    const deadline = Date.now() + 4000
    while (Date.now() < deadline && signedInApps.some((a) => framesRef.current[a.id].user)) await wait(100)
    // Anything that did not confirm is dropped from the portal's view either way.
    setFrames((f) => Object.fromEntries(APPS.map((a) => [a.id, { ...f[a.id], user: null }])) as Record<AppId, FrameState>)
    setRefused({})
    setLoginError('')
    setSigningOut(false)
  }, [])

  const activeState = frames[activeId]
  const needsSignIn = signedIn && activeState.connected && !activeState.user

  return (
    <>
      {!signedIn && (
        <LoginScreen checking={checking} busy={loginBusy} error={loginError} onSubmit={signIn} />
      )}

      {/* The panels: loaded from the start, shown only once signed in */}
      <div
        className={signedIn ? 'flex h-dvh flex-col overflow-hidden bg-ink' : 'pointer-events-none fixed inset-0 -z-10 invisible'}
        {...(signedIn ? {} : ({ inert: '', 'aria-hidden': true } as Record<string, unknown>))}
      >
        {signedIn && (
          <TopBar
            active={active}
            frames={frames}
            signingOut={signingOut}
            onSwitch={switchTo}
            onSignOut={signOutAll}
          />
        )}
        <main className="relative flex-1 overflow-hidden bg-white">
          {APPS.map((app) => (
            <AdminFrame
              key={app.id}
              ref={(el) => { frameRefs.current[app.id] = el }}
              app={app}
              state={frames[app.id]}
              active={signedIn && app.id === activeId}
              showProblems={signedIn}
              onLoad={() => patch(app.id, { loaded: true })}
              onStall={() => patch(app.id, { stalled: true })}
              onRetry={() => retry(app.id)}
            />
          ))}
          {needsSignIn && (
            <SignInCard
              key={activeId}
              app={active}
              email={lastEmail || APPS.map((a) => frames[a.id].user?.email).find(Boolean) || ''}
              reason={refused[activeId] || `Your sign-in doesn't cover ${active.name} yet. Use a ${active.name} account to open it here.`}
              busy={appBusy === activeId}
              onSubmit={(email, password) => signInOne(activeId, email, password)}
            />
          )}
        </main>
      </div>
    </>
  )
}
