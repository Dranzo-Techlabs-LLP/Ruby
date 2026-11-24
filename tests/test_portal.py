"""End-to-end test of the Rubys portal against local copies of both admins.

    (in C:/WhisperingWillows)  npm run local        -> http://127.0.0.1:8090
    (in C:/TeakTownAdmin)      npm run local        -> http://127.0.0.1:8091
    (in C:/Rubys)              npm run dev          -> http://localhost:5190
    python tests/test_portal.py

LOCAL ONLY. Signs in to each admin's API with the local test accounts in its
.localrun/secrets.json and, in those local databases only, creates or resets two
test users:
  portal.test@rubys.test      Administrator, same password in both admins
  ww.frontdesk@rubys.test     Front Desk, in Whispering Willows only
It creates no bookings or other records. Screenshots go to tests/screenshots/.
"""
import glob
import json
import os
import re
import secrets
import sys
import urllib.error
import urllib.request
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

PORTAL = os.environ.get("RUBYS_URL", "http://localhost:5190")
APPS = {
    "ww": {"name": "Whispering Willows", "origin": "http://127.0.0.1:8090", "root": Path("C:/WhisperingWillows"),
           "token": "whispering-willows.token"},
    "tt": {"name": "TeakTown", "origin": "http://127.0.0.1:8091", "root": Path("C:/TeakTownAdmin"),
           "token": "teaktown-admin.token"},
}
for a in APPS.values():
    if not a["origin"].startswith("http://127.0.0.1"):
        sys.exit("This test only runs against local admins.")
SHOTS = Path(__file__).resolve().parent / "screenshots"
SHOTS.mkdir(exist_ok=True)

for a in APPS.values():
    accounts = json.loads((a["root"] / ".localrun" / "secrets.json").read_text())["accounts"]
    a["accounts"] = {acc[4]: acc for acc in accounts}  # by role: [id, name, email, password, role]

failures = []


def check(ok, label):
    print(f"{'ok  ' if ok else 'FAIL'} {label}")
    if not ok:
        failures.append(label)


def api(app, path, method="GET", body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(APPS[app]["origin"] + "/api" + path, method=method, data=data, headers=headers)
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read() or b"{}")


def status(app, path, token):
    try:
        api(app, path, token=token)
        return 200
    except urllib.error.HTTPError as e:
        return e.code


def admin_token(app):
    acc = APPS[app]["accounts"]["Administrator"]
    return api(app, "/login", "POST", {"email": acc[2], "password": acc[3]})["token"]


def ensure_user(app, email, name, role, password):
    """Create the local test user, or reset its password and role if it exists."""
    tok = admin_token(app)
    users = api(app, "/bootstrap", token=tok).get("users", [])
    found = next((u for u in users if u.get("email", "").lower() == email), None)
    body = {"name": name, "email": email, "role": role, "active": True, "villa": "", "password": password}
    if found:
        api(app, f"/users/{found['id']}", "PATCH", body, tok)
    else:
        api(app, "/users", "POST", body, tok)
    api(app, "/logout", "POST", token=tok)


SHARED = ("portal.test@rubys.test", secrets.token_urlsafe(12))
WW_ONLY = ("ww.frontdesk@rubys.test", secrets.token_urlsafe(12))
ensure_user("ww", SHARED[0], "Portal Tester", "Administrator", SHARED[1])
ensure_user("tt", SHARED[0], "Portal Tester", "Administrator", SHARED[1])
ensure_user("ww", WW_ONLY[0], "WW Front Desk", "Front Desk", WW_ONLY[1])


def launch(p):
    try:
        return p.chromium.launch()
    except Exception:
        base = os.path.join(os.environ.get("LOCALAPPDATA", ""), "ms-playwright")
        found = sorted(glob.glob(os.path.join(base, "chromium_headless_shell-*", "*", "*.exe")))
        if not found:
            raise
        return p.chromium.launch(executable_path=found[-1])


