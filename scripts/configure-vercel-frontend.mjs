import {writeFileSync} from 'node:fs';
import {validateCloudFrontend,validatedApiOrigin} from './cloud-frontend-config.mts';
try {
  const args=process.argv.slice(2),get=name=>{const at=args.indexOf(name);return at<0?'':args[at+1]||'';};
  const origin=validatedApiOrigin(get('--api-origin'));
  validateCloudFrontend({VITE_DEPLOYMENT_ENV:'staging',VITE_DATA_PROVIDER:'api',VITE_USE_MOCK_AUTH:'false'},'staging');
  const config={
    $schema:'https://openapi.vercel.sh/vercel.json',framework:'vite',
    buildCommand:'node scripts/build-cloud.mjs',outputDirectory:'dist-staging',
    routes:[
      {src:'/(.*)',headers:{'X-Robots-Tag':'noindex, noarchive, nofollow','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'},continue:true},
      {src:'/api',dest:`${origin}/api`},
      {src:'/api/(.*)',dest:`${origin}/api/$1`},
      {handle:'filesystem'},
      {src:'/assets/(.*)',status:404},
      {src:'/(.*)',dest:'/index.html'},
    ],
  };
  writeFileSync(get('--output')||'vercel.json',JSON.stringify(config,null,2)+'\n',{flag:'wx'});
  console.log('Created staging frontend routing for the supplied API origin. Existing files are never overwritten.');
} catch(error) {console.error(error instanceof Error?error.message:'Could not create frontend configuration.');process.exitCode=1;}
