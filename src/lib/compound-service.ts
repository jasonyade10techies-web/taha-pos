import type {ServiceMaterial} from '../types/product';
const cents=(n:number)=>Math.round(n*100);
/** Selling allocation is revenue. Purchase cost/profit are never calculated here. */
export function compoundAllocation(sellingPrice:number,combinedCharge:number,quantity=1){
 const basis=cents(Math.max(0,sellingPrice)*quantity),total=cents(Math.max(0,combinedCharge));
 return {product:Math.min(basis,total)/100,labor:Math.max(0,total-basis)/100,discount:Math.max(0,basis-total)/100,basis:basis/100};
}
export function materialPriceChanged(material:ServiceMaterial,product:{sellingPrice:number;minimumSellingPrice:number}|undefined){
 return !product||!material.pricing||cents(product.sellingPrice)!==cents(material.pricing.sellingPrice)||cents(product.minimumSellingPrice)!==cents(material.pricing.minimumSellingPrice);
}
