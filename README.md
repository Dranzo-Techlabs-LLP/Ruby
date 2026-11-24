# Rubys Admin

One place to manage **Whispering Willows** and **Teak Town**: https://ruby.dranzo.com

The portal is a small static shell: a top bar with the **Switch Admin Panel** drop-down and a
profile menu, and below it the selected admin, shown live from its own site:

| Panel | Admin | Source |
| --- | --- | --- |
| Whispering Willows | https://whisperingwillows.dranzo.com/admin/ | `C:\WhisperingWillows` |
| TeakTown | https://theteaktown.com/admin/ | `C:\TeakTownAdmin` |

Each admin keeps its own sign-in, roles, API, database and uploads. The portal holds no data,
tokens or secrets, and never calls either API. The browser keeps the two admins apart (different
origins). Both admins are kept loaded, so switching is instant; the address (`/ww/...`, `/tt/...`)
follows the admin's page, so a refresh or a shared link reopens the same place.

## Run it locally

Start both admins (`npm run local` in each project: WW on 8090, TT on 8091), then:

```
npm install
npm run dev
```

Portal: http://localhost:5190. The admins only trust this local portal while they run locally too.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 5190, framing the local admins (`.env.development`) |
| `npm run lint` | Type-check |
| `npm run build` | Production build to `dist/` plus a generated `.htaccess`; refuses to build without both admin addresses in `.env.production` |
| `npm run release` | `build`, then zips `dist/` into `release/` for cPanel |
| `node scripts/package-admin.mjs <admin project> <label>` | Zips an admin's built `dist/admin` for upload |
| `python tests/test_portal.py` | End-to-end test against the local copies |

## Layout

```
src/
├── App.tsx              # state, admin messages, address sync, sign out of all
├── apps.ts              # the two admins: names, origins, colours
├── components/          # TopBar, AppSwitcher, UserMenu, AdminFrame, RubyMark
└── lib/                 # route (addresses), identity (Cloudflare Access), menu
deploy/htaccess.template # security headers and routing for public_html
scripts/                 # build, package, package-admin, zip
docs/                    # PLAN.md, DEPLOY.md, CHANGES.md
```

Each admin carries a small add-on for the portal (`src/lib/embed.ts`, `src/components/EmbedBridge.tsx`)
and allows only `https://ruby.dranzo.com` to frame it. See [docs/CHANGES.md](docs/CHANGES.md).

Deploying: [docs/DEPLOY.md](docs/DEPLOY.md).
