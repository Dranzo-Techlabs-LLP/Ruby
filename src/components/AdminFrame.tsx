import { forwardRef, useEffect, useRef } from 'react'
import { ExternalLink, RotateCw, TriangleAlert } from 'lucide-react'
import { directUrl, frameUrl, type AdminApp } from '../apps'
import type { FrameState } from '../types'

/** How long a loaded admin may stay silent before the portal offers help. */
const STALL_MS = 12_000

interface Props {
  app: AdminApp
  state: FrameState
  active: boolean
  /** Show the "not responding" / "not set up" notices (only once signed in to the portal). */
  showProblems: boolean
  onLoad: () => void
  onStall: () => void
  onRetry: () => void
}

/**
 * One admin, framed. Frames are kept once created, so switching back is instant
 * and the admin keeps its page and any half-filled form.
 */
export const AdminFrame = forwardRef<HTMLIFrameElement, Props>(function AdminFrame(
  { app, state, active, showProblems, onLoad, onStall, onRetry },
  ref,
) {
  // The latest callback, so re-renders don't restart the timer below.
  const onStallRef = useRef(onStall)
  onStallRef.current = onStall

  useEffect(() => {
    if (!state.loaded || state.connected || state.stalled) return
    const t = setTimeout(() => onStallRef.current(), STALL_MS)
    return () => clearTimeout(t)
  }, [state.loaded, state.connected, state.stalled])

  // Hidden frames are inert: no focus, no screen reader, no clicks.
  const hidden = active ? {} : ({ inert: '', 'aria-hidden': true } as Record<string, unknown>)

  return (
    <section
      aria-label={`${app.name} admin`}
      className={`frame-layer absolute inset-0 ${active ? 'is-active' : ''}`}
      {...hidden}
    >
      {state.mounted && app.origin && (
        <iframe
          key={state.reloadKey}
          ref={ref}
          title={`${app.name} admin`}
          src={frameUrl(app, state.srcPath)}
          onLoad={onLoad}
          allow="clipboard-write"
          referrerPolicy="strict-origin-when-cross-origin"
          className="block h-full w-full border-0"
          style={{ backgroundColor: app.canvas }}
        />
      )}

      {/* Placeholder in the admin's own colours until it has loaded */}
      {!state.loaded && app.origin && (
        <div className="pointer-events-none absolute inset-0 flex" style={{ backgroundColor: app.canvas }} aria-hidden="true">
          <div className="hidden w-64 shrink-0 lg:block" style={{ backgroundColor: app.sidebar }} />
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <img src={app.logo} alt="" className="h-12 w-12 animate-pulse rounded-full object-cover" />
              <span className="text-sm font-medium text-slate-500">Opening {app.name}…</span>
            </div>
          </div>
        </div>
      )}

      {showProblems && !app.origin && (
        <Notice
          title={`${app.name} is not set up in the portal yet`}
          text="Its address is missing from the portal's settings (.env.production)."
        />
      )}

      {showProblems && state.stalled && (
        <div className="absolute inset-x-3 bottom-3 z-10 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:max-w-md" role="alert">
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-white p-4 text-slate-800 shadow-lg shadow-black/10">
            <TriangleAlert size={20} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold">{app.name} isn't responding to the portal</p>
              <p className="mt-1 text-slate-600">
                If the panel stays blank, the admin may not allow the portal yet or the site may be unreachable.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-ink/85"
                >
                  <RotateCw size={14} aria-hidden="true" /> Retry
                </button>
                <a
                  href={directUrl(app, state.path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Open in new tab <ExternalLink size={14} aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
})

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-sm text-center">
        <TriangleAlert size={28} className="mx-auto text-amber-500" aria-hidden="true" />
        <p className="mt-3 font-semibold text-slate-800">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{text}</p>
      </div>
    </div>
  )
}
