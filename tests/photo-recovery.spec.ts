import {test,expect} from '@playwright/test';
import {staffUi} from './fixtures/staff-ui';
test('interrupted native camera photo is reviewed, copied and explicitly discarded',async({page})=>{
 await staffUi(page);await page.addInitScript(()=>{
  let originals=[{id:'8f7a155a-073a-4822-9ed3-294c458091fa',createdAt:Date.now(),bytes:1000}];
  window.TahaNative={info:()=>'{"build":"TEST"}',configure:()=>true,request:()=>{},readCaptures:()=>'[]',readCameraOriginals:()=>JSON.stringify(originals),exportCameraOriginal:()=>true,discardCameraOriginal:id=>{originals=originals.filter(photo=>photo.id!==id);},photoRecoveryIssues:()=>0};
 });
 await page.setViewportSize({width:390,height:844});await page.goto('/mobile-camera');await expect(page.getByRole('heading',{name:'Retained camera photos',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Save Camera Copy',exact:true}).click();await expect(page.getByText('Copy saved to gallery. The private original is still retained.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Discard Camera Photo',exact:true})).toBeVisible();await page.getByRole('button',{name:'Discard Camera Photo',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Discard this camera original?'})).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('heading',{name:'Retained camera photos',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Discard Camera Photo',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Discard Photo',exact:true}).click();await expect(page.getByRole('heading',{name:'Retained camera photos',exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
test('damaged queue records show a safe warning without deleting retained bytes or hiding Requests',async({page})=>{
 await staffUi(page);await page.addInitScript(()=>{window.TahaNative={info:()=>'{}',configure:()=>true,request:()=>{},readCaptures:()=>'[]',photoRecoveryIssues:()=>2};});
 await page.goto('/mobile-camera');await expect(page.getByRole('alert').filter({hasText:'2 saved photo records need recovery'})).toBeVisible();await expect(page.getByRole('tab',{name:/Requests/})).toBeVisible();
});
