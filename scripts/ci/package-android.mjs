import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const args=['scripts/android-release.mjs','--apk','mobile/android/app/build/outputs/apk/debug/app-debug.apk','--output','artifacts/android-release','--channel','test','--notes','docs/r3a/ANDROID_RELEASE_NOTES.txt'];
if(existsSync('.test-postgres/r3a-ci-previous/release.json'))args.push('--previous-manifest','.test-postgres/r3a-ci-previous/release.json','--previous-apk','.test-postgres/r3a-ci-previous/previous.apk');
execFileSync(process.execPath,args,{stdio:'inherit'});
