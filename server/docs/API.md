# Taha POS custom API contract

REST base: `/api/v1`. Development Swagger: `/api/docs`.
No public signup. Accounts are created by trusted owner provisioning or authorized employee management.

## Authentication

`POST /auth/login` body `{email,password}` returns `{accessToken,expiresIn:900,context}`.
`context` exactly matches the frontend `SessionContext` (profile, permissions, store, terminal, counter_expires_at).
Refresh token is a rotating, hashed, HttpOnly `taha_refresh` cookie scoped to `/api/v1/auth`.
`POST /auth/refresh` returns the same envelope. Keep access tokens in memory; send `Authorization: Bearer ...`.
`GET /auth/session` returns context. `POST /auth/logout` revokes the current session.
`POST /auth/change-password` accepts `{currentPassword,newPassword}` and revokes other sessions.
`GET /auth/devices` lists own sessions without secrets; `DELETE /auth/devices/:id` revokes an owned session.

Business requests also accept `X-Counter-Session` after PIN verification, never a claimed employee identity.
`GET /auth/counter/employees`; `POST /auth/counter/verify` `{profileId,pin}`; `POST /auth/counter/lock`.

## Business resources

All paths below are under `/stores/:storeId`. Every request executes through the existing PostgreSQL permission helpers and RLS with transaction-local identity/role. Body fields use the existing SQL RPC input shapes; outputs use existing SQL JSON models or snake_case table models. The caller cannot supply SQL, function names, actor/profile claims, or permission overrides.

| Resource | Routes |
|---|---|
| Products | `GET /products`, `GET /products/pos`, `GET /products/values`, `GET /products/:id`, `GET /products/:id/cost`, `POST /products` (snake_case ProductInput), `POST /products/:id/duplicate`, `DELETE /products/:id` |
| Locations | `GET /locations`, `POST /locations`, `DELETE /locations/:id` |
| Stock | `GET /inventory/balances`, `GET /inventory/movements`, `GET /inventory/receipts`, `POST /inventory/receipts` `{input,receive}`, `POST /inventory/transfer` `{productId,source,destination,quantity,requestId}`, `POST /inventory/adjust` `{productId,locationId,expected,quantity,reason,requestId}` |
| Suppliers | `GET /suppliers`, `POST /suppliers` |
| Customers | `GET /customers` query `id,page,limit`, `POST /customers` (existing camelCase customer JSON), `GET /customers/:id/balance` |
| Sales | `GET /sales` query existing filters, `GET /sales/:id`, `POST /sales` (SaleInput), `POST /sales/:id/void` (idempotencyKey,reason,manualRefundConfirmed), `POST /returns` (existing return input), `GET /returns` |
| Credit | `GET /credit/ledger?customerId=...`, `POST /credit/receive` (existing collection input) |
| Payments | `GET /payment-methods`, `POST /payment-methods`, `GET /payments`, `POST /payments/reverse` |
| Coupons | `GET /coupons`, `POST /coupons`, `POST /coupons/quote` `{code,lines,customerId}` |
| Approval | `GET /approvals?permission=...`, `POST /approvals` `{managerId,pin,purpose,payload}` |
| Test out | `GET /out-for-test`, `POST /out-for-test`, `POST /out-for-test/update` |
| Team | `GET /employees`, `POST /employees` (owner provisions new staff identity from email; PIN-only until account configured), `PUT /employees/:id/permissions` `{permissions}`, `PUT /employees/:id/pin` `{pin}`, `POST /accounts` `{profileId,email,password}` (authorized management password provisioning, not public signup) |
| Profile | `PATCH /profile` `{fullName,phone}` |
| Settings | `GET /settings`, `PUT /settings` (settings JSON) |
| Appearance | `GET /appearance`, `PUT /appearance` (font + six color tokens; requires appearance.customize, validates readable semantic colors without access to other business settings) |
| Reports | `GET /reports?from=YYYY-MM-DD&to=YYYY-MM-DD`, `GET /reports/employees?from=...&to=...`, `GET /dashboard`, `GET /profit` |
| Audit | `GET /audit` (append-only, no delete endpoint) |
| Retry | `GET /transaction-result?operation=sale&requestId=UUID` |
| Used devices | `GET /devices`, `POST /devices` (existing device input; defaults action purchase), `GET /devices/:id`, `PATCH /devices/:id` `{status}` |
| Repair services | `GET /services`, `GET /services/:id`, `POST /services` (camelCase RepairService; repair.services.manage); same product UUID stays sellable in POS |
| Repairs | `GET /repair-jobs` (alias jobs), `GET /repair-jobs/:id`, `POST /repair-jobs` (camelCase RepairJob; granular repairs.view/create/edit) |
| Shifts | `GET /shifts`, `GET /shifts/:id`, `POST /shifts`, `GET /shifts/:id/closing`, `POST /shifts/:id/close` `{counted,expenses,notes}`; server money totals and immutable closing |

## Private media and camera

Under `/stores/:storeId`:

