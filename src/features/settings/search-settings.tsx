import {useState} from 'react';
import type {DemoSettings} from '../../types/demo';
import {defaultSearchDictionary} from '../../lib/product-search';
import {Button} from '../../components/ui/button';
import {useAction} from '../../hooks/use-repository';
import {repositories} from '../../lib/repositories';
export function SearchSettings({settings}:{settings:DemoSettings}){
 const [terms,setTerms]=useState(settings.searchDictionary??defaultSearchDictionary),action=useAction();
 return <div><p className="text-muted text-sm">Match local names, Roman Urdu terms and common spellings. These aliases affect search, never prices.</p>{terms.map((term,index)=><div className="search-dictionary-row" key={index}><label className="form-field">Name<input className="input" value={term.canonical} onChange={event=>setTerms(old=>old.map((value,i)=>i===index?{...value,canonical:event.target.value}:value))}/></label><label className="form-field">Aliases (comma separated)<input className="input" value={term.aliases.join(', ')} onChange={event=>setTerms(old=>old.map((value,i)=>i===index?{...value,aliases:event.target.value.split(',').map(alias=>alias.trimStart())}:value))}/></label><Button size="small" onClick={()=>setTerms(old=>old.filter((_,i)=>i!==index))}>Remove</Button></div>)}<Button onClick={()=>setTerms(old=>[...old,{canonical:'',aliases:[]}])}>Add Search Term</Button><div className="form-actions"><Button variant="primary" disabled={action.busy||terms.some(term=>!term.canonical.trim())} onClick={()=>void action.run(()=>repositories.settings.save({...settings,searchDictionary:terms.map(term=>({...term,aliases:term.aliases.map(alias=>alias.trim()).filter(Boolean)}))}),'Search dictionary saved')}>Save Dictionary</Button></div></div>;
}
