import {create} from 'zustand';
import type {PollStatus} from '../lib/api/revision-poller';
/** Browser freshness is separate from the native financial outbox. */
export const useCloudSyncStore=create<{status:PollStatus;lastSuccess:number|null}>(()=>({status:'connecting',lastSuccess:null}));
