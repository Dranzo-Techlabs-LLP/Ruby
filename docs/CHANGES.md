# Rubys Admin portal: change log

Every change made for the portal, where it is, and how to undo it.

## 2026-11-24

### Backups taken first
- `C:\Rubys\backups\WhisperingWillows-src-20261124.tar.gz`: WW source before any edit (no git there).
- `C:\Rubys\backups\TeakTownAdmin-src-20261124.tar.gz`: TT source, including `.git`.
  These contain each project's **local** `server/api/config.php`; `backups/` is git-ignored and must never be uploaded.

### Whispering Willows admin (`C:\WhisperingWillows`)

| File | Change |
| --- | --- |
| `src/lib/embed.ts` | **New.** Detects that the admin is framed by the portal (`?embed=rubys` + parent origin exactly `https://ruby.dranzo.com`; the local portal at `localhost:5190` only when the admin itself runs on localhost). |
| `src/components/EmbedBridge.tsx` | **New.** In embed mode only: tells the portal the current page and the signed-in user's name, email and role (never the token); signs out when the portal asks. Exact-origin checks both ways. |
| `src/main.tsx` | Renders `<EmbedBridge />` inside `AuthProvider`. |
| `src/components/Topbar.tsx` | In embed mode only, the mobile top bar shows "Menu" instead of repeating the logo and name. |
| `public/.htaccess` (→ `admin/.htaccess`) | Adds `Content-Security-Policy: frame-ancestors 'self' https://ruby.dranzo.com` and unsets `X-Frame-Options`. Before this, any site could frame the WW admin. |

Undo: restore those files from the backup tarball (or delete the two new files and revert the three edits).

### Teak Town admin (`C:\TeakTownAdmin`, uncommitted on `master`)

Same five changes as Whispering Willows. In `public/.htaccess` the existing CSP's
`frame-ancestors 'self'` became `frame-ancestors 'self' https://ruby.dranzo.com`, and
`Header always unset X-Frame-Options` was added (the root `.htaccess` still sends
`SAMEORIGIN` for the website).

Undo: `git -C C:/TeakTownAdmin checkout -- public/.htaccess src/main.tsx src/components/Topbar.tsx`
and delete `src/lib/embed.ts` and `src/components/EmbedBridge.tsx`.

Not changed in either admin: the API (`server/api/*`), `config.php`, the database, roles, uploads, the website.

### Portal (`C:\Rubys`, new)
Vite + React + Tailwind shell. See `docs/PLAN.md` and `README.md`.

### Cloudflare (dranzo.com zone)
- **Added** `A ruby → 167.86.105.17`, Proxied, TTL Auto. No other record touched.
  Undo: delete that one record.
- Zone SSL/TLS mode is **Flexible** (unchanged). Noted: with Flexible, Cloudflare reaches the
  origin over plain HTTP for every dranzo.com site, including Whispering Willows.

- **Added** Configuration Rule "ruby portal full strict ssl": `http.host eq "ruby.dranzo.com"` →
  SSL Strict (Full strict). Only this hostname; the zone stays Flexible for every other site.
  Undo: delete that rule (Rules → Configuration Rules).

### WHM / cPanel
- **Created** account `rubydranzo` (ruby.dranzo.com, package default). AutoSSL issued a
  Let's Encrypt certificate (valid to 2027-02-22, auto-renews).

### Production deployment (2026-11-24)
Portal → Whispering Willows admin → Teak Town admin, each admin backed up first to
`~/rubys-backups-20261124/` in its own account. Steps and rollback: `docs/DEPLOY.md`.
Live checks after deploy: portal 200 with its CSP; both admins 200 with
`frame-ancestors 'self' https://ruby.dranzo.com`; both APIs unchanged (401 without a session);
Teak Town website pages unchanged. In Chrome, the live portal loaded both admins and switching worked.

### One sign-in page (2026-11-24, later the same day)

Requested: a single portal login (Admin ID + password); panels can only be switched after it.

- **Portal**: new `LoginScreen` is the only thing shown until signed in (no top bar, no switcher,
  panels hidden and inert). Both admins are framed from the start; on sign-in the portal sends the
  Admin ID and password to each admin's own frame, and each admin signs in through its own
  `/api/login`. Tokens stay in each admin's own storage; the portal keeps neither the password nor
  any token. An admin that refuses the details (account not there, different password, inactive)
  shows its own "Sign in to …" card inside the portal. "Sign out of all" returns to the login page.
- **Both admins**: `EmbedBridge.tsx` also handles a `login` message (exact portal origin and
  parent frame only) by calling the admin's normal `login()`, and answers `login-result`.
- **Portal**: fixed the "not responding" timer, which restarted on every render and so never fired.
- **Cloudflare Access**: dropped from the plan. It would add a second login page in front.
- **Deployed** in this order: WW admin, TT admin (backups in `~/rubys-backups-20261124-2/`), then
  the portal (backup in `/home/rubydranzo/portal-backups/public_html-20261124-1216/`).
- Live check: `ruby.dranzo.com` shows only the login page (also for deep links); a non-existent
  account is refused by both live admins with "Incorrect email or password.", no switcher shown.

Note: one sign-in opens an admin only where the same Admin ID (email) and password exist in that
admin's Users page. Otherwise that admin asks for its own sign-in inside the portal.

## Testing done (local)
`python tests/test_portal.py` against both admins running locally (`npm run local`) and the portal
dev server. Checks cover loading, sign-in, switching without reload, refresh, data and
token isolation, rights (Front Desk), framing by a non-portal site, "Sign out of all",
tablet/mobile layout. All passed.
