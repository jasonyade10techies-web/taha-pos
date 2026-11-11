import type {Json} from "./database";
type Table<R>={Row:{[K in keyof R]:R[K]};Insert:{[K in keyof R]?:R[K]};Update:{[K in keyof R]?:R[K]};Relationships:[]};
interface BranchRow {store_id:string}
interface RecordRow extends BranchRow {id:string;created_at:string}
export interface CustomerRow extends RecordRow {
 name:string;type:"Individual"|"Shop / Business";shop_name:string;owner_name:string;collecting_person:string;phone:string;address:string;notes:string;photo_path:string;active:boolean;updated_at:string;
}
export interface SaleRow extends RecordRow {
 invoice:string;customer_id:string|null;customer_name:string;employee_id:string;employee_name:string;subtotal:number;discount:number;coupon_discount:number;total:number;credit_amount:number;
 cash_received:number;change_amount:number;coupon_code:string;status:"Paid"|"Partial"|"Credit"|"Voided"|"Returned";receipt_snapshot:Json;source_test_id:string|null;voided_at:string|null;
}
export interface SaleItemRow extends BranchRow {
 id:string;sale_id:string;product_id:string;name:string;variant:string;category:string;quantity:number;listed_price:number;minimum_price:number;unit_price:number;discount:number;coupon_discount:number;total:number;service:boolean;stock_allocations:Json;price_reason:string;approver_id:string|null;
}
export interface PaymentRow extends RecordRow {
 code:string;sale_id:string|null;customer_id:string|null;method_id:string;amount:number;kind:"sale"|"collection"|"refund"|"reversal";status:"Pending"|"Confirmed"|"Rejected"|"Reversed";
 method_name:string;method_kind:"Cash"|"Digital";reference:string;notes:string;proof_path:string;employee_id:string;verified_by:string|null;verified_at:string|null;original_payment_id:string|null;
}
export interface CreditLedgerRow extends RecordRow {customer_id:string;sale_id:string|null;payment_id:string|null;reference:string;description:string;debit:number;credit:number;employee_id:string}
export interface ReturnRow extends RecordRow {code:string;sale_id:string;item_id:string;quantity:number;reason:string;destination:"Sellable Stock"|"Damaged"|"Do Not Restore Stock";location_id:string|null;amount:number;credit_reduction:number;manual_refund:number;employee_id:string;approver_id:string|null}
export interface TestOutRow extends RecordRow {code:string;customer_id:string;product_id:string;location_id:string;quantity:number;taken_date:string;due_date:string;employee_id:string;notes:string;status:"OUT"|"RETURNED"|"CONVERTED TO SALE";sale_id:string|null;closed_at:string|null}
export type TransactionTables={
 business_settings:Table<BranchRow&{settings:Json;updated_at:string}>;
 customers:Table<CustomerRow>;
 credit_accounts:Table<BranchRow&{customer_id:string;enabled:boolean;credit_limit:number|null;enforce_limit:boolean}>;
 payment_methods:Table<RecordRow&{name:string;kind:"Cash"|"Digital";subtype:"Cash"|"JazzCash"|"Easypaisa"|"Bank"|"Card"|"Other";account_title:string;account_number:string;iban:string;qr_path:string;enabled:boolean;requires_proof:boolean;sort_order:number}>;
 coupons:Table<BranchRow&{id:string;code:string;type:"Percentage"|"Fixed";value:number;starts_on:string;ends_on:string;minimum:number;max_uses:number;per_customer_limit:number;eligible:"All"|"Products"|"Categories"|"Services";targets:string[];active:boolean}>;
 sales:Table<SaleRow>;sale_items:Table<SaleItemRow>;
 sale_item_financials:Table<BranchRow&{item_id:string;purchase_cost:number|null}>;
 payments:Table<PaymentRow>;credit_ledger_entries:Table<CreditLedgerRow>;
 coupon_redemptions:Table<RecordRow&{coupon_id:string;sale_id:string;customer_id:string|null}>;
 returns:Table<ReturnRow>;out_for_test:Table<TestOutRow>;
 purchased_devices:Table<RecordRow&{product_id:string;status:"In Stock"|"Sold"|"Repair Needed"|"Reserved";imei:string|null;code:string;details:Json;employee_id:string|null}>;
};
