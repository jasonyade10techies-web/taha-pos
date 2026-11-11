export type DateRange={from:string;to:string;label:string};
export const shopDate=(d=new Date())=>d.toLocaleDateString('en-CA',{timeZone:'Asia/Karachi'});
export function presetRange(label:string):DateRange{const today=shopDate(),end=new Date(today+'T12:00:00Z'),start=new Date(end);if(label==='Last 7 days')start.setUTCDate(start.getUTCDate()-6);else if(label==='Last 30 days')start.setUTCDate(start.getUTCDate()-29);else if(label==='Last 90 days')start.setUTCDate(start.getUTCDate()-89);else if(label==='This Year')start.setUTCMonth(0,1);else if(label==='Last Year'){start.setUTCFullYear(start.getUTCFullYear()-1,0,1);end.setUTCFullYear(end.getUTCFullYear()-1,11,31);}return {from:start.toISOString().slice(0,10),to:end.toISOString().slice(0,10),label};}
export function rangeBuckets(range:DateRange){
 const from=new Date(range.from+'T00:00:00Z'),end=new Date(range.to+'T00:00:00Z'),to=new Date(end.getTime()+86400000),days=Math.round((end.getTime()-from.getTime())/86400000);
 const unit=days===0?'hour':days<=31?'day':days<=120?'week':days<=730?'month':'year';
 const buckets:{from:string;to:string;date:string;day:string}[]=[];const at=new Date(from);
 while(at<to){const next=new Date(at);if(unit==='hour')next.setUTCHours(next.getUTCHours()+1);else if(unit==='day')next.setUTCDate(next.getUTCDate()+1);else if(unit==='week')next.setUTCDate(next.getUTCDate()+7);else if(unit==='month'){const day=next.getUTCDate();next.setUTCDate(1);next.setUTCMonth(next.getUTCMonth()+1);const last=new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth()+1,0)).getUTCDate();next.setUTCDate(Math.min(day,last));}else{const day=next.getUTCDate(),month=next.getUTCMonth();next.setUTCDate(1);next.setUTCFullYear(next.getUTCFullYear()+1);const last=new Date(Date.UTC(next.getUTCFullYear(),month+1,0)).getUTCDate();next.setUTCDate(Math.min(day,last));}
 const label=unit==='hour'?String(at.getUTCHours()).padStart(2,'0')+':00':unit==='month'?at.toLocaleDateString('en',{month:'short',year:'2-digit',timeZone:'UTC'}):unit==='year'?String(at.getUTCFullYear()):at.toLocaleDateString('en',{day:'numeric',month:'short',timeZone:'UTC'});
 buckets.push({from:at.toISOString(),to:new Date(Math.min(next.getTime(),to.getTime())).toISOString(),date:at.toISOString().slice(0,10),day:label});at.setTime(next.getTime());
 }return {unit,buckets};
}
