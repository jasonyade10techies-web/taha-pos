import type { PosProduct } from "../types/product";
export type SearchTerm = { canonical: string; aliases: string[] };
export const defaultSearchDictionary: SearchTerm[] = [
  {
    canonical: "charging board",
    aliases: [
      "charging port",
      "charging strip",
      "charging patta",
      "charging patti",
      "charging flex",
    ],
  },
  { canonical: "screen", aliases: ["display", "panel", "lcd", "oled", "sr"] },
  { canonical: "battery", aliases: ["battri", "battry"] },
  { canonical: "back cover", aliases: ["back glass"] },
  { canonical: "microphone", aliases: ["mic"] },
  { canonical: "speaker", aliases: ["earpiece"] },
  { canonical: "flex", aliases: ["strip", "patti"] },
  { canonical: "camera", aliases: ["cam"] },
  { canonical: "protector", aliases: ["tempered", "tempered glass"] },
  { canonical: "charger", aliases: ["adapter", "head"] },
  { canonical: "cable", aliases: ["wire"] },
  { canonical: "earphones", aliases: ["handsfree"] },
];
export function normalizeSearch(text: string) {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
export function expandSearch(
  text: string,
  dictionary: SearchTerm[] = defaultSearchDictionary,
) {
  let next = ` ${normalizeSearch(text)} `;
  for (const term of dictionary
    .flatMap((group) =>
      group.aliases.map((alias) => ({
        alias: normalizeSearch(alias),
        canonical: normalizeSearch(group.canonical),
      })),
    )
    .sort((a, b) => b.alias.length - a.alias.length)) {
    next = next.split(` ${term.alias} `).join(` ${term.canonical} `);
  }
  return next.trim();
}
function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = old;
    }
  }
  return row[b.length];
}
export function searchProducts<
  T extends Pick<
    PosProduct,
    "name" | "compatibleModel" | "brand" | "internalCode" | "aliases"
  >,
>(
  products: T[],
  query: string,
  dictionary: SearchTerm[] = defaultSearchDictionary,
): T[] {
  const normalized = normalizeSearch(query);
  if (!normalized) return products;
  if (/^(\d{4,}|tm )/.test(normalized))
    return products.filter((product) =>
      [product.internalCode, ...product.aliases].some(
        (alias) => normalizeSearch(alias) === normalized,
      ),
    );
  const terms = expandSearch(query, dictionary).split(" ");
  return products
    .map((product, index) => {
      const haystack = expandSearch(
          [
            product.name,
            product.compatibleModel,
            product.brand,
            ...product.aliases,
          ].join(" "),
          dictionary,
        ),
        words = haystack.split(" ");
      let score = 0;
      for (const term of terms) {
        const best = Math.min(
          ...words.map((word) =>
            word === term
              ? 0
              : term.length >= 3 && word.startsWith(term)
                ? 0.2
                : /^\d+$/.test(term) || term.length < 3
                  ? 99
                  : distance(term, word),
          ),
        );
        if (best > Math.min(2, Math.floor(term.length * 0.3)))
          return { product, index, score: 999 };
        score += best;
      }
      return { product, index, score };
    })
    .filter((result) => result.score < 999)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((result) => result.product);
}
export function suggestAliases(product: {
  name: string;
  brand: string;
  compatibleModel: string;
  category: string;
}) {
  if (!product.name.trim()) return [];
  const model =
    product.compatibleModel.trim() ||
    product.name.match(/(?:A|S)\d{2}|iPhone\s*\d+/i)?.[0] ||
    "";
  const candidates = [
    `${model} ${product.category.toLowerCase()}`,
    product.name.replace(/Galaxy\s+/i, ""),
    ...(/charging/i.test(product.name)
      ? ["charging patta", "charging strip", "charging board"].map(
          (term) => `${model} ${term}`,
        )
      : /battery/i.test(product.name)
        ? [`${model} battri`]
        : []),
  ];
  return [...new Set(candidates.map((alias) => alias.trim()).filter(Boolean))];
}
