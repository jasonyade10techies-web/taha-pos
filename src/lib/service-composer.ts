/** A mention is one atomic editor unit, never an HTML fragment or inferred SKU. */
export interface ServiceMention {productId:string;label:string}
export interface ServiceDocument {before:string;mention?:ServiceMention;after:string}
export interface ComposerSelection {start:number;end:number}
export const emptyServiceDocument=(text=''):ServiceDocument=>({before:text,after:''});
export const composerLength=(doc:ServiceDocument)=>doc.before.length+(doc.mention?1:0)+doc.after.length;
export const composerText=(doc:ServiceDocument)=>[doc.before,doc.mention?.label??'',doc.after].join('').replace(/\s+/g,' ').trim();
export function deletionRange(doc:ServiceDocument,selection:ComposerSelection,inputType:string):ComposerSelection{
 if(selection.start!==selection.end)return selection;
 const text=doc.before+(doc.mention?'\uFFFC':'')+doc.after,at=selection.start,backward=inputType.includes('Backward');
 if(inputType.includes('Word')){
  if(backward){const prefix=text.slice(0,at),match=prefix.match(/(?:\uFFFC|[^\s\uFFFC]+)\s*$/);return {start:match?at-match[0].length:Math.max(0,at-1),end:at};}
  const match=text.slice(at).match(/^\s*(?:\uFFFC|[^\s\uFFFC]+)/);return {start:at,end:match?at+match[0].length:Math.min(text.length,at+1)};
 }
 return {start:Math.max(0,at-(backward?1:0)),end:Math.min(text.length,at+(backward?0:1))};
}
export function replaceComposerRange(doc:ServiceDocument,selection:ComposerSelection,text:string):ServiceDocument{
 const length=composerLength(doc),start=Math.max(0,Math.min(length,selection.start)),end=Math.max(start,Math.min(length,selection.end));
 const insert=text.replace(/[\r\n]+/g,' '),at=doc.before.length;
 if(!doc.mention)return emptyServiceDocument((doc.before+doc.after).slice(0,start)+insert+(doc.before+doc.after).slice(end));
 if(end<=at)return {...doc,before:doc.before.slice(0,start)+insert+doc.before.slice(end)};
 if(start>at)return {...doc,after:doc.after.slice(0,start-at-1)+insert+doc.after.slice(end-at-1)};
 return emptyServiceDocument(doc.before.slice(0,start)+insert+doc.after.slice(Math.max(0,end-at-1)));
}
export function selectMention(doc:ServiceDocument,start:number,end:number,mention:ServiceMention):ServiceDocument{
 // Replacing a product keeps surrounding work description. Selecting a second
 // mention replaces identity rather than silently consuming a second component.
 const base=doc.mention?replaceComposerRange(doc,{start:doc.before.length,end:doc.before.length+1},''):doc;
 const text=base.before+base.after;
 return {before:text.slice(0,start),mention,after:text.slice(end)};
}
export function activeProductQuery(doc:ServiceDocument,caret:number){
 if(doc.mention)return null;
 const text=doc.before+doc.after,prefix=text.slice(0,caret),at=prefix.lastIndexOf('@');
 if(at<0||at>0&&!/\s/.test(prefix[at-1]))return null;
 const query=prefix.slice(at+1);if(query.includes('@')||query.length>100)return null;
 return {start:at,end:caret,query};
}
