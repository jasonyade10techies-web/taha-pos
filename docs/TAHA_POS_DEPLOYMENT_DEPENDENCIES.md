# R2B deployment dependencies

Evidence date: 12 November 2026. This is preparation for isolated staging, not deployment approval or a production certificate.

| Dependency | Required capability | Current evidence / gate |
|---|---|---|
| Purchased Hostinger account | Eligible managed Node entitlement and an available application slot | Owner selected the browser's **Unlimited** plan. R1 recorded expiry 20 October 2027. Current entitlement/resources **UNKNOWN**: connector returns a different `hostinger_business_v3` inventory; official hPanel remained on its loading screen. No account settings changed. |
| Managed Node | Node 22 or 24; root package install, compiled entry `server.cjs`, platform `PORT`, private environment variables | Versioned combined release is implemented. Linux native `argon2`/`sharp` installation must pass on actual hosting. Local Windows installation is not Linux acceptance. |
| HTTPS origin | Owner-approved staging domain/temporary domain and TLS certificate | No staging domain selected or changed. Frontend and `/api/v1` share one origin. |
| Hosting proxy | Verified proxy source address/CIDR and forwarded HTTPS behavior | Explicit `TAHA_TRUST_PROXY`, default off, no trust-all. Actual hPanel topology must be verified before enabling companion private-media reads. Do not infer proxy trust from an arbitrary forwarded header. |
| External PostgreSQL | Current SQL engine, `pgcrypto`, custom schemas/functions/RLS, transaction-local claims, `SET LOCAL ROLE`, row/advisory locks | No hosted database provisioned. Restricted runtime and separate migration identities are mandatory. Actual provider role/extension permissions and pool semantics must be rehearsed. Hostinger's included MySQL is not a substitute. |
| Database TLS/pooling | Verified server certificate, optional separately provisioned CA; bounded connections | Cloud uses `rejectUnauthorized:true` and checks actual connection TLS. Default pool 2, maximum 5 per instance. Budget all hosting instances. Provider pooling hostname can be separately approved for the staging migration command. |
| Private objects | Durable originals, derived images/thumbnails and private payment/repair/customer files | Local development filesystem preserved. Cloud requires private S3-compatible storage outside replaceable deployment directories. No live bucket or credentials created. |
| Upload protocol | Signed S3 form POST with exact byte range/expiry; authenticated PUT/GET/DELETE; browser CORS for the approved origin | Existing recovered MediaService retained. HTTP provider-contract tests do not certify an actual provider. A service merely labelled S3-compatible may not support signed POST. Verify before choosing it. |
| Sessions and synchronization | Durable PostgreSQL sessions/revisions, authenticated HTTPS polling | Implemented without incoming cloud WebSockets or an independent worker. LAN Socket.IO remains separate. |
| Staging identity/data | New owner secret and synthetic sample dataset only | Separate approval/name guards; seed rejects occupied domain tables and private-media metadata. No customer records or proofs copied. |
| Recovery/operations | PostgreSQL backup/PITR policy, object retention/versioning, restore rehearsal, logs and alerts | Private R1/R2A archives retained. Local release/restore preparation does not establish hosted backup retention. Owner must select recovery objectives and provider capabilities. |

## Managed-hosting facts versus account entitlement

Official documentation describes eligible Business/Cloud managed Node applications, including NestJS. It excludes inbound WebSockets, custom application ports, Docker and independent endless workers. Bounded Node cron jobs are available; their environment must be supplied explicitly. These general capabilities are **not proof** of the selected account's current quota or remaining slots.

Sources checked during R2B:

- [Managed Node limits](https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/)
- [Node deployment and supported builds](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/)
- [Bounded Node cron jobs](https://www.hostinger.com/support/how-to-run-cron-jobs-for-node-js-websites-at-hostinger/)
- [Included MySQL and external databases](https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/)

No VPS, root SSH, Caddy, Docker, systemd or incoming cloud Socket.IO is required for the preferred package. No external service has been purchased, no DNS modified and no cloud acceptance claimed.

## Smallest blocking owner actions

1. Supply the selected Unlimited plan's hPanel **Plan Details → Node/Web Apps allowance and resource limits**, or make that authenticated page accessible. Do not send credentials.
2. Approve one staging domain/temporary domain and external PostgreSQL/private-object providers with the capabilities above. Secrets belong in private configuration, never chat or a browser bundle.
3. Authorize the subsequent isolated staging deployment after reviewing the final artifact, tests and rollback procedure.

Windows/Android signing, printer/scanner/second-monitor acceptance and native offline financial acceptance remain separate production gates; they do not prevent a correctly isolated online browser staging demonstration.
