import type {PGlite} from "@electric-sql/pglite";
export const store:string;
export function id(n:number):string;
export function seedTransactions(db:PGlite):Promise<void>;
export function prepareCatalog(db:PGlite):Promise<{cash:string;customer:string;box:string;product:string}>;
export function setActor(db:PGlite,uid:string):Promise<void>;
export function call<T=unknown>(db:PGlite,name:string,...args:unknown[]):Promise<T>;
export function saleInput(cash:string,n:number,overrides?:Record<string,unknown>):Record<string,unknown>;
