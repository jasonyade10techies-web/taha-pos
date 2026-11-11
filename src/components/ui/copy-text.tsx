import {useState} from 'react';
import {Dialog} from './dialog';
import {Button} from './button';

/** Browser and bundled WebView clipboard, with an explicit manual fallback. */
export function useCopyText() {
  const [manual,setManual]=useState<string|null>(null);
  async function copy(text:string):Promise<boolean>{
    try {if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true;}} catch {/* Try the supported WebView/browser fallback. */}
    const previous=document.activeElement;
    const selection=document.getSelection(),ranges=selection?Array.from({length:selection.rangeCount},(_,i)=>selection.getRangeAt(i).cloneRange()):[];
    const field=document.createElement('textarea');field.value=text;field.setAttribute('readonly','');field.setAttribute('aria-label','Temporary copy text');
    field.style.cssText='position:fixed;left:-9999px;top:0;';document.body.append(field);field.select();
    let copied=false;
    try {copied=typeof document.execCommand==='function'&&document.execCommand('copy');} catch {/* Manual selection remains available. */}
    finally {field.remove();if(previous instanceof HTMLElement)previous.focus();if(selection){selection.removeAllRanges();ranges.forEach(range=>selection.addRange(range));}}
    if(!copied)setManual(text);
    return copied;
  }
  const fallback=<Dialog open={manual!==null} onOpenChange={open=>{if(!open)setManual(null);}} title="Copy text" description="Automatic copy is unavailable. Select the text, then use Copy or Ctrl+C.">
    <textarea className="input" aria-label="Text to copy" readOnly rows={10} value={manual??''} onFocus={e=>e.currentTarget.select()}/>
    <div className="dialog-actions"><Button onClick={()=>setManual(null)}>Done</Button></div>
  </Dialog>;
  return {copy,fallback};
}
