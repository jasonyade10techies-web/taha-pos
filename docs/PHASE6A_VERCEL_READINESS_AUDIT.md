# Phase 6A Vercel readiness audit

Audit started29October2026. This is a live progress report; source findings take precedence over historical Phase5D.2 claims. No cloud deployment has occurred at this checkpoint.

## Initial source evidence

| Module | Existing status | Cloud obstacle / required gate |
|---|---|---|
| React/Vite core UI and routes | Implemented browser pages; previous164passing local browser checks | SPA/API routing, public cloud config, current build/HTTPS acceptance |
| NestJS REST API | Real auth/business/SQL services | Vercel entrypoint/environment and safe readiness; no LAN listener in functions |
| PostgreSQL transaction engine | Atomic/idempotent SQL, RLS/permissions, stock locks, credit/returns | Isolated managed database, compatible owner/runtime roles/extensions, pooled TLS and explicit migrations |
| Authentication | Real Argon2/password, bearer access/HttpOnly refresh, strict origin and DB sessions | Actual shared-domain login/refresh/logout and secure cookie forwarding; no staged owner credentials yet |
| Products/inventory/POS/services/customers/credit/returns | API repositories and PostgreSQL business operations exist | Fresh isolated financial checks then actual staging journeys; don't infer end-to-end completion |
| Reports/Dashboard | API services plus local demo counterparts | Fresh provider matrix and cross-device invalidation |
| Private media | PostgreSQL metadata plus FileStorage local/S3 driver | Default local disk unsuitable;4.5MB function limit requires authorized direct upload flow |
| Realtime/devices | Socket.IO gateway, memory Map and15s presence timer; persistent DB jobs/heartbeats | No reliance on instance memory; use DB polling for staging; native/LAN separate |
| Sync | stores/:storeId/sync/changes revision endpoint exists | Wire reliable visible-browser refresh and test two sessions |
| Android companion | Native KeyStore/pin/QR enrollment; latest documented build10 | Actual cloud ingress TLS policy and physical testing remain distinct |
| Mobile browser | Dedicated React mobile app/components exist | Ensure same-domain entry routes and browser-safe auth/camera/receipt behavior |
| Windows/offline | Tauri/SQLite/outbox foundations | Native EXE/hardware acceptance remains open; not provided by Vercel |
| Hosting access | No Vercel CLI/project/auth files found in checked standard locations; no cloud env credentials | Establish real account/team/approved plan and isolated DB/private storage |

## Boundaries

Current repository has no Git metadata. No resources purchased, no billing enabled, no production/customer data copied. October22 counts176backend/164browser/24Android are historical. Fresh results will be recorded separately. Native/LAN capability is not proof of hosted mobile browser behavior.

## Priority blockers

P0: actual staging hosting/account/resources and secure sessions; database integrity; private durable media; core cross-device acceptance. P1: function lifecycle/polling/cache correctness, backup restore, restricted sample users and realistic validated seed. P2: remaining presentational defects only; preserve approved design.
