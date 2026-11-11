import {useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {listProductDrafts,syncProductDrafts,productDraftDb,type ProductDraft} from '../../lib/product-drafts';
import {Button} from '../../components/ui/button';
import {ConfirmDialog} from '../../components/ui/workspace';
import {localDemoEnabled} from '../../lib/config';
export function ProductDraftsPanel(){
 const [drafts,setDrafts]=useState<ProductDraft[]>([]),[discard,setDiscard]=useState(''),[busy,setBusy]=useState(false),navigate=useNavigate();
 useEffect(()=>{if(localDemoEnabled)return;const load=()=>void listProductDrafts().then(setDrafts);load();window.addEventListener('taha-drafts-changed',load);return()=>window.removeEventListener('taha-drafts-changed',load);},[]);
 if(!drafts.length)return null;
 return <section className="panel product-drafts-panel"><h2>Product drafts</h2><p className="text-muted text-xs">Pending changes remain on this counter. Stock is recorded after the server accepts the draft.</p>{drafts.map(draft=><div className="product-draft-row" key={draft.id}><div><strong>{draft.input.name||'Untitled product'}</strong><span className={draft.status==='Conflict'?'text-danger':'text-muted'}>{draft.status}</span>{draft.error&&<small>{draft.error}</small>}</div><Button size="small" onClick={()=>navigate(`/products/new?draft=${draft.id}`)}>Review</Button><Button size="small" disabled={busy} onClick={()=>{setBusy(true);void productDraftDb.drafts.update(draft.id,{status:'Pending Sync'}).then(()=>syncProductDrafts()).finally(()=>setBusy(false));}}>Retry</Button><Button size="small" onClick={()=>setDiscard(draft.id)}>Discard</Button></div>)}<ConfirmDialog open={!!discard} title="Discard product draft?" description="This removes the unsynchronized draft and its queued images from this counter. Server records remain unchanged." onClose={()=>setDiscard('')} onConfirm={()=>void productDraftDb.drafts.delete(discard).then(()=>{setDiscard('');window.dispatchEvent(new Event('taha-drafts-changed'));})}/></section>;
}
