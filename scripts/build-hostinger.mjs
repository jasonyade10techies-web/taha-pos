import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const env={...process.env,VITE_DATA_PROVIDER:'api',VITE_USE_MOCK_AUTH:'false',VITE_API_URL:'/api/v1',VITE_API_BASE_URL:'/api/v1',VITE_DEVICE_BRIDGE_URL:'/api/v1',VITE_BUNDLED_MOBILE:'false',VITE_MOBILE_TEST:'false',VITE_MOBILE_SHOP_URL:''};
execFileSync(process.execPath,['scripts/build-cloud.mjs'],{stdio:'inherit',env});
execFileSync(process.execPath,['scripts/build-managed.mjs'],{cwd:'server',stdio:'inherit',env});
writeFileSync('dist-staging/deployment.json',JSON.stringify({version:'0.5.0-r3a',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dataProvider:'api',mockAuthentication:false,apiBase:'/api/v1'},null,2));
console.log('Source-root application built. Start with npm run start:hostinger; configure approved cloud resources separately.');
