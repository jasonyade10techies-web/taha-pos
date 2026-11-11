import {expect,type Page} from '@playwright/test';

/** The approved checkout requires an explicit review before committing money. */
export async function completeSale(page:Page){
  const checkout=page.getByRole('dialog',{name:'Checkout',exact:true});
  await expect(checkout).toBeVisible();
  const review=checkout.getByRole('button',{name:'Review Sale',exact:true});
  const complete=checkout.getByRole('button',{name:'Complete Sale',exact:true});
  // The form appears after queries settle. A one-shot isVisible() can miss it
  // and wait forever for a completion button that only Review can reveal.
  await expect(review.or(complete)).toBeVisible();
  if(await review.isVisible())await review.click();
  await expect(complete).toBeEnabled();
  await complete.click();
}
