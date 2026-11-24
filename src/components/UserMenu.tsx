import { Loader2, LogOut, ShieldCheck } from 'lucide-react'
import { APPS, type AppId } from '../apps'
import type { PortalIdentity } from '../lib/identity'
import { useMenu } from '../lib/menu'
import type { AdminUser, FrameState } from '../types'

interface Props {
  identity: PortalIdentity | null
  activeUser: AdminUser | null
  frames: Record<AppId, FrameState>
  signingOut: boolean
  onSignOut: () => void
}

function initials(name: string): string {
  const parts = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

/** Top-right profile button: who is signed in where, and "Sign out of all". */
export function UserMenu({ identity, activeUser, frames, signingOut, onSignOut }: Props) {
  const m = useMenu()
  const label = identity?.name ?? activeUser?.name ?? ''

  return (
    <div className="relative">
      <button
        ref={m.buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={m.open}
        aria-controls="user-menu"
        aria-label="Profile and sign out"
        onClick={() => m.setOpen(!m.open)}
        onKeyDown={m.onButtonKeyDown}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-ruby-600 text-[13px] font-semibold text-white ring-2 ring-white/10 transition hover:ring-white/30 aria-expanded:ring-white/40"
      >
        {label ? initials(label) : <ShieldCheck size={17} aria-hidden="true" />}
      </button>

      {m.open && (
        <div
          ref={m.menuRef}
          id="user-menu"
          role="menu"
          aria-label="Profile"
          onKeyDown={m.onMenuKeyDown}
          className="menu-pop absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-1.5rem))] origin-top-right rounded-xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-xl shadow-black/15"
        >
          <div className="px-2.5 pb-2 pt-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Portal</div>
            <div className="truncate text-sm font-semibold">{identity?.email ?? 'Rubys Admin'}</div>
          </div>
          <div className="space-y-1.5 border-t border-slate-100 px-2.5 py-2">
            {APPS.map((app) => {
              const u = frames[app.id].user
              return (
                <div key={app.id} className="flex items-center gap-2.5">
                  <img src={app.logo} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate text-[13px] font-medium">{app.name}</div>
                    <div className="truncate text-xs text-slate-500">{u ? `${u.name} · ${u.role}` : 'Not signed in'}</div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="border-t border-slate-100 pt-1">
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={() => { m.close(false); onSignOut() }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-ruby-700 outline-none transition-colors hover:bg-ruby-50 focus-visible:bg-ruby-50 disabled:opacity-60"
            >
              {signingOut ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <LogOut size={16} aria-hidden="true" />}
              Sign out of all
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
