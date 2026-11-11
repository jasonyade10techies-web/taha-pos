import {spawnSync} from "node:child_process";
// A separate artifact; the approved browser/Tauri production build stays in dist/.
const result=spawnSync(process.execPath,["node_modules/vite/bin/vite.js","build","--outDir","dist-mobile"],{stdio:"inherit",env:{...process.env,VITE_DATA_PROVIDER:"api",VITE_USE_MOCK_AUTH:"false",VITE_API_URL:"/api/v1",VITE_BUNDLED_MOBILE:"true",VITE_MOBILE_TEST:process.env.MOBILE_RELEASE==="true"?"false":"true"}});
process.exitCode=result.status??1;
