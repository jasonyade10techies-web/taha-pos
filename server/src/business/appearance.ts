import {BadRequestException} from '@nestjs/common';
export type Appearance={font:'Manrope'|'Inter'|'System';primary:string;accent:string;success:string;warning:string;danger:string};
function contrast(a:string,b:string){const luminance=(hex:string)=>{const n=parseInt(hex.slice(1),16);const p=[n>>16,n>>8&255,n&255].map(x=>{const c=x/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});return p[0]*.2126+p[1]*.7152+p[2]*.0722;};const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function validateAppearance(input:unknown):Appearance{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new BadRequestException('Check the appearance settings.');const a=input as Appearance;
 if(!['Manrope','Inter','System'].includes(a.font)||Object.keys(a).some(k=>!['font','primary','accent','success','warning','danger'].includes(k)))throw new BadRequestException('Choose a supported font and appearance colors.');
 for(const key of ['primary','accent','success','warning','danger'] as const)if(typeof a[key]!=='string'||!/^#[0-9a-f]{6}$/i.test(a[key]))throw new BadRequestException('Enter six-digit hex colors.');
 for(const key of ['success','warning','danger'] as const)if(contrast(a[key],'#ffffff')<4.5)throw new BadRequestException(`Choose a darker ${key} color so its text remains readable.`);
 return a;
}
