import type {PoolConfig} from 'pg';
import type {Configuration} from '../config';

/** One small pool per warm function instance; provider pooling bounds aggregate sockets. */
export function databasePoolOptions(config:Configuration):PoolConfig{
 const address=new URL(config.databaseUrl);
 if(config.cloud)for(const key of ['sslmode','sslcert','sslkey','sslrootcert','ssl'])address.searchParams.delete(key);
 return {connectionString:config.cloud?address.toString():config.databaseUrl,max:config.databasePoolMax,min:0,
  connectionTimeoutMillis:8000,idleTimeoutMillis:config.cloud?5000:30000,allowExitOnIdle:config.cloud,
  ...(config.cloud?{ssl:{rejectUnauthorized:true}}:{}),application_name:config.cloud?'taha-pos-cloud':'taha-pos'};
}
