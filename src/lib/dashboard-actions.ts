import type {DateRange} from './dashboard-range';
import type {DashboardData} from '../types/dashboard';
import type {ReminderObligation} from '../types/reminders';
import {dueState} from './reminders';
import {shopTimestamp} from './shop-time';
export function creditReminderDetails(customer:DashboardData['credit'][number],obligations:ReminderObligation[]){
 const items=obligations.filter(o=>o.kind==='credit'&&(customer.id?o.customerId===customer.id:o.customerName===customer.name));
 const nearest=items.filter(o=>o.dueAt).sort((a,b)=>Date.parse(a.dueAt!)-Date.parse(b.dueAt!))[0],first=nearest??items[0];
 return {...customer,id:first?.customerId??customer.id,due:nearest?`${dueState(nearest.dueAt).label} · Due ${shopTimestamp(nearest.dueAt!)}`:'No time limit',taken:first?shopTimestamp(first.occurredAt):undefined,overdue:nearest?dueState(nearest.dueAt).status==='Overdue':false};
}
export function dashboardDestination(metric:string,range:DateRange){return metric==='stock'?'/low-stock':'/reports?'+new URLSearchParams({metric,from:range.from,to:range.to,tab:metric==='profit'?'Profit':metric==='credit'?'Credit':metric==='cash'||metric==='digital'?'Payments':'Overview'});}
const actions:Record<string,string>={'sale.returned':'Recorded a product return','location.created':'Created a storage location','location.condition_set':'Updated storage condition','sale.completed':'Completed a sale','sale.voided':'Voided a sale','stock.received':'Received stock','stock.transferred':'Transferred stock','payment.received':'Received a payment','credit.received':'Collected a credit payment','product.created':'Added a product','product.edited':'Updated a product','settings.updated':'Updated shop settings'};
export function activityLabel(action:string){return actions[action]??(action.includes('.')?action.replaceAll('.',' ').replaceAll('_',' ').replace(/^./,c=>c.toUpperCase()):action);}
