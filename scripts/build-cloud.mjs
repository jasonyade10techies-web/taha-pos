import {spawnSync} from 'node:child_process';
import {validateCloudFrontend} from './cloud-frontend-config.mts';
const env={...process.env,VITE_DEPLOYMENT_ENV:process.env.VITE_DEPLOYMENT_ENV||'staging',VITE_DATA_PROVIDER:process.env.VITE_DATA_PROVIDER||'api',VITE_USE_MOCK_AUTH:process.env.VITE_USE_MOCK_AUTH||'false',VITE_API_URL:process.env.VITE_API_URL||'/api/v1'};
validateCloudFrontend(env,'staging',true);
for(const args of [['node_modules/typescript/bin/tsc','-b','--pretty','false'],['node_modules/vite/bin/vite.js','build','--mode','staging','--outDir','dist-staging']]) {
 const result=spawnSync(process.execPath,args,{stdio:'inherit',env});
 if(result.status!==0){process.exitCode=result.status||1;break;}
}
