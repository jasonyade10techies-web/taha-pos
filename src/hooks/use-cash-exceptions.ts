import {useQuery} from '@tanstack/react-query';
import {useSessionStore} from '../stores/session-store';
import {usePermission} from './use-permission';
import {cashRecords} from '../lib/desktop/reconciliation';
import {nativeDesktop} from '../lib/desktop/runtime';
import {apiEnabled} from '../lib/config';
export function useCashExceptions(){
 const profile=useSessionStore(s=>s.profile),store=useSessionStore(s=>s.context?.store?.id);
 const allowed=usePermission('sync.reconcile_cash')&&['owner','manager'].includes(profile?.role??'');
 return useQuery({queryKey:['cash-exceptions',profile?.id,store],queryFn:cashRecords,enabled:allowed&&(nativeDesktop||apiEnabled),refetchInterval:15000});
}

