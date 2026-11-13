import {checkServerIdentity,TLSSocket} from 'node:tls';
import type {Duplex} from 'node:stream';

/** Verify the application's actual connection, including TLS-terminating proxies. */
export function verifiedPostgresTls(client:{host:string;connection:{stream:Duplex}}):boolean{
 const socket=client.connection.stream;
 if(!(socket instanceof TLSSocket)||!socket.encrypted||!socket.authorized||socket.destroyed||socket.connecting)return false;
 const certificate=socket.getPeerCertificate();
 return Boolean(certificate.raw)&&checkServerIdentity(client.host,certificate)===undefined;
}