- `POST /media` multipart fields `file`, `kind` (product/customer/profile/proof/device/repair/damage/document/payment-qr), optional `entityId`, `cameraJobId`. Returns `{id,path,url,mimeType,size,width,height}`. `path` is the SQL-compatible private storage path; URL expires after 5 minutes. No public storage directories.
- `POST /media/urls` `{paths:string[]}` -> map from path to fresh URLs. Permission checked before signing and on access.
- `GET /media/:id?token=...` authenticated short-lived signed media read.
- `DELETE /media/:id` authorized deletion only when no business attachment references it.
- `POST /camera/pairing` `{terminalId}` -> `{code,expiresAt}`.
- `POST /camera/pair` `{code,deviceName}` -> safe device pairing.
- `GET /camera/devices?terminalId=...` -> scoped active pairings.
- `DELETE /camera/devices/:id` -> revoke pairing.
- `POST /camera/jobs` `{terminalId,type,label,amount?,reference?,entityId?,deviceId?}` -> job (no image until receipt). Optional deviceId must identify an active own phone pairing for this counter.
- `GET /camera/jobs?terminalId=...` -> requesting counter's or paired phone's queue.
- `PATCH /camera/jobs/:id` `{status:'opened'|'captured'|'uploading'|'failed'|'cancelled'|'received',mediaId?}`. Only assigned phone may progress; requester may cancel. Repeated progress is idempotent; captured/uploading -> opened supports retaking before the request is completed. Received requires private upload belonging to that exact job; mediaId is rejected for other progress states. Disconnecting the phone cancels its pending jobs. DTO is `{id,terminalId,type,title,reference,amount,status,createdAt,expiresAt,mediaId,imagePath,imageUrl}`. Preview uses imageUrl; business records use imagePath (never a temporary signed URL).
- `GET /push/key` -> `{publicKey}`; `POST /push/subscriptions` Web Push subscription; `DELETE /push/subscriptions` own subscription endpoint. Push is optional, standards-based, and credentials are server-only.

Socket.IO namespace `/counter`, handshake `{auth:{accessToken,counterToken?}}`; websocket transport. Client emits `subscribe` `{storeId,terminalId}`. Server derives rooms from validated profile/session/device ownership. Events `camera.requested`, `camera.updated`, `camera.completed`, `data.changed`. No client-provided room name is accepted. Pending jobs remain available over REST after reconnect. Image owner is the requester; immutable uploaded_by identifies the paired phone. Employee switching cannot inherit another employee's camera job.

Errors use `{statusCode,message,code}`. PostgreSQL 42501 -> 403, conflicts -> 409, invalid business input -> 422. Never return raw SQL, stack traces, passwords, PIN hashes or provider secrets.

## Customer display on another browser / TV

The existing local BroadcastChannel path is separate. This REST capability path supports displays on other browsers over the deployed API. It does not grant a staff login or access to business APIs.

- Public `POST /displays` `{deviceName?}` -> `{displaySessionId,pairingCode,displayToken,expiresAt}`. Eight-character code expires in10minutes; hashed display capability lasts24hours. Creation is limited to20per IP/hour. Keep displayToken in memory; do not put it in localStorage or URLs.
- Public `GET /displays/:id`, `Authorization: Bearer <displayToken>` -> `{status:'waiting'|'paired'|'revoked',displaySessionId,terminalId?,snapshot,updatedAt?}`. Revoked/expired capability returns401. Use a separate raw fetch with credentials omitted, not the staff JWT refresh interceptor. Response uses Cache-Control:no-store.
- Staff `POST /stores/:storeId/displays/pair` `{pairingCode,terminalId}` -> `{id,displaySessionId,deviceName,terminalId,status:'paired'}`. Explicit devices.pair AND sales.create permissions; consumed code cannot be reused.
- Staff `GET /stores/:storeId/displays?terminalId=...` -> rows `{id,displaySessionId,deviceName,terminalId,lastSeenAt,online,connected}`. Online is true only when the display polled within8seconds.
- Staff `PUT /stores/:storeId/displays/:id` `{terminalId,snapshot}` -> `{ok:true}`. Snapshot matches frontend CustomerDisplayState: modes, item name/variant/quantity/unitPrice, totals/discount/coupon, payment instructions, invoice reference, and store display preferences. Unknown properties are rejected at every nesting level. No purchase cost, minimum price, stock, employee controls, credit history or proof fields are accepted.
- Staff `DELETE /stores/:storeId/displays/:id` revokes an owned current-session pairing.

Display may poll each second. Cashier should publish on changes and heartbeat current state every5seconds. Snapshot expires to an empty IDLE screen after10seconds without publication, after account/session/PIN access ends, or when the current branch/profile loses access. Both profile and authenticated session are bound to the specific counter pairing; a different terminal/session cannot publish. Payment QR may use safe PNG/JPEG/WebP data images, HTTPS image addresses, or configured localhost API media URLs in development. Public display has no subscription to internal staff WebSocket rooms.

## New custom services

Sale lines may use `productId:'custom:UUID'` with `customService:{name,description?,sellingPrice,minimumSellingPrice?}`. Server requires `services.create_custom`; effective minimum is max(server setting customServiceMinimum, supplied minimum). Lower prices still use bargaining/manager approval policy. No inventory movement is generated. Invoice stores a service snapshot. One-sale catalog rows are archived atomically and excluded from catalog management lists. Service reference is bound to request/actor; retries return the same invoice.

Nonzero repair advances are denied until a repair-linked confirmed payment workflow exists; use actual POS/customer collections for money. Shift purchases are zero until a confirmed cash purchase ledger event exists. Closing cash counts real receipts and refunds/reversals once and freezes its snapshot.

## Instant phone camera bridge (4C.2)

See [camera bridge endpoints and security](CAMERA-BRIDGE.md). Captures now use an authenticated atomic multipart endpoint with idempotency, scoped realtime, private thumbnails and diagnostic upload verification.

