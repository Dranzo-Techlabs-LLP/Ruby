import type { AdminApp, AppId } from '../apps'
import type { PortalIdentity } from '../lib/identity'
import type { FrameState } from '../types'
import { AppSwitcher } from './AppSwitcher'
import { RubyMark } from './RubyMark'
import { UserMenu } from './UserMenu'

interface Props {
  active: AdminApp
  frames: Record<AppId, FrameState>
  identity: PortalIdentity | null
  signingOut: boolean
  onSwitch: (id: AppId) => void
  onSignOut: () => void
}

/** Rubys Admin on the left, the current panel's name next to it, switcher and profile on the right. */
export function TopBar({ active, frames, identity, signingOut, onSwitch, onSignOut }: Props) {
  const state = frames[active.id]

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-2.5 bg-ink px-3 text-white sm:gap-4 sm:px-5">
      <a href={`/${active.id}`} className="flex shrink-0 items-center gap-2.5 rounded-md" aria-label="Rubys Admin">
        <RubyMark className="h-8 w-8" />
        <span className="hidden text-[15px] font-semibold tracking-tight sm:inline">
          Rubys <span className="font-medium text-white/55">Admin</span>
        </span>
      </a>

      <span className="hidden h-6 w-px shrink-0 bg-white/15 sm:block" aria-hidden="true" />

      {/* The panel being managed: always visible */}
      <div key={active.id} className="app-badge flex min-w-0 items-center gap-2.5" aria-live="polite">
        <img src={active.logo} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-white/15" />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[15px] font-semibold">{active.name}</div>
          <div className="hidden truncate text-[11px] text-white/50 sm:block">
            {state.user ? `${state.user.name} · ${state.user.role}` : state.connected ? 'Not signed in' : 'Connecting…'}
          </div>
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <AppSwitcher active={active} frames={frames} onSwitch={onSwitch} />
        <UserMenu identity={identity} activeUser={state.user} frames={frames} signingOut={signingOut} onSignOut={onSignOut} />
      </div>

      {/* Accent line in the current panel's colour */}
      <div
        className="absolute inset-x-0 bottom-0 h-[2px] transition-colors duration-300 motion-reduce:transition-none"
        style={{ backgroundColor: active.accent }}
        aria-hidden="true"
      />
    </header>
  )
}
