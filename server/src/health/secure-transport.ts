import type {Request} from 'express';
import type {Configuration} from '../config';
/** Express evaluates req.secure against the explicitly configured proxy CIDRs.
 * A raw X-Forwarded-Proto header alone never grants cleartext LAN access. */
export function secureTransport(request:Request,config:Pick<Configuration,'cloud'|'trustedProxy'>){
 return Boolean((request.socket as {encrypted?:boolean}).encrypted)||Boolean(config.cloud&&config.trustedProxy&&request.secure);
}
