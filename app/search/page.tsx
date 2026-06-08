"use client"

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchStorefrontProducts } from '@/lib/storefront/products';
import Image from "next/image";
import Link from "next/link";

const sortOptions = [
  { label: "Date, new to old", value: "date-desc" },
  { label: "Date, old to new", value: "date-asc" },
  { label: "Price, low to high", value: "price-asc" },
  { label: "Price, high to low", value: "price-desc" },
];

const availabilityOptions = [
  { label: "All", value: "all" },
  { label: "In Stock", value: "in-stock" },
  { label: "Out of Stock", value: "out-of-stock" },
];

export default function SearchResultsPage() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') || "";

  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("date-desc");
  const [availability, setAvailability] = useState("all");
  const [priceFrom, setPriceFrom] = useState("");
  const [priceTo, setPriceTo] = useState("");
  const [showPriceDropdown, setShowPriceDropdown] = useState(false);
  const [showAvailabilityDropdown, setShowAvailabilityDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [inStockCount, setInStockCount] = useState<number>(0);
  const [outOfStockCount, setOutOfStockCount] = useState<number>(0);

  // Compute unique sorted price options for dropdowns
  const priceOptions = Array.from(new Set(products.map(p => Number(p.price)))).sort((a, b) => a - b);
  const highestPrice = priceOptions.length > 0 ? priceOptions[priceOptions.length - 1] : 0;

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
      const allItems = await fetchStorefrontProducts();
      const matchedItems = searchQuery
        ? allItems.filter(p => p.name?.toLowerCase().includes(searchQuery.toLowerCase()))
        : allItems;

      setProducts(matchedItems);

      // Count in-stock and out-of-stock products client-side, considering sizes
      setInStockCount(
        matchedItems.filter(p =>
          Array.isArray(p.sizes)
            ? p.sizes.some((size: any) => Number(size.stock) > 0)
            : Number(p.stock) > 0
        ).length
      );
      setOutOfStockCount(
        matchedItems.filter(p =>
          Array.isArray(p.sizes)
            ? !p.sizes.some((size: any) => Number(size.stock) > 0)
            : !p.stock || Number(p.stock) === 0
        ).length
      );
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [searchQuery]);

  useEffect(() => {
    let filtered = [...products];

    // Filter by availability
    if (availability === "in-stock") {
      filtered = filtered.filter(p => {
        if (typeof p.totalStock === 'number') {
          return p.totalStock > 0;
        } else if (Array.isArray(p.sizes)) {
          return p.sizes.some((size: any) => Number(size.stock) > 0);
        } else {
          return Number(p.stock) > 0;
        }
      });
    } else if (availability === "out-of-stock") {
      filtered = filtered.filter(p => {
        if (typeof p.totalStock === 'number') {
          return p.totalStock === 0;
        } else if (Array.isArray(p.sizes)) {
          return !p.sizes.some((size: any) => Number(size.stock) > 0);
        } else {
          return !p.stock || Number(p.stock) === 0;
        }
      });
    }

    // Filter by price range
    if (priceFrom !== "") {
      filtered = filtered.filter(p => Number(p.price) >= Number(priceFrom));
    }
    if (priceTo !== "") {
      filtered = filtered.filter(p => Number(p.price) <= Number(priceTo));
    }

    // Sort
    if (sort === "price-asc") {
      filtered.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (sort === "price-desc") {
      filtered.sort((a, b) => Number(b.price) - Number(a.price));
    } else if (sort === "date-asc") {
      filtered.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    } else if (sort === "date-desc") {
      filtered.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    }
    setFilteredProducts(filtered);
  }, [products, sort, availability, priceFrom, priceTo]);

  return (
    <div className="min-h-screen bg-[#101828] text-[#60A5FA]">
      <div className="w-full pt-8 pb-16">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <h1 className="text-3xl font-bold mb-4 md:mb-0">
            {searchQuery ? `Search results for "${searchQuery}"` : "All Products"}
          </h1>
          <div className="flex items-center gap-4">
            {/* Filter: Availability as Dropdown */}
            <div className="flex flex-col gap-2 relative">
              <button
                type="button"
                className="flex items-center gap-1 text-sm font-medium focus:outline-none text-[#60A5FA]"
                onClick={() => setShowAvailabilityDropdown(v => !v)}
              >
                Availability
                <svg className={`w-4 h-4 transition-transform ${showAvailabilityDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showAvailabilityDropdown && (
                <div className="absolute left-0 top-full z-10 mt-2 bg-[#19223a] border border-[#22304a] rounded p-3 shadow-lg min-w-[150px]">
                  <div className="flex flex-col gap-2">
                    {availabilityOptions.map(opt => {
                      let count = null;
                      if (opt.value === 'in-stock') count = inStockCount;
                      if (opt.value === 'out-of-stock') count = outOfStockCount;
                      return (
                        <button
                          key={opt.value}
                          className={`text-left px-2 py-1 rounded hover:bg-[#22304a] ${availability === opt.value ? 'bg-[#22304a] font-semibold' : ''} text-[#60A5FA]`}
                          onClick={() => { setAvailability(opt.value); setShowAvailabilityDropdown(false); }}
                        >
                          {opt.label}
                          {typeof count === 'number' && (
                            <span className="ml-2 text-xs text-[#60A5FA]">({count})</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {/* Filter: Price Range as Dropdown */}
            <div className="flex flex-col gap-2 relative">
              <button
                type="button"
                className="flex items-center gap-1 text-sm font-medium focus:outline-none text-[#60A5FA]"
                onClick={() => setShowPriceDropdown(v => !v)}
              >
                Price
                <svg className={`w-4 h-4 transition-transform ${showPriceDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showPriceDropdown && (
                <div className="absolute left-0 top-full z-10 mt-2 bg-[#19223a] border border-[#22304a] rounded p-3 shadow-lg min-w-[250px]">
                  <div className="mb-2 text-sm text-[#60A5FA]">The highest price is <span className="font-semibold">₱{highestPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                  <div className="flex gap-2">
                    <div className="relative flex items-center w-28">
                      <span className="absolute left-2 text-[#60A5FA]">₱</span>
                      <input
                        type="number"
                        placeholder="From"
                        className="pl-6 border border-[#22304a] bg-[#101828] rounded px-2 py-1 text-sm w-full focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA] text-[#60A5FA]"
                        value={priceFrom}
                        onChange={e => setPriceFrom(e.target.value)}
                        min="0"
                      />
                    </div>
                    <div className="relative flex items-center w-28">
                      <span className="absolute left-2 text-[#60A5FA]">₱</span>
                      <input
                        type="number"
                        placeholder="To"
                        className="pl-6 border border-[#22304a] bg-[#101828] rounded px-2 py-1 text-sm w-full focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA] text-[#60A5FA]"
                        value={priceTo}
                        onChange={e => setPriceTo(e.target.value)}
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* Sort by: button and dropdown panel */}
            <div className="flex items-center gap-2 relative">
              <span className="text-sm text-[#60A5FA]">Sort by:</span>
              <button
                type="button"
                className="flex items-center gap-1 text-sm font-normal border border-[#22304a] bg-[#101828] rounded px-2 py-1 focus:outline-none min-w-[140px] text-[#60A5FA]"
                onClick={() => setShowSortDropdown(v => !v)}
              >
                {sortOptions.find(opt => opt.value === sort)?.label}
                <svg className={`w-4 h-4 ml-1 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showSortDropdown && (
                <div className="absolute left-0 top-full z-10 mt-2 bg-[#19223a] border border-[#22304a] rounded p-2 shadow-lg min-w-[180px]">
                  <div className="flex flex-col">
                    {sortOptions.map(opt => (
                      <button
                        key={opt.value}
                        className={`text-left px-3 py-2 rounded hover:bg-[#22304a] ${sort === opt.value ? 'bg-[#22304a] font-semibold' : ''} text-[#60A5FA]`}
                        onClick={() => { setSort(opt.value); setShowSortDropdown(false); }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <span className="text-[#60A5FA] text-sm">{filteredProducts.length} products</span>
          </div>
        </div>
        {loading ? (
          <div className="text-center py-20 text-lg text-[#60A5FA]">Loading products...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 text-lg text-[#60A5FA]">
            No products found matching "{searchQuery}".
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-7xl mx-auto">
            {filteredProducts.map(product => (
              <div key={product.id} className="flex flex-col items-center">
                <div className="relative w-[250px] h-[250px]">
                  <Link href={`/products/${product.id}`}> 
                    <Image src={product.imageUrls?.[0] || product.image || "/placeholder.jpg"} alt={product.name} width={250} height={250} className="object-contain rounded-lg bg-[#101828]" />
                  </Link>
                  {(
                    (typeof product.totalStock === 'number' && product.totalStock === 0) ||
                    (Array.isArray(product.sizes) && !product.sizes.some((size: any) => Number(size.stock) > 0)) ||
                    (typeof product.stock === 'number' && product.stock === 0)
                  ) && (
                    <div className="absolute left-3 bottom-3 bg-red-600 text-white text-sm font-semibold px-4 py-1 rounded-full shadow-lg select-none z-10">Sold out</div>
                  )}
                </div>
                <div className="mt-4 text-center">
                  <div className="font-medium text-[#60A5FA]">{product.name}</div>
                  <div className="text-[#60A5FA] font-semibold mt-1">₱{Number(product.price).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 