import { ArrowLeftRight, Check, ChevronDown } from 'lucide-react'
import { APPS, type AdminApp, type AppId } from '../apps'
import { useMenu } from '../lib/menu'
import type { FrameState } from '../types'

interface Props {
  active: AdminApp
  frames: Record<AppId, FrameState>
  onSwitch: (id: AppId) => void
}

/** "Switch Admin Panel": the drop-down at the top right. */
export function AppSwitcher({ active, frames, onSwitch }: Props) {
  const m = useMenu()

  const pick = (id: AppId) => {
    m.close()
    if (id !== active.id) onSwitch(id)
  }

  return (
    <div className="relative">
      <button
        ref={m.buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={m.open}
        aria-controls="app-switcher-menu"
        onClick={() => m.setOpen(!m.open)}
        onKeyDown={m.onButtonKeyDown}
        className="flex h-9 items-center gap-2 rounded-lg border border-white/12 bg-white/[0.06] px-2.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/[0.12] aria-expanded:bg-white/[0.12] sm:px-3"
      >
        <ArrowLeftRight size={16} className="text-white/70" aria-hidden="true" />
        <span className="hidden md:inline">Switch Admin Panel</span>
        <span className="sr-only md:hidden">Switch Admin Panel</span>
        <ChevronDown size={15} className={`text-white/60 transition-transform duration-150 ${m.open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {m.open && (
        <div
          ref={m.menuRef}
          id="app-switcher-menu"
          role="menu"
          aria-label="Switch Admin Panel"
          onKeyDown={m.onMenuKeyDown}
          className="menu-pop absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-1.5rem))] origin-top-right rounded-xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-xl shadow-black/15"
        >
          <div className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Switch Admin Panel
          </div>
          {APPS.map((app) => {
            const checked = app.id === active.id
            const user = frames[app.id].user
            return (
              <button
                key={app.id}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                onClick={() => pick(app.id)}
                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left outline-none transition-colors hover:bg-slate-100 focus-visible:bg-slate-100"
              >
                <img src={app.logo} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{app.name}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {user ? `Signed in as ${user.name}` : frames[app.id].connected ? 'Not signed in' : hostOf(app.origin)}
                  </span>
                </span>
                {checked && <Check size={16} className="shrink-0 text-ruby-600" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function hostOf(origin: string): string {
  try { return new URL(origin).host } catch { return 'Not configured' }
}
