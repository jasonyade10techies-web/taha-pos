type PosProduct={name:string;compatibleModel:string;brand:string;internalCode:string;aliases:string[]};
export type SearchTerm={canonical:string;aliases:string[]};
export const defaultSearchDictionary:SearchTerm[]=[
 {canonical:'charging board',aliases:['charging port','charging strip','charging patta','charging patti','charging flex']},
 {canonical:'screen',aliases:['display','panel','lcd','oled','sr']},
 {canonical:'battery',aliases:['battri','battry']},{canonical:'back cover',aliases:['back glass']},
 {canonical:'microphone',aliases:['mic']},{canonical:'speaker',aliases:['earpiece']},
 {canonical:'flex',aliases:['strip','patti']},{canonical:'camera',aliases:['cam']},
 {canonical:'protector',aliases:['tempered','tempered glass']},{canonical:'charger',aliases:['adapter','head']},
 {canonical:'cable',aliases:['wire']},{canonical:'earphones',aliases:['handsfree']},
];
export function normalizeSearch(text:string){return text.normalize('NFKD').toLowerCase().replace(/([a-z])(\d)/g,'$1 $2').replace(/(\d)([a-z])/g,'$1 $2').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();}
export function expandSearch(text:string,dictionary:SearchTerm[]=defaultSearchDictionary){let next=` ${normalizeSearch(text)} `;for(const term of dictionary.flatMap(group=>group.aliases.map(alias=>({alias:normalizeSearch(alias),canonical:normalizeSearch(group.canonical)}))).sort((a,b)=>b.alias.length-a.alias.length)){next=next.split(` ${term.alias} `).join(` ${term.canonical} `);}return next.trim();}
function distance(a:string,b:string){const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let previous=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,previous+(a[i-1]===b[j-1]?0:1));previous=old;}}return row[b.length];}
export function searchProducts<T extends Pick<PosProduct, "name" | "compatibleModel" | "brand" | "internalCode" | "aliases">>(
  products: T[], query: string, dictionary: SearchTerm[] = defaultSearchDictionary,
): T[] {
  const normalized = normalizeSearch(query);
  if (!normalized) return products;
  const identity = normalized.replaceAll(" ", "");
  const numericIdentity = /^\d{4,}$/.test(identity);
  if (numericIdentity || /^tm(?: |$)/.test(normalized)) {
    return products.map((product, index) => {
      const keys = [product.internalCode, ...product.aliases].map(key => normalizeSearch(key).replaceAll(" ", ""));
      const exact = keys.includes(identity);
      return {product, index, rank: exact ? 0 : !numericIdentity && keys.some(key => key.startsWith(identity)) ? 1 : 2};
    }).filter(row => row.rank < 2).sort((a,b) => a.rank-b.rank || a.index-b.index).map(row => row.product);
  }
  // Prepare dictionary rules once per query, not once for every catalog row.
  const groups = dictionary.map(group => ({canonical:normalizeSearch(group.canonical), aliases:group.aliases.map(normalizeSearch)}));
  const replacements = groups.flatMap(group => group.aliases.map(alias => ({alias, canonical:group.canonical}))).sort((a,b) => b.alias.length-a.alias.length);
  const expand = (text:string) => {
    let value = ` ${normalizeSearch(text)} `;
    for (const rule of replacements) value = value.split(` ${rule.alias} `).join(` ${rule.canonical} `);
    return value.trim();
  };
  const terms = expand(query).split(" ");
  return products.map((product,index) => {
    if (/^[a-z]+\d+$/.test(identity) && [product.compatibleModel.toLowerCase().replace(/[^a-z0-9]/g,''),...product.compatibleModel.toLowerCase().split(/[^a-z0-9]+/)].some(word=>word.startsWith(identity))) return {product,index,score:0.1};
    const raw = normalizeSearch([product.name,product.compatibleModel,product.brand,...product.aliases].join(" "));
    const canonical = expand(raw);
    // Keep original words and dictionary alternatives so "pa" can find panel/screen.
    const synonyms = groups.filter(group => (` ${canonical} `).includes(` ${group.canonical} `)).flatMap(group => group.aliases);
    const words = [...new Set([raw,canonical,...synonyms].join(" ").split(" "))];
    let score = 0;
    for (const term of terms) {
      let best = 99;
      for (const [position,word] of words.entries()) {
        const candidate = word === term ? 0 : !/^\d+$/.test(term) && word.startsWith(term) ? 0.2 + Math.min(position,99)*0.0001
          : /^\d+$/.test(term) || term.length < 3 || Math.abs(word.length-term.length)>2 ? 99 : distance(term,word);
        best = Math.min(best,candidate);
        if (best === 0) break;
      }
      if (best > Math.max(0.25,Math.min(2,Math.floor(term.length*0.3)))) return {product,index,score:999};
      score += best;
    }
    return {product,index,score};
  }).filter(row => row.score<999).sort((a,b)=>a.score-b.score||a.index-b.index).map(row=>row.product);
}
export function suggestAliases(product:{name:string;brand:string;compatibleModel:string;category:string}){if(!product.name.trim())return [];const model=product.compatibleModel.trim()||product.name.match(/(?:A|S)\d{2}|iPhone\s*\d+/i)?.[0]||'';const candidates=[`${model} ${product.category.toLowerCase()}`,product.name.replace(/Galaxy\s+/i,''),...( /charging/i.test(product.name)?['charging patta','charging strip','charging board'].map(term=>`${model} ${term}`):/battery/i.test(product.name)?[`${model} battri`]:[])];return [...new Set(candidates.map(alias=>alias.trim()).filter(Boolean))];}
