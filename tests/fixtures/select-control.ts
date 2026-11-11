import {expect,type Page} from '@playwright/test';
/** Exercise the shipped searchable/Radix control, never its hidden native select. */
export async function chooseControl(page:Page,label:string,value:string){
 const currentLabel=label==='Source box'?'From':label==='Destination box'?'To':label;
 const native=page.getByLabel(currentLabel,{exact:true}).and(page.locator('select'));
 if(await native.count()){
  const text=await native.locator('option').evaluateAll((options,target)=>options.find(option=>(option as HTMLOptionElement).value===target)?.textContent??'',value);
  expect(text,'The requested option exists').not.toBe('');await native.locator('..').getByRole('button').click();await page.getByRole('menuitem',{name:text,exact:true}).click();return;
 }
 const control=page.getByRole('combobox',{name:currentLabel,exact:true});await expect(control).toBeEnabled();
 const visible=await page.evaluate(async({label,value})=>{
  const path='/src/lib/repositories/index.ts',r=(await import(path)).repositories;
  if(label==='Supplier')return(await r.suppliers.list()).find((item:{id:string})=>item.id===value)?.name??value;
  if(/Product/.test(label)){const product=await r.products.get(value);return product?.internalCode??product?.name??value;}
  if(/box|From|To|Destination/.test(label)){const location=(await r.locations.list()).find((item:{id:string})=>item.id===value);return location?.code??location?.name??value;}
  return value;
 },{label:currentLabel,value});
 await control.click();await control.fill(visible);await page.getByRole('listbox',{name:currentLabel+' options'}).getByRole('option').filter({hasText:visible}).click();
}
export async function chooseMaster(page:Page,label:string,value:string){
 const control=page.getByRole('combobox',{name:label,exact:true});await control.fill(value);
 const option=page.getByRole('option',{name:value,exact:true});
 if(await option.count())await option.click();else await page.getByRole('button',{name:`Create “${value}”`,exact:true}).click();
 await expect(control).toHaveValue(value);
}