def frame(page, app):
    return page.frame_locator(f'iframe[title="{APPS[app]["name"]} admin"]')


def frame_obj(page, app):
    return next(f for f in page.frames if f.url.startswith(APPS[app]["origin"]))


def portal_login(page, email, password):
    expect(page.locator("#portal-email")).to_be_visible(timeout=20000)
    page.locator("#portal-email").fill(email)
    page.locator("#portal-password").fill(password)
    page.get_by_role("button", name="Sign in", exact=True).click()


def switch_to(page, name):
    page.get_by_role("button", name="Switch Admin Panel").click()
    page.get_by_role("menuitemradio", name=name).click()


with sync_playwright() as p:
    browser = launch(p)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    console_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

    # 1. One login page first; nothing else before signing in
    page.goto(PORTAL + "/tt/bookings")
    expect(page.locator("#portal-email")).to_be_visible(timeout=20000)
    check(page.get_by_role("button", name="Switch Admin Panel").count() == 0, "no panel switcher before sign-in")
    check(page.locator("header").count() == 0, "no top bar before sign-in")
    check(not page.locator('iframe').first.is_visible(), "no admin panel visible before sign-in")
    expect(page).to_have_url(PORTAL + "/", timeout=5000)
    check(page.title() == "Sign in · Rubys Admin", "a deep link while signed out shows the portal login at /")
    page.screenshot(path=str(SHOTS / "desktop-login.png"))

    # 2. Wrong password: error, still no switcher
    portal_login(page, SHARED[0], "wrong-password")
    expect(page.get_by_role("alert")).to_contain_text("Incorrect", timeout=20000)
    check(page.get_by_role("button", name="Switch Admin Panel").count() == 0, "wrong password: error shown, still no switcher")

    # 3. One sign-in opens both admins
    portal_login(page, *SHARED)
    expect(page.get_by_role("button", name="Switch Admin Panel")).to_be_visible(timeout=20000)
    expect(page.locator("header")).to_contain_text("Portal Tester", timeout=10000)
    check(True, "one sign-in shows the portal with the switcher")
    expect(page).to_have_url(re.compile(re.escape(PORTAL) + r"/ww/?$"), timeout=10000)
    check(page.title() == "Whispering Willows · Rubys Admin", "opens Whispering Willows by default")
    expect(frame(page, "ww").get_by_role("link", name="Bookings").first).to_be_visible(timeout=15000)
    check(page.get_by_text("Sign in to").count() == 0, "no second sign-in for Whispering Willows")
    page.screenshot(path=str(SHOTS / "desktop-ww-dashboard.png"))

    frame(page, "ww").get_by_role("link", name="Bookings").first.click()
    expect(page).to_have_url(PORTAL + "/ww/bookings", timeout=10000)
    frame_obj(page, "ww").evaluate("window.__rubysMarker = 'still-here'")

    switch_to(page, "TeakTown")
    expect(page).to_have_url(re.compile(re.escape(PORTAL) + r"/tt/?$"), timeout=10000)
    expect(frame(page, "tt").get_by_role("link", name="Bookings").first).to_be_visible(timeout=15000)
    check(page.get_by_text("Sign in to TeakTown").count() == 0, "TeakTown already signed in by the same sign-in")
    page.screenshot(path=str(SHOTS / "desktop-tt-dashboard.png"))

    switch_to(page, "Whispering Willows")
    expect(page).to_have_url(PORTAL + "/ww/bookings", timeout=10000)
    check(frame_obj(page, "ww").evaluate("window.__rubysMarker") == "still-here", "switching back keeps the page (no reload)")

    # 4. Isolation: each admin holds only its own token; the portal holds none
    ww_keys = frame_obj(page, "ww").evaluate("Object.keys(localStorage)")
    tt_keys = frame_obj(page, "tt").evaluate("Object.keys(localStorage)")
    portal_keys = page.evaluate("Object.keys(localStorage)")
    check(ww_keys == [APPS["ww"]["token"]], f"WW frame storage holds only its own token ({ww_keys})")
    check(tt_keys == [APPS["tt"]["token"]], f"TT frame storage holds only its own token ({tt_keys})")
    check(portal_keys == ["rubys.lastApp"], f"portal storage holds no tokens or passwords ({portal_keys})")
    ww_token = frame_obj(page, "ww").evaluate(f"localStorage.getItem('{APPS['ww']['token']}')")
    tt_token = frame_obj(page, "tt").evaluate(f"localStorage.getItem('{APPS['tt']['token']}')")
    check(ww_token != tt_token, "the two admins issued separate sessions")
    check(status("tt", "/me", ww_token) == 401, "WW token rejected by the TT API")
    check(status("ww", "/me", tt_token) == 401, "TT token rejected by the WW API")
    page_html = page.content()
    check(SHARED[1] not in page_html, "the password is not left in the portal page")

    # 5. Each frame calls only its own API; the portal calls none
    requests = []
    page.on("request", lambda r: requests.append((r.frame.url if r.frame else "", r.url)))
    page.reload()
    expect(page.get_by_role("button", name="Switch Admin Panel")).to_be_visible(timeout=20000)
    page.wait_for_timeout(2500)
    api_calls = [(f, u) for f, u in requests if "/api/" in u]
    cross = [(f, u) for f, u in api_calls if not f.startswith(u.split("/api/")[0])]
    portal_api = [u for f, u in api_calls if f.startswith(PORTAL)]
    origins = sorted({u.split("/api/")[0] for f, u in api_calls})
    check(len(origins) == 2 and not cross and not portal_api,
          f"each frame calls only its own API; the portal calls none ({len(api_calls)} calls)")

    # 6. Refresh keeps the session, panel and page
    expect(page).to_have_url(PORTAL + "/ww/bookings", timeout=10000)
    check(page.locator("#portal-email").count() == 0, "refresh keeps you signed in (no login page)")

    # 7. A forged message from one admin's frame cannot change the other's state
    frame_obj(page, "tt").evaluate(
        "window.parent.postMessage({source:'rubys-admin', type:'state', path:'/', user:{name:'Spoof', role:'x'}}, '*')")
    page.wait_for_timeout(300)
    check("Spoof" not in page.locator("header").inner_text(), "a message from one frame cannot change the other's state")

    # 8. Sign out of all -> back to the one login page, sessions ended on both servers
    page.get_by_role("button", name="Profile and sign out").click()
    page.get_by_role("menuitem", name="Sign out of all").click()
    expect(page.locator("#portal-email")).to_be_visible(timeout=15000)
    check(page.get_by_role("button", name="Switch Admin Panel").count() == 0, "after sign out: login page, no switcher")
    check(status("ww", "/me", ww_token) == 401, "sign out ended the WW session on the server")
    check(status("tt", "/me", tt_token) == 401, "sign out ended the TT session on the server")
    expect(page).to_have_url(PORTAL + "/", timeout=5000)

    # 9. An account that exists in only one admin: in there, asked to sign in for the other
    ctx2 = browser.new_context(viewport={"width": 1440, "height": 900})
    p2 = ctx2.new_page()
    p2.goto(PORTAL + "/")
    portal_login(p2, *WW_ONLY)
    expect(p2.get_by_role("button", name="Switch Admin Panel")).to_be_visible(timeout=20000)
    expect(p2).to_have_url(re.compile(re.escape(PORTAL) + r"/ww/?$"), timeout=10000)
    links = frame(p2, "ww").locator("nav a").all_inner_texts()
    check("Accounting" not in links and "Reports" not in links, f"Front Desk rights still apply in the portal ({links})")
    p2.goto(PORTAL + "/ww/accounting")
    expect(p2.get_by_role("button", name="Switch Admin Panel")).to_be_visible(timeout=20000)
    p2.wait_for_timeout(1500)
    check("Revenue" not in frame(p2, "ww").locator("main").inner_text(), "Front Desk is blocked from /ww/accounting")
    switch_to(p2, "TeakTown")
    expect(p2.get_by_text("Sign in to TeakTown").first).to_be_visible(timeout=10000)
    check(True, "an account TeakTown doesn't know gets TeakTown's own sign-in card")
    p2.screenshot(path=str(SHOTS / "desktop-tt-signin-card.png"))
    tt_admin = APPS["tt"]["accounts"]["Administrator"]
    p2.locator("#tt-email").fill(tt_admin[2])
    p2.locator("#tt-password").fill(tt_admin[3])
    p2.get_by_role("button", name="Sign in to TeakTown").click()
    expect(frame(p2, "tt").get_by_role("link", name="Bookings").first).to_be_visible(timeout=20000)
    p2.wait_for_timeout(500)
    check(p2.get_by_text("Sign in to TeakTown").count() == 0, "signing in to TeakTown from its card opens it")
    p2.get_by_role("button", name="Profile and sign out").click()
    p2.get_by_role("menuitem", name="Sign out of all").click()
    expect(p2.locator("#portal-email")).to_be_visible(timeout=15000)
    ctx2.close()

    # 10. A site that is not the portal gets no embed mode and cannot drive the admin
    other = ctx.new_page()
    other.goto(APPS["tt"]["origin"] + "/admin/login")
    other.evaluate(f"""document.body.innerHTML = '<iframe id=x style="width:380px;height:700px" src="{APPS['ww']['origin']}/admin/login?embed=rubys"></iframe>'""")
    other.wait_for_timeout(2500)
    wf = next(f for f in other.frames if f.url.startswith(APPS["ww"]["origin"]))
    other.evaluate(f"""document.getElementById('x').contentWindow.postMessage({{source:'rubys-portal', type:'login', id:'ww:x', email:'{SHARED[0]}', password:'{SHARED[1]}'}}, '*')""")
    other.wait_for_timeout(2000)
    check(wf.evaluate(f"localStorage.getItem('{APPS['ww']['token']}')") is None, "a non-portal parent cannot sign the admin in")
    other.close()

    # 11. Tablet and phone
    for label, size in (("tablet", (768, 1024)), ("mobile", (375, 812))):
        c = browser.new_context(viewport={"width": size[0], "height": size[1]}, is_mobile=label == "mobile", has_touch=True)
        pg = c.new_page()
        pg.goto(PORTAL + "/")
        expect(pg.locator("#portal-email")).to_be_visible(timeout=20000)
        pg.screenshot(path=str(SHOTS / f"{label}-login.png"))
        portal_login(pg, *SHARED)
        expect(pg.get_by_role("button", name="Switch Admin Panel")).to_be_visible(timeout=20000)
        expect(frame(pg, "ww").get_by_role("button", name="Open menu")).to_be_visible(timeout=15000)
        check(not pg.evaluate("document.documentElement.scrollWidth > window.innerWidth"), f"{label}: no sideways scrolling")
        pg.screenshot(path=str(SHOTS / f"{label}-ww-dashboard.png"))
        pg.get_by_role("button", name="Switch Admin Panel").click()
        pg.wait_for_timeout(200)
        pg.screenshot(path=str(SHOTS / f"{label}-switcher.png"))
        pg.keyboard.press("Escape")
        pg.get_by_role("button", name="Profile and sign out").click()
        pg.get_by_role("menuitem", name="Sign out of all").click()
        expect(pg.locator("#portal-email")).to_be_visible(timeout=15000)
        c.close()

    real_errors = [e for e in console_errors if "401" not in e and "Unauthorized" not in e]
    check(not real_errors, f"no console errors in the portal ({real_errors[:3]})")
    browser.close()

print()
if failures:
    print(f"{len(failures)} failed")
    sys.exit(1)
print("All portal checks passed.")
