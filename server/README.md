# TAHA MOBILES custom API

NestJS / TypeScript / PostgreSQL, REST `/api/v1`, authenticated Socket.IO `/counter`, development Swagger `/api/docs`.
Frontend remains in the project root; local IndexedDB/demo mode remains separate.

```powershell
cd server
npm ci
Copy-Item .env.example .env
# Set DATABASE_URL, MIGRATION_DATABASE_URL, JWT_SECRET and allowed origins.
npm run migrate
# Provision initial owner using PROVISION_EMAIL / NAME / PASSWORD environment variables.
npm run provision
npm run dev
```

Managed production: `npm run build`, `npm start`, Node 22/24 and platform `PORT`; use [the managed guide](../docs/HOSTINGER_DEPLOYMENT.md). Package from project root with `npm run package:managed`. Docker/Compose is optional for a future VPS decision.

Validation: `npm run build`, `npm run lint`, `npm test`. Tests require a localhost PostgreSQL administrator and create isolated databases.
`npm run test:serve` starts a disposable browser fixture at API3000, with test-only accounts; never use it as a production server.

See [API contract](docs/API.md), [deployment and security](docs/DEPLOYMENT.md), and [migration inventory](docs/MIGRATIONS.md).
