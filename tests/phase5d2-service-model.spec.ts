import {test,expect} from '@playwright/test';
test('structured mention edits retain identity only while its atomic token remains, and never create negative labor',async({page})=>{
 await page.goto('/pos');await expect(page.getByRole('button',{name:'Custom Service',exact:true})).toBeVisible();
 const result=await page.evaluate(async()=>{const path='/src/lib/service-composer.ts',pricePath='/src/lib/compound-service.ts';const m=await import(path),p=await import(pricePath);const blank={before:'Please @y20 panal',after:''};const doc=m.selectMention(blank,7,17,{productId:'actual-sku',label:'Vivo Y20 Panel'});const typed=m.replaceComposerRange(doc,{start:doc.before.length+1,end:doc.before.length+1},' screen replacement');const removed=m.replaceComposerRange(typed,{start:7,end:8},'');const pasted=m.replaceComposerRange(typed,{start:0,end:7},'<b>fitting</b> ');return{doc,typed,name:m.composerText(typed),removed,pasted,split:p.compoundAllocation(2000,2500),same:p.compoundAllocation(2000,2000),low:p.compoundAllocation(2000,1800),two:p.compoundAllocation(2000,4500,2)};});
 expect(result.doc.mention.productId).toBe('actual-sku');expect(result.name).toBe('Please Vivo Y20 Panel screen replacement');expect(result.removed.mention).toBeUndefined();expect(result.removed.before+result.removed.after).toBe('Please  screen replacement');expect(result.pasted.mention.productId).toBe('actual-sku');expect(result.split).toEqual({product:2000,labor:500,discount:0,basis:2000});expect(result.same.labor).toBe(0);expect(result.low).toEqual({product:1800,labor:0,discount:200,basis:2000});expect(result.two).toEqual({product:4000,labor:500,discount:0,basis:4000});
});
test('receipt money keeps confirmed incoming, refunds, reversals and outstanding distinct',async({page})=>{
 await page.goto('/pos');await expect(page.getByRole('button',{name:'Custom Service',exact:true})).toBeVisible();
 const totals=await page.evaluate(async()=>{const path='/src/lib/payment-summary.ts',{receiptPayments}=await import(path);return receiptPayments({total:2500,paid:500,outstanding:300,payments:[{methodId:'cash',amount:2200,status:'Reversed',kind:'sale'},{methodId:'cash',amount:1000,status:'Confirmed',kind:'refund'},{methodId:'cash',amount:700,status:'Confirmed',kind:'reversal'},{methodId:'credit',amount:300,methodKind:'Credit',kind:'sale'},{methodId:'digital',amount:900,status:'Pending',kind:'sale'}]});});
 expect(totals).toEqual({received:2200,refunded:1000,reversed:700,paid:500,outstanding:300});
});
test('an older private capture remains recoverable after restart, is shop-scoped and is removed only deliberately',async({page})=>{
 await page.goto('/pos');await expect(page.getByRole('button',{name:'Custom Service',exact:true})).toBeVisible();
 const result=await page.evaluate(async()=>{const path='/src/lib/mobile/pending-captures.ts',config='/src/lib/config.ts',shop=(await import(config)).getApiBaseUrl(),id=crypto.randomUUID(),requestId=crypto.randomUUID(),record={captureId:id,requestId,shop,createdAt:Date.now()-86400000,data:'data:image/jpeg;base64,AQIDBA=='},removed:string[]=[];
 let stored=[record];window.TahaNative={info:()=>'{"build":"TEST"}',configure:()=>true,request:()=>{},readCaptures:()=>JSON.stringify(stored),removeCapture:value=>{removed.push(value);stored=[];}};
 const queue=await import(path),retained=queue.pendingCaptures(requestId).length;
 stored=[{...record,shop:'https://other-shop.test/api/v1'}];window.dispatchEvent(new Event('taha-shop-changed'));const foreign=queue.pendingCaptures().length;
 stored=[record];window.dispatchEvent(new Event('taha-shop-changed'));const restored=queue.pendingCaptures().length;queue.discardCapture(requestId,id);return{retained,foreign,restored,removed,remaining:queue.pendingCaptures().length,id};});
 expect(result.retained).toBe(1);expect(result.foreign).toBe(0);expect(result.restored).toBe(1);expect(result.removed).toEqual([result.id]);expect(result.remaining).toBe(0);
});
