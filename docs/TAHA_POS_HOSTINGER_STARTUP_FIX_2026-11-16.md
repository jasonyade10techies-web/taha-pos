# Hostinger listener deadline correction — 2026-11-16

Hostinger's actual runtime log for the hyena staging site repeatedly reported:
`App did not call listen() within 3 seconds`. The `.5` entry was unguarded, but
loaded the complete NestJS application before calling listen. Previous local
cloud rehearsals took approximately 2.3–3.0 seconds and did not establish that
slower managed-hosting cold starts would meet Hostinger's deadline.

Release `0.5.0-r3a.8` opens the assigned HTTP listener and waits for its listening
callback before importing NestJS in cloud mode. This also prevents heavy module
loading from delaying the socket's actual bind callback. It returns
503 / STARTING / Retry-After: 1 until `app.init()` finishes,
then forwards requests on the same listener to the actual Express/NestJS handler.
It opens no second port, performs no startup migration, and reports no successful
health or financial operation during initialization. Startup failure closes the
listener. SIGTERM/SIGINT close it as well. Local runtime retains the existing
NestJS listener and LAN integration. No shop data, credentials or financial logic
was changed.

The owner subsequently supplied a verified `.7` build that still failed on
Hostinger with the generic post-build failure and the same listener message.
The `.8` correction places the complete synchronous CommonJS listener bootstrap
directly in root main.js and replaces getBuiltinModule with literal require('http').
server.cjs remains only a compatibility alias. Node documents
that getBuiltinModule and node:-prefixed require bypass replaced require-cache
entries. Controlled cached-module and entry-scoped HTTP shims now verify that the
listener is captured before evaluating the root entry returns. They fail against `.7` and pass
against `.8`. Hostinger's internal loader source is unavailable: interception is a
compatibility hypothesis supported by this reproduction, not a proven account of
its private runtime. Actual hosting acceptance remains required.

After the Hostinger connection was reauthenticated, read-only inspection of the
actual site's `.htaccess` established `PassengerStartupFile dist/main.js`, despite
build settings specifying root `main.js` and output `.`. That actual entry loaded
the compiled exports whose guarded standalone launch is skipped when Passenger
requires the file. The `.8` package now preserves those compiled exports as
`dist/api.js` and supplies the same unguarded listener bootstrap at both root
`main.js` and Passenger's `dist/main.js`, with relative imports adjusted. A fresh
regression requires the actual nested entry and expects startup; it failed before
this layout correction. No generated hosting configuration was edited.

A regression fixture requires the entry as another module, delays initialization
by four seconds, simulates a delayed socket bind and requires imports to wait for
that bind, requires an initial POST to return 503 within 1.5 seconds, then
checks that the real handler replaces the startup response and shutdown exits.
It failed against `.5` and passes against `.6`.

Use the existing updated private environment for
`https://digital-greenyellow-hyena-70.hostingersite.com`. Settings remain Node
22.x (minimum 22.13), NestJS, root `.`, output `.`, entry `main.js`, build
`npm run build`, start `npm start`. The Node built-in module loader avoids loading
third-party dependencies before listen.

Evidence is retained under `.test-postgres/hostinger-zip-20261116/`.
Actual Hostinger startup, authenticated readiness and proxy trust still require
verification after the owner uploads the new ZIP. Native/hardware acceptance is
not implied by package tests.

## Delivered staging candidate and fresh verification

The delivered Linux-built `.8` ZIP is from application commit
`9b7a70ba9fe949687c18325654cbc9f5f5bda78d`, SHA256
`22c508ec4417734bd3b815b521187a290f52fbbb9ec4e9b53d5624a3db69accf`.
It contains 361 verified manifest files. It is copied to
`C:/Users/hassa/Downloads/Taha-POS-Hostinger-0.5.0-r3a.8.zip` and
`artifacts/hostinger/Taha-POS-Hostinger-0.5.0-r3a.8.zip`.

- 32 release-system checks pass, including cached/entry-scoped HTTP interception,
  delayed socket binding, slow initialization, and requiring the actual nested
  Passenger entry.
- A Windows local production-package rehearsal passed all 27 real API/browser/
  financial/media/restart/backup-restore cases against disposable PostgreSQL.
  Evidence: `.test-postgres/r2c-20261113/taha_r2c_clean_1794839787167/results.json`.
- The actual nested-entry bootstrap passed eight checks against approved real
  staging Neon PostgreSQL/private storage through a local process. The listener
  opened in 61 ms; all 69 migrations and dependency readiness passed. Evidence:
  `.test-postgres/hostinger-zip-20261116/cloud-passenger-entry-result.json`.
- Linux `npm install` and release verification pass. The full Linux run is **not
  green**: after passing financial/media/synchronization cases, it failed because
  the local-runtime API did not exit within 15 seconds during the restart case.
  Evidence: GitHub Actions run `43887423501` and
  `.test-postgres/hostinger-zip-20261116/linux-r3a8-third-failure.log`.
  This local/LAN-mode Linux shutdown behavior remains to investigate; it must not
  be reported as a fully passing Linux regression baseline or production acceptance.

The preceding Linux run also exposed a Playwright fixture teardown race
(`Route is already handled`). Commit `87b2293` fixes handler draining without
removing readback assertions or changing application code. The Windows full run
uses the corrected fixture. No existing business database was reset or seeded.
The owner is performing the actual Hostinger upload; no successful `.8` cloud
deployment or production readiness is claimed here.
