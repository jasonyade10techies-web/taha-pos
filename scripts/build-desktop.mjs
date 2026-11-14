import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
const version=JSON.parse(readFileSync('src-tauri/tauri.conf.json','utf8')).version;
const env={...process.env,VITE_DATA_PROVIDER:'api',VITE_USE_MOCK_AUTH:'false',VITE_API_URL:'/api/v1',VITE_API_BASE_URL:'/api/v1',VITE_DEVICE_BRIDGE_URL:'/api/v1',VITE_BUNDLED_MOBILE:'false',VITE_MOBILE_TEST:'false',VITE_MOBILE_SHOP_URL:'',VITE_DEPLOYMENT_ENV:'staging'};
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','-b'],{stdio:'inherit',env});
execFileSync(process.execPath,['node_modules/vite/bin/vite.js','build','--outDir','dist-desktop'],{stdio:'inherit',env});
writeFileSync('dist-desktop/deployment.json',JSON.stringify({version,platform:'windows-x86_64',channel:'staging',ui:'bundled',dataProvider:'api',mockAuthentication:false,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()},null,2));
