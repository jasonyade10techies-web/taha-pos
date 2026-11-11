import { createHash,randomBytes } from 'node:crypto';
import argon2 from 'argon2';
export const createToken=()=>randomBytes(32).toString('hex');
export const digestToken=(value:string)=>createHash('sha256').update(value).digest('hex');
export function validatePassword(value:string){if(typeof value!=='string'||value.length<12 || value.length>128)throw new Error('Use a password between 12 and 128 characters.');}
export const hashPassword=(value:string)=>argon2.hash(value,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
export async function verifyPassword(hash:string,value:string){try{return await argon2.verify(hash,value);}catch{return false;}}
