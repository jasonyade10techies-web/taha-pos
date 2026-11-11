# Taha POS 0.5.0 — Windows and offline engine

The counter product is the installed Tauri 2 application. Vite is a development tool. Release windows load `dist/index.html` and `dist/splash.html` from the application bundle; no remote frontend is loaded.

## Runtime

`src-tauri/src` implements SQLite, DPAPI session storage, a restricted HTTP client, single instance behavior, splash handoff and a separate customer display. `src/lib/desktop` adapts those commands to the existing repository interfaces. Browser/demo repositories retain IndexedDB. The approved Dashboard, POS, media manager and staff Android workflows are preserved.

Main window: 1440×900, minimum 1024×680. Window geometry/maximized/fullscreen state is persisted through the official window-state plugin. Splash geometry is excluded. There is no artificial minimum splash duration. A database startup failure opens a visible recovery screen without resetting data. An eight-second watchdog opens the main window if frontend startup fails. F11 exits fullscreen; Windows autostart is off until the owner enables it. Settings → About shows 0.5.0. Automatic updates are disabled pending signed releases.

App icons already match the approved coded red TM / gold underline. NSIS (per-user install) and MSI targets are configured. Mutable data is under the Windows user AppData directory `com.tahamobiles.pos`, never Program Files.

## Cash checkout and recovery

An online staff sign-in obtains a signed, terminal-bound eight-hour offline cash grant. PIN verification/switching still requires the server. Shared counter PIN sessions do not obtain an offline grant in this version; sign into the staff account online to prepare offline use. There is no offline password or PIN comparison.

The cost-free catalogue, minimum prices, stock snapshot, payment configuration, receipt settings and counter customers are cached. Cash catalogue sales are committed atomically with a receipt, stock reservation and outbox operation before returning success. SQLite uses WAL, FULL synchronous writes and foreign keys. In-flight operations return to PENDING on restart.

Final offline invoice: `TM-INV-O-<transaction UUID>`. It is assigned before server receipt, ledger, audit and idempotency snapshots are created and never renumbered. All native cash catalogue sales use this path, including online sales, so a lost server response cannot create a second receipt. Idempotency is preserved during retry. Cart drafts retain their checkout UUID; a completed local receipt prevents replaying that cart after a crash.

Allowed offline: cached catalogue/customer selection, catalogue cash sales, local receipt viewing/printing and the independently connected LAN phone bridge. Blocked: credit, coupons, custom services, test conversion, manager price overrides, electronic payments, product/price/cost changes, receiving, adjustment, transfer and employee administration. These restrictions are deliberate until dedicated offline rules exist.

Synchronization is automatic for the signed-in employee. Local operations are scoped to their original account; after logout, reconnect/sign in as that account to synchronize its pending work. Cross-employee owner replay is not enabled. FAILED operations back off up to five minutes; CONFLICT needs owner review. Stock, price, tax or authorization failures never overwrite cloud values. Synced receipts remain locally available. Settings → Synchronization shows pending changes, last sync and Retry. Cash recorded during a valid grant can sync later (up to 30 days) under the original active employee, after current permissions are rechecked.

## Photos and local devices

The existing NestJS LAN bridge remains separate from the cloud and can be operated directly by the installed counter. It must run on the shop PC; this phase does not bundle a Node/PostgreSQL daemon into the EXE. A browser counter page is unnecessary. Owner → Windows Application → Local Staff Phone Connection selects that trusted private LAN endpoint. Authentication/cookies are separate for LAN and cloud. Existing pairing, requests, presence and phone capture are retained. Internet loss does not stop the LAN server or local photo delivery.

When a photo arrives from the LAN while cloud is offline, Windows preserves it in AppData and queues a cloud upload. The queue is capped at 64 MB, 10 MB per image, and reports capacity errors. Files are not silently discarded. Captured product images still require explicit Save when cloud returns; automatic upload does not silently create or change a product. Cloud phone requests/presence use foreground HTTPS polling; LAN can continue using WebSockets.

## Release configuration

`TAHA_API_URL` is a public HTTPS API origin, supplied to the native build environment. Release builds reject a missing/insecure endpoint; no invented production hostname or private LAN address is embedded. Debug defaults to the local development API. Owner-confirmed overrides are saved in AppData and clear the session; changing cloud backend is blocked while any operation is unsynced. Employees do not enter server URLs.

```
npm install
npm run dev
npm run build
npm run validate:tauri
npm run test:desktop
# Native offline acceptance uses the custom API, rather than the retained development demo:
$env:VITE_DATA_PROVIDER = 'api'
$env:VITE_USE_MOCK_AUTH = 'false'
npm run tauri dev
# After selecting the real production HTTPS API:
$env:TAHA_API_URL = '<selected HTTPS API origin>'
npm run tauri build
```

Expected output locations after a SUCCESSFUL native build: `src-tauri/target/release/taha-pos.exe`, `src-tauri/target/release/bundle/nsis/`, `src-tauri/target/release/bundle/msi/`. These are expected locations, not evidence that an installer was built.

## Windows prerequisites

Use Rust stable `x86_64-pc-windows-msvc`, Rust ≥1.90, MSVC x64/x86 C++ Build Tools and a Windows 10/11 SDK. The official Visual Studio Build Tools installer needs the **Desktop development with C++** workload. No full Visual Studio IDE is required. WebView2 is also required and is already available on this PC. Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows-prerequisites.ps1` to check. The execution-policy option affects this invocation only.

After prerequisites are available, verify a REAL native window with `npm run tauri dev`, then build installers. Browser and mocked IPC tests do not certify native window, DPAPI, physical printer or second-monitor behavior.

## Native acceptance checklist

1. Launch native app online; verify splash, Dashboard, POS, products, theme and About.
2. Sign in online; open POS to prepare catalogue/settings and the offline grant.
3. Disconnect internet while leaving the shop LAN active; restart native app and verify cached access.
4. Complete a cash sale, print its white 80 mm receipt and record the stable invoice.
5. Restore internet; verify automatic sync, one server sale and the same invoice.
6. Stop/start the app during a draft and a pending sync; verify recovery without duplicate sales.
7. Open the native customer display, move/fullscreen it on monitor two, restart and verify geometry/privacy.
8. Pair Android through the local bridge, capture a photo with cloud offline, then restore cloud and verify queued upload.

Native acceptance remains unverified until the missing Windows C++ toolchain is installed. No physical-device or hardware success is claimed.

Offline photos retain their original upload UUID, and server retries reuse one private media record. Synced local files are retained; automatic media-cache pruning is not enabled yet. The 64 MB limit applies to unsynced photos, not the retained history.
