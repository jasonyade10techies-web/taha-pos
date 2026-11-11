import {Link} from 'react-router-dom';
import {useCashExceptions} from '../../hooks/use-cash-exceptions';
import {currency} from '../../lib/utils';
export function CashExceptionsNotice(){
 const query=useCashExceptions();const pending=(query.data?.rows??[]).filter(r=>!['POSTED','REFUNDED'].includes(r.state));
 if(!pending.length)return null;
 return <div className="auth-notice flex items-center justify-between gap-4 flex-wrap" role="status"><div><strong>{pending.length} retained cash receipts · {currency(pending.reduce((n,r)=>n+Number(r.collected||0),0))}</strong><p>Unresolved cash across all dates. These receipts are separate from posted sales and must be checked before cash closing.</p></div><Link className="button button-secondary" to="/settings?section=Synchronization">Review Exceptions</Link></div>;
}
