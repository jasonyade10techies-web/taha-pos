import pg from 'pg';

/** Explicit, separately run administration; never invoked by application startup. */
export function stagingTarget(environment=process.env){
 if(environment.TAHA_DEPLOYMENT_ENV!=='staging'||environment.TAHA_STAGING_DATABASE_APPROVED!=='true')throw Error('Explicit staging database approval is required.');
 const url=environment.MIGRATION_DATABASE_URL,expected=environment.TAHA_STAGING_DATABASE_NAME;
 if(!url||!expected||!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(expected))throw Error('An explicit staging database name and migration connection are required.');
 let address:URL;try{address=new URL(url);}catch{throw Error('A valid staging migration connection is required.');}
 if(!['postgresql:','postgres:'].includes(address.protocol)||decodeURIComponent(address.pathname.slice(1))!==expected||address.port==='55439'||/^taha_api_browser_/i.test(expected)||expected==='postgres')throw Error('The migration target does not match the approved staging database.');
 const local=environment.TAHA_RUNTIME==='local';
 if(local){if(!['127.0.0.1','localhost','[::1]'].includes(address.hostname))throw Error('Local rehearsal must use an isolated loopback database.');}
 else{if(['127.0.0.1','localhost','[::1]'].includes(address.hostname)||['disable','no-verify','allow','prefer'].includes(address.searchParams.get('sslmode')??''))throw Error('Cloud staging requires verified PostgreSQL TLS.');}
 return {url,address,expected,local};
}
export function stagingClient(target:ReturnType<typeof stagingTarget>){
 const address=new URL(target.url);if(!target.local)for(const key of ['sslmode','sslcert','sslkey','sslrootcert','ssl'])address.searchParams.delete(key);
 return new pg.Client({connectionString:address.toString(),connectionTimeoutMillis:8000,...(!target.local?{ssl:{rejectUnauthorized:true}}:{}),application_name:'taha-staging-administration'});
}
