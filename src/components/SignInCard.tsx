import { useState, type FormEvent } from 'react'
import { Loader2, LockKeyhole } from 'lucide-react'
import type { AdminApp } from '../apps'

interface Props {
  app: AdminApp
  email: string
  reason: string
  busy: boolean
  onSubmit: (email: string, password: string) => void
}

/**
 * Shown over a panel you are signed in to the portal for, but not to this admin:
 * your portal sign-in was not accepted here, or this admin's session has ended.
 * The admin still decides; this only sends the details to its own sign-in.
 */
export function SignInCard({ app, email: initialEmail, reason, busy, onSubmit }: Props) {
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password || busy) return
    onSubmit(email.trim(), password)
    setPassword('')
  }

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center p-4" style={{ backgroundColor: app.canvas }}>
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-black/10" noValidate>
        <div className="flex items-center gap-3">
          <img src={app.logo} alt="" className="h-11 w-11 rounded-full object-cover ring-1 ring-slate-200" />
          <div>
            <h2 className="text-[17px] font-semibold text-slate-900">Sign in to {app.name}</h2>
            <p className="text-xs text-slate-500">Uses {app.name}'s own accounts and roles</p>
          </div>
        </div>
        {reason && (
          <p className="mt-4 flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800" role="alert">
            <LockKeyhole size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            {reason}
          </p>
        )}
        <label htmlFor={`${app.id}-email`} className="mt-4 block text-[13px] font-semibold text-slate-700">Admin ID</label>
        <input
          id={`${app.id}-email`}
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-ruby-500 focus:ring-3 focus:ring-ruby-500/15"
        />
        <label htmlFor={`${app.id}-password`} className="mt-3 block text-[13px] font-semibold text-slate-700">Password</label>
        <input
          id={`${app.id}-password`}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-ruby-500 focus:ring-3 focus:ring-ruby-500/15"
        />
        <button
          type="submit"
          disabled={busy || !email.trim() || !password}
          className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-ink text-sm font-semibold text-white hover:bg-ink/85 disabled:opacity-60"
        >
          {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {busy ? 'Signing in…' : `Sign in to ${app.name}`}
        </button>
      </form>
    </div>
  )
}
