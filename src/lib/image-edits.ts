export type Crop = {x:number;y:number;width:number;height:number;rotation:number};
export type ImageEdit = {originalUrl:string;crop?:Crop};
const edits=new Map<string,ImageEdit>();
export function rememberOriginal(url:string,originalUrl:string){edits.set(url,{originalUrl});}
export function rememberEdit(url:string,edit:ImageEdit){edits.set(url,edit);}
export const imageEdit=(url:string)=>edits.get(url);
export function loadImageEdits(images:{url:string;originalUrl?:string;crop?:Crop}[]){for(const image of images)if(image.originalUrl)rememberEdit(image.url,{originalUrl:image.originalUrl,crop:image.crop});}
window.addEventListener('taha-session-clear',()=>edits.clear());
