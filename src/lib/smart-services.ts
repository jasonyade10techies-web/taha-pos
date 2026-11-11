import type { PosProduct } from '../types/product';
import type { RepairService } from '../types/demo';
import { expandSearch, normalizeSearch, searchProducts, type SearchTerm, defaultSearchDictionary } from './product-search';

const serviceWords = new Set(['replacement','replace','replaced','changing','change','changed','repair','repairs','repairing','installation','install','installed','fitting','fit','fitted','labour','labor','only','lagana','badal','tabdeel']);
export function serviceNameKey(name: string) { return name.trim().replace(/\s+/g, ' ').toLowerCase(); }
export function recognizeServiceMaterial(products: PosProduct[], description: string, dictionary: SearchTerm[] = defaultSearchDictionary) {
  const core = normalizeSearch(description).split(' ').filter(word => !serviceWords.has(word)).join(' ');
  if (!core) return { kind: 'none' as const, candidates: [] as PosProduct[] };
  const models = description.toLowerCase().match(/\b[a-z]{1,12}\s?\d{1,4}[a-z]?\b/g) ?? [];
  const eligible = products.filter(p => p.category !== 'Services' && models.every(model => {
    const target = normalizeSearch(model);
    const text = ` ${normalizeSearch([p.name,p.compatibleModel,...p.aliases].join(' '))} `;
    return text.includes(` ${target} `);
  }));
  const corrected = core.replace(/\bpnl\b|\bpanl\b/g, 'panel');
  const names = eligible.map(p => ({...p, name: `${p.name} ${p.qualityGrade} ${p.color}`}));
  const found = [...searchProducts(names, corrected, dictionary), ...searchProducts(names, corrected, [])];
  const candidates = [...new Set(found.map(p => p.id))].map(id => eligible.find(p => p.id === id)!).slice(0, 4);
  if (!candidates.length) return {kind:'none' as const,candidates};
  if (candidates.length > 1) return {kind:'ambiguous' as const,candidates};
  const candidate=candidates[0], tokens=expandSearch(core,dictionary).split(' ');
  const haystack=expandSearch([candidate.name,candidate.compatibleModel,candidate.brand,candidate.qualityGrade,candidate.color,...candidate.aliases].join(' '),dictionary).split(' ');
  const exact = core === corrected && tokens.every(token => haystack.includes(token));
  return {kind:exact ? 'exact' as const : 'suggested' as const,candidates};
}
export function suggestServiceTemplates(services: RepairService[], query: string): RepairService[] {
  const words=normalizeSearch(query).split(' ').filter(Boolean);
  if (!words.length) return [];
  return services.filter(s=>s.active && words.every(word=>normalizeSearch(s.name).split(' ').some(value=>value.startsWith(word))))
    .sort((a,b)=>Number(serviceNameKey(b.name)===serviceNameKey(query))-Number(serviceNameKey(a.name)===serviceNameKey(query))||a.name.localeCompare(b.name)).slice(0,3);
}
