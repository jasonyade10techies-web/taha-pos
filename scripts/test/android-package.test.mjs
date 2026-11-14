import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {packageDownloads} from '../android-release.mjs';
test('download packaging refuses unexpected files instead of including secrets',async()=>{const directory=await mkdtemp(path.join(tmpdir(),'taha-download-package-'));try{await writeFile(path.join(directory,'.env'),'PRIVATE_FIXTURE');await assert.rejects(packageDownloads(directory,'test',12),/Unexpected\/private/);}finally{await rm(directory,{recursive:true,force:true});}});
