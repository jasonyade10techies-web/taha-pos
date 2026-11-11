import type {Actor} from '../database/database.service';

/** Cloud mutations commit durable SQL revisions. Browsers poll those revisions.
 * This adapter deliberately has no sockets, timers, rooms or instance presence. */
export class PollingGateway{
 async hasDevicePresence(_storeId:string,_deviceId:string){return false;}
 async changed(_actor:Actor,_storeId:string,_resource:string){}
 async camera(_job:Record<string,unknown>,_event:string){}
 async pairingEvent(_pair:Record<string,unknown>,_event:string,_online?:boolean){}
 async devicePresence(_device:Record<string,unknown>,_online:boolean){}
 async sendSession(_sessionId:string,_event:string,_payload:unknown,_profileId?:string){}
}
