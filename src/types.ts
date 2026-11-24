/** What an admin tells the portal about its signed-in user. Never a token. */
export interface AdminUser {
  name: string
  email: string
  role: string
}

/** The portal's view of one admin frame. */
export interface FrameState {
  /** The frame exists (it is created on first use, then kept). */
  mounted: boolean
  /** The admin page the frame was opened on. Changing it reloads the frame. */
  srcPath: string
  /** Bumped by "Retry" to reload the frame. */
  reloadKey: number
  /** The frame's load event has fired. */
  loaded: boolean
  /** The admin has talked to the portal at least once. */
  connected: boolean
  /** Loaded, but the admin has not talked to the portal in time. */
  stalled: boolean
  /** The admin's current page, as it last reported it. */
  path: string
  user: AdminUser | null
}
