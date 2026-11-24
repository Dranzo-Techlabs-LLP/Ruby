import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { APPS } from '../apps'
import { RubyMark } from './RubyMark'

interface Props {
  /** Still finding out whether a session already exists. */
  checking: boolean
  busy: boolean
  error: string
  onSubmit: (email: string, password: string) => void
}

/** The portal's one sign-in page. Nothing else (switcher, panels) shows until it succeeds. */
export function LoginScreen({ checking, busy, error, onSubmit }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password || busy || checking) return
    onSubmit(email.trim(), password)
    setPassword('')
  }

  return (
    <div className="login-bg flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <RubyMark className="mx-auto h-14 w-14" />
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            Rubys <span className="font-medium text-white/55">Admin</span>
          </h1>
          <p className="mt-1.5 text-sm text-white/55">One sign-in for every property</p>
        </div>

        <form onSubmit={submit} className="rounded-2xl bg-white p-6 shadow-2xl shadow-black/40 sm:p-7" noValidate>
          {checking ? (
            <div className="flex flex-col items-center gap-3 py-8 text-sm text-slate-500" role="status">
              <Loader2 size={22} className="animate-spin text-ruby-600" aria-hidden="true" />
              Checking your session…
            </div>
          ) : (
            <>
              <label htmlFor="portal-email" className="block text-[13px] font-semibold text-slate-700">
                Admin ID
              </label>
              <input
                id="portal-email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-[15px] text-slate-900 outline-none transition focus:border-ruby-500 focus:ring-3 focus:ring-ruby-500/15"
              />

              <label htmlFor="portal-password" className="mt-4 block text-[13px] font-semibold text-slate-700">
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="portal-password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 w-full rounded-lg border border-slate-300 pl-3 pr-11 text-[15px] text-slate-900 outline-none transition focus:border-ruby-500 focus:ring-3 focus:ring-ruby-500/15"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  aria-pressed={show}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-400 hover:text-slate-700"
                >
                  {show ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                </button>
              </div>

              {error && (
                <p className="mt-4 rounded-lg bg-ruby-50 px-3 py-2 text-[13px] font-medium text-ruby-700" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy || !email.trim() || !password}
                className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ruby-600 text-[15px] font-semibold text-white transition hover:bg-ruby-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy && <Loader2 size={17} className="animate-spin" aria-hidden="true" />}
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </>
          )}
        </form>

        <div className="mt-6 flex items-center justify-center gap-4">
          {APPS.map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-xs text-white/50">
              <img src={a.logo} alt="" className="h-6 w-6 rounded-full object-cover opacity-80 ring-1 ring-white/15" />
              {a.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
