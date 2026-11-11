import { useEffect, useRef, useState } from "react";
import {
  Search,
  ScanBarcode,
  X,
  SearchX,
  LayoutGrid,
  SlidersHorizontal,
} from "lucide-react";
import type { PosProduct } from "../../types/product";
import { ProductCard } from "./product-card";
import { Button } from "../ui/button";
import { searchProducts } from "../../lib/product-search";
import { useRepository } from "../../hooks/use-repository";
import { repositories } from "../../lib/repositories";

const categories = [
  "All Products",
  "Parts",
  "Accessories",
  "Phones",
  "Services",
] as const;
export function ProductSearch({ products }: { products: PosProduct[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All Products");
  const [availableOnly, setAvailableOnly] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    search.current?.focus();
  }, []);
  const dictionary = useRepository("pos-search-settings", () => repositories.settings.get());
  const matches = searchProducts(products, query, dictionary.data?.searchDictionary);
  const results = matches.filter(
    (p) =>
      (category === "All Products" || p.category === category) &&
      (!availableOnly || p.quantity > 0),
  );
  const resultButtons = () => Array.from(document.querySelectorAll<HTMLButtonElement>('#product-results .product-add:not(:disabled)'));
  return (
    <section className="pos-catalog" aria-label="Product catalog">
      <div className="pos-search">
        <Search size={21} />
        <input
          ref={search}
          aria-label="Search products"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search product, phone model, local name, service or scan barcode..."
          onKeyDown={(e) => {
            if (e.key === "Escape") setQuery("");
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault(); const buttons=resultButtons();
              (e.key==='ArrowDown'?buttons[0]:buttons.at(-1))?.focus();
            }
            if (e.key === 'Enter' && query.trim()) {
              e.preventDefault(); resultButtons()[0]?.click();
            }
          }}
          autoComplete="off"
        />
        {query ? (
          <button
            aria-label="Clear product search"
            onClick={() => {
              setQuery("");
              search.current?.focus();
            }}
          >
            <X size={18} />
          </button>
        ) : (
          <button
            aria-label="Focus search for barcode scanner"
            title="A keyboard barcode scanner can type into search"
            onClick={() => search.current?.focus()}
          >
            <ScanBarcode size={22} />
          </button>
        )}
      </div>
      <div
        className="catalog-tabs"
        role="tablist"
        aria-label="Product category"
      >
        {categories.map((item, index) => (
          <button
            key={item}
            id={`category-${index}`}
            role="tab"
            tabIndex={category === item ? 0 : -1}
            aria-controls="product-results"
            aria-selected={category === item}
            onClick={() => setCategory(item)}
            onKeyDown={(e) => {
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                const next =
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? categories.length - 1
                      : (index +
                          (e.key === "ArrowRight" ? 1 : -1) +
                          categories.length) %
                        categories.length;
                setCategory(categories[next]);
                document.getElementById(`category-${next}`)?.focus();
              }
            }}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="catalog-result-heading">
        <span>
          <LayoutGrid size={15} />
          {query ? "Search results" : "Browse products"}
          <small>{results.length} products</small>
        </span>
        <Button
          variant="ghost"
          size="small"
          onClick={() => setAvailableOnly(!availableOnly)}
          aria-pressed={availableOnly}
        >
          <SlidersHorizontal size={14} />
          {availableOnly ? "In stock only" : "Availability"}
        </Button>
      </div>
      <div
        id="product-results"
        className="catalog-products"
        role="tabpanel"
        aria-labelledby={`category-${categories.findIndex((item) => item === category)}`}
        onKeyDown={e=>{
          if (!(e.target instanceof HTMLButtonElement) || !e.target.classList.contains('product-add')) return;
          const buttons=resultButtons(),current=buttons.indexOf(e.target);
          const delta=['ArrowDown','ArrowRight'].includes(e.key)?1:['ArrowUp','ArrowLeft'].includes(e.key)?-1:0;
          if(delta){e.preventDefault();buttons[(current+delta+buttons.length)%buttons.length]?.focus();}
          if(e.key==='Escape'){e.preventDefault();search.current?.focus();}
        }}
      >
        {results.length ? (
          <div className="product-grid">
            {results.map((product) => (
              <ProductCard product={product} key={product.id} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <SearchX size={34} />
            <h3>No matching products</h3>
            <p>Try another model, local name, or internal code.</p>
            <Button
              onClick={() => {
                setQuery("");
                setCategory("All Products");
                setAvailableOnly(false);
                search.current?.focus();
              }}
            >
              Reset search
            </Button>
          </div>
        )}
      </div>
      <div className="catalog-footer">
        <ScanBarcode size={15} />
        <span>Ready to scan a barcode</span>
        <span className="ml-auto">Search by name, model or local name</span>
      </div>
    </section>
  );
}
