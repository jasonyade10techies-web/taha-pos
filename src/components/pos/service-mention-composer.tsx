import {useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {Check,Package,X} from 'lucide-react';
import type {PosProduct} from '../../types/product';
import {searchProducts,type SearchTerm} from '../../lib/product-search';
import {activeProductQuery,composerLength,composerText,deletionRange,emptyServiceDocument,replaceComposerRange,selectMention,type ServiceDocument,type ComposerSelection} from '../../lib/service-composer';
import {MediaImage} from '../media/media-image';
import {currency} from '../../lib/utils';
import '../../styles/service-mention.css';

const atomic=(node:Node)=>node instanceof HTMLElement&&node.hasAttribute('data-mention-id');
function size(node:Node):number{return atomic(node)?1:node.nodeType===Node.TEXT_NODE?(node.textContent?.replace(/\u200B/g,'').length??0):Array.from(node.childNodes).reduce((n,c)=>n+size(c),0);}
function offsetAt(root:Node,target:Node,offset:number):number{
 let value=0,found=false;
 const walk=(node:Node)=>{if(found)return;if(node===target){value+=node.nodeType===Node.TEXT_NODE?(node.textContent?.slice(0,offset).replace(/\u200B/g,'').length??0):Array.from(node.childNodes).slice(0,offset).reduce((n,c)=>n+size(c),0);found=true;return;}if(atomic(node)){if(node.contains(target)){value+=offset?1:0;found=true;}else value++;return;}if(node.nodeType===Node.TEXT_NODE){value+=size(node);return;}Array.from(node.childNodes).forEach(walk);};walk(root);return value;
}
function selectionOf(root:HTMLElement):ComposerSelection|null{
 const s=window.getSelection();if(!s?.anchorNode||!s.focusNode||!root.contains(s.anchorNode)||!root.contains(s.focusNode))return null;
 const a=offsetAt(root,s.anchorNode,s.anchorOffset),b=offsetAt(root,s.focusNode,s.focusOffset);return {start:Math.min(a,b),end:Math.max(a,b)};
}
function restore(root:HTMLElement,caret:number){
 const range=document.createRange();let left=caret,placed=false;
 const walk=(node:Node)=>{if(placed)return;if(atomic(node)){if(left<=1){if(left===0)range.setStartBefore(node);else range.setStartAfter(node);placed=true;}else left--;return;}if(node.nodeType===Node.TEXT_NODE){if(left<=(node.textContent?.replace(/\u200B/g,'').length??0)){range.setStart(node,node.textContent==='\u200B'?1:left);placed=true;}else left-=size(node);return;}Array.from(node.childNodes).forEach(walk);};walk(root);if(!placed){range.selectNodeContents(root);range.collapse(false);}else range.collapse(true);const s=window.getSelection();s?.removeAllRanges();s?.addRange(range);
}
export function ServiceMentionComposer({value,onChange,products,dictionary,canLink=true,onSelectProduct,onRemoveProduct,onInspect}:{value:ServiceDocument;onChange:(doc:ServiceDocument)=>void;products:PosProduct[];dictionary?:SearchTerm[];canLink?:boolean;onSelectProduct:(p:PosProduct)=>void;onRemoveProduct:()=>void;onInspect?:(p:PosProduct)=>void}){
 const composing=useRef(false);
 const editor=useRef<HTMLDivElement>(null),pending=useRef<number|null>(null),saved=useRef<ComposerSelection>({start:0,end:0}),history=useRef<ServiceDocument[]>([]),future=useRef<ServiceDocument[]>([]);
 const [caret,setCaret]=useState(composerLength(value)),[dismissed,setDismissed]=useState(false),[active,setActive]=useState(0),[anchor,setAnchor]=useState({left:0,top:46});
 const id=useId(),query=canLink&&!dismissed?activeProductQuery(value,caret):null;
 const eligible=products.filter(p=>!['services','service','phones','used phones'].includes(p.category.toLowerCase()));
 const candidates=query?searchProducts(eligible.map(p=>({...p,name:[p.name,p.qualityGrade,p.color].filter(Boolean).join(' · ')})),query.query.replace(/\bpanal\b|\bpanl\b/gi,'panel'),dictionary).slice(0,5).map(p=>eligible.find(v=>v.id===p.id)!):[];
 const selected=value.mention?products.find(p=>p.id===value.mention?.productId):undefined;
 useLayoutEffect(()=>{if(pending.current!==null&&editor.current){editor.current.focus();restore(editor.current,pending.current);pending.current=null;}},[value]);
 const capture=()=>{const root=editor.current;if(!root)return;const next=selectionOf(root);if(!next)return;saved.current=next;setCaret(next.end);const s=window.getSelection();if(s?.rangeCount){const rect=s.getRangeAt(0).getBoundingClientRect(),box=root.getBoundingClientRect();if(rect.height)setAnchor({left:Math.max(0,Math.min(rect.left-box.left,box.width-285)),top:Math.max(46,rect.bottom-box.top+8)});}};
 const commit=(next:ServiceDocument,position:number,track=true)=>{if(track){history.current.push(value);future.current=[];}if(value.mention&&!next.mention)onRemoveProduct();pending.current=position;saved.current={start:position,end:position};setCaret(position);setDismissed(false);setActive(0);onChange(next);};
 const insert=(text:string,selection=selectionOf(editor.current!)??saved.current)=>commit(replaceComposerRange(value,selection,text),selection.start+text.replace(/[\r\n]+/g,' ').length);
 const choose=(product:PosProduct)=>{if(!query)return;const doc=selectMention(value,query.start,query.end,{productId:product.id,label:product.name});commit({...doc,after:doc.after.startsWith(' ')?doc.after:' '+doc.after},doc.before.length+2);onSelectProduct(product);setDismissed(true);};
 const beforeInput=(event:InputEvent)=>{const range=selectionOf(editor.current!)??saved.current;if(event.isComposing||composing.current)return;
  if(event.inputType.startsWith('insert')){if(event.inputType==='insertFromPaste')return;event.preventDefault();insert(event.data??(event.inputType==='insertParagraph'?' ':''),range);}
  else if(event.inputType.startsWith('delete')){event.preventDefault();const next=deletionRange(value,range,event.inputType);commit(replaceComposerRange(value,next,''),next.start);}
 };
 // Use the native beforeinput event: React's legacy text event drops inputType.
 useEffect(()=>{const node=editor.current;if(!node)return;node.addEventListener('beforeinput',beforeInput);return()=>node.removeEventListener('beforeinput',beforeInput);});
 useEffect(()=>{const frame=requestAnimationFrame(()=>editor.current?.focus());return()=>cancelAnimationFrame(frame);},[]);
 return <div className="service-composer-wrap">
  <div ref={editor} className="input service-composer" contentEditable suppressContentEditableWarning role="textbox" aria-label="Service name" aria-multiline="false" aria-autocomplete="list" aria-controls={query?id:undefined} aria-activedescendant={query&&candidates.length?id+'-'+Math.min(active,candidates.length-1):undefined} data-placeholder="Type @ to choose a part, then describe the work" onSelect={capture} onKeyUp={capture} onMouseUp={capture}
   onInput={e=>{ // Browser autofill/accessibility input can replace plain text directly.
    if(composing.current)return;
    if(!value.mention){const text=(e.currentTarget.textContent??'').replace(/\u200B/g,'');if(text!==value.before+value.after){const at=selectionOf(e.currentTarget)?.end??text.length;commit(emptyServiceDocument(text),at);}}
   }}
   onCompositionStart={()=>{composing.current=true;}}
   onCompositionEnd={e=>{composing.current=false;const text=(e.currentTarget.textContent??'').replace(/\u200B/g,'');if(!value.mention)commit(emptyServiceDocument(text),text.length);else{ // IME uses native text nodes; retain only our known token identity.
    const node=e.currentTarget.querySelector('[data-mention-id]');if(node){const range=document.createRange();range.selectNodeContents(e.currentTarget);range.setEndBefore(node);const before=range.toString().replace(/\u200B/g,'');range.selectNodeContents(e.currentTarget);range.setStartAfter(node);const after=range.toString().replace(/\u200B/g,'');commit({...value,before,after},selectionOf(e.currentTarget)?.end??composerLength(value));}
   }}}
   onPaste={e=>{e.preventDefault();insert(e.clipboardData.getData('text/plain'));}}
   onCopy={e=>{const selection=selectionOf(e.currentTarget);if(!selection)return;const model=value.before+(value.mention?'\uFFFC':'')+value.after;const text=model.slice(selection.start,selection.end).replace('\uFFFC',value.mention?.label??'');e.clipboardData.setData('text/plain',text);e.preventDefault();}}
   onCut={e=>{const selection=selectionOf(e.currentTarget);if(!selection)return;const model=value.before+(value.mention?'\uFFFC':'')+value.after;e.clipboardData.setData('text/plain',model.slice(selection.start,selection.end).replace('\uFFFC',value.mention?.label??''));e.preventDefault();commit(replaceComposerRange(value,selection,''),selection.start);}}
   onKeyDown={e=>{if(e.nativeEvent.isComposing||composing.current)return;if(e.key==='Home'||e.key==='End'){if(!e.shiftKey){e.preventDefault();const at=e.key==='Home'?0:composerLength(value);restore(e.currentTarget,at);saved.current={start:at,end:at};setCaret(at);}return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();const from=e.shiftKey?future:history,to=e.shiftKey?history:future,next=from.current.pop();if(next){to.current.push(value);commit(next,composerLength(next),false);}return;}if(query){if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();setActive(i=>(i+(e.key==='ArrowDown'?1:-1)+Math.max(candidates.length,1))%Math.max(candidates.length,1));return;}if((e.key==='Enter'||e.key==='Tab')&&candidates.length){e.preventDefault();choose(candidates[Math.min(active,candidates.length-1)]);return;}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setDismissed(true);return;}}if(e.key==='Enter'){e.preventDefault();insert(' ');} }}>
   {value.before||(value.mention?'\u200B':'')}{value.mention&&<span key={value.mention.productId} contentEditable={false} className="inline-product-mention" data-mention-id={value.mention.productId} title={selected?[selected.name,selected.qualityGrade,selected.color].filter(Boolean).join(' · '):'Linked product needs review'}>{value.mention.label}<Check size={12}/></span>}{value.after||(value.mention?'\u200B':'')}
  </div>
  {query&&<div className="service-mention-popup" style={{left:anchor.left,top:anchor.top}} role="listbox" aria-label="Product mentions" id={id}>
   {candidates.map((p,i)=><button type="button" role="option" aria-selected={i===active} id={id+'-'+i} key={p.id} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(p)}><span className="mention-image">{p.image?<MediaImage src={p.image} alt=""/>:<Package size={20}/>}</span><span><strong>{p.name}</strong><small>{[p.compatibleModel,p.qualityGrade,p.color].filter(Boolean).join(' · ')}</small><small>{p.quantity} available · {currency(p.sellingPrice)}</small></span></button>)}
   {!candidates.length&&<p>No matching part. Try a model, alias or shorter name. Nothing is linked.</p>}
  </div>}
  {value.mention&&<div className="mention-actions"><button type="button" onClick={()=>{commit(emptyServiceDocument(value.before+'@'+value.after),value.before.length+1);}}>Change product</button>{selected&&onInspect&&<button type="button" onClick={()=>onInspect(selected)}>Inspect linked product</button>}<button type="button" aria-label="Remove product mention" onClick={()=>commit(emptyServiceDocument(value.before+value.after),value.before.length)}><X size={12}/>Remove</button></div>}
  <span className="sr-only" aria-live="polite">{composerText(value)}</span>
 </div>;
}
