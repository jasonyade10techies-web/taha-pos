import { useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Dialog } from "./dialog";
export function SheetSelect({label,value,options,onChange,disabled=false}:{label:string;value:string;options:{value:string;label:string}[];onChange:(value:string)=>void;disabled?:boolean}){
  const [open,setOpen]=useState(false),[search,setSearch]=useState("");
  return <><button className="input sheet-select-trigger" type="button" aria-label={label} aria-haspopup="dialog" disabled={disabled} onClick={()=>{setSearch("");setOpen(true);}}><span>{options.find(o=>o.value===value)?.label||"Select…"}</span><ChevronDown size={16}/></button>
    <Dialog open={open} onOpenChange={setOpen} title={label} description="Choose an option." className="bottom-sheet"><label className="mobile-search"><Search size={18}/><input aria-label={`Search ${label}`} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…"/></label><div className="sheet-options">{options.filter(o=>o.label.toLowerCase().includes(search.toLowerCase())).map(o=><button type="button" key={o.value} onClick={()=>{onChange(o.value);setOpen(false);}} aria-pressed={value===o.value}>{o.label}{value===o.value&&<Check size={18}/>}</button>)}</div></Dialog></>;
}
