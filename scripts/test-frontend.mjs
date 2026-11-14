import {spawn,spawnSync} from 'node:child_process';
import path from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Resolve existing tooling, never install packages or skip PDF assertions.
const supplied=process.env.TAHA_PDF_PYTHON;
const candidates=supplied?[supplied]:[path.join(homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','python',process.platform==='win32'?'python.exe':'bin/python3'),process.platform==='win32'?'python':'python3'];
const python=candidates.find(candidate=>spawnSync(candidate,['-c','from pypdf import PdfReader'],{windowsHide:true,stdio:'ignore'}).status===0);
if(!python)throw Error('PDF tests require an existing Python with pypdf. Set TAHA_PDF_PYTHON to that executable; no tests have started.');
if(spawnSync('pdfinfo',['-v'],{windowsHide:true,stdio:'ignore'}).status!==0)throw Error('PDF tests require pdfinfo on PATH; no tests have started.');
console.log('PDF test prerequisites verified before starting the complete browser suites.');
for(const config of ['playwright.local.config.ts','playwright.reconciliation.config.ts']){
 const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(root,'node_modules','@playwright','test','cli.js'),'test','--config',config,...process.argv.slice(2)],{cwd:root,env:{...process.env,TAHA_PDF_PYTHON:python},windowsHide:true,stdio:'inherit'});child.once('error',reject);child.once('exit',code=>resolve(code));});
 if(code!==0){process.exitCode=code??1;break;}
}
