'use strict';
// Root entry for Hostinger's server-side Node/NestJS ZIP deployment.
// The compiled backend and frontend are already included; no Vite server.
try{require('./server.cjs');}catch{
 console.error('Taha POS startup entry failed. Check private runtime diagnostics.');
 process.exitCode=1;
}
