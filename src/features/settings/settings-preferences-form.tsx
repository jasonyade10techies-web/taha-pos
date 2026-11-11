import {useState} from 'react';
import {RecordForm,type FormField,type FormValues} from '../../components/ui/workspace';
import {Button} from '../../components/ui/button';
/** Isolated draft feedback; saving never changes unrelated settings fields. */
export function SettingsPreferencesForm({fields,initial,busy,onSubmit}:{fields:FormField[];initial:FormValues;busy:boolean;onSubmit:(values:FormValues)=>void}){
 const [dirty,setDirty]=useState(false),[reset,setReset]=useState(0);
 return <RecordForm key={reset} fields={fields} initial={initial} busy={busy} disabled={!dirty} submit="Save Settings" onSubmit={onSubmit} onValuesChange={values=>setDirty(fields.some(field=>values[field.key]!==initial[field.key]))}>
  <div className="settings-draft-state"><span role="status">{dirty?'Unsaved changes':'All changes saved'}</span><Button disabled={!dirty||busy} onClick={()=>{setReset(n=>n+1);setDirty(false);}}>Discard Changes</Button></div>
 </RecordForm>;
}
