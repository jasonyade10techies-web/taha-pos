# Production deployment direction

The target is **Hostinger managed Node.js**, subject to confirmation of the hosting plan. The primary retail product is the bundled Taha POS Windows application. PostgreSQL remains authoritative; incoming cloud WebSockets are optional.

Use [the managed deployment guide](../../docs/HOSTINGER_DEPLOYMENT.md), `server/.env.managed.example` and `npm run package:managed` from the project root. Build: `npm run build`; start: `npm start`; Node 22 or 24; platform-assigned `PORT`; bind `0.0.0.0`. Private S3-compatible storage is supported. No Docker/root/SSH/systemd is required by that path.

The historical VPS procedure is retained in [PHASE4E-VPS-OPTIONAL.md](PHASE4E-VPS-OPTIONAL.md) only for an explicit future VPS choice. Nothing has been deployed to Hostinger.
