import {readFileSync} from "node:fs";
const version=Object.fromEntries(readFileSync("mobile/android/release.properties","utf8").trim().split(/\r?\n/).map(line=>line.split("=")));
import {spawnSync} from "node:child_process";
// A separate artifact; the approved browser/Tauri production build stays in dist/.
const result=spawnSync(process.execPath,["node_modules/vite/bin/vite.js","build","--outDir","dist-mobile"],{stdio:"inherit",env:{...process.env,VITE_MOBILE_VERSION:version.versionName,VITE_MOBILE_BUILD:version.versionCode,VITE_DATA_PROVIDER:"api",VITE_USE_MOCK_AUTH:"false",VITE_API_URL:"/api/v1",VITE_BUNDLED_MOBILE:"true",VITE_MOBILE_TEST:process.env.MOBILE_RELEASE==="true"?"false":"true"}});
process.exitCode=result.status??1;
