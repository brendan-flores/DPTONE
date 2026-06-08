"use client"

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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

export default function BrandPage() {
  const params = useParams();
  let brandParam = params.brand;
  const brand = decodeURIComponent(Array.isArray(brandParam) ? brandParam[0] : brandParam || "");
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
  const [showMobileFilter, setShowMobileFilter] = useState(false);
  // Compute unique sorted price options for dropdowns
  const priceOptions = Array.from(new Set(products.map(p => Number(p.price)))).sort((a, b) => a - b);
  const highestPrice = priceOptions.length > 0 ? priceOptions[priceOptions.length - 1] : 0;

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
      const all = await fetchStorefrontProducts();
      const items = all.filter(
        (p) => p.brand?.toLowerCase() === brand.toLowerCase()
      );
      setProducts(items);
      // Count in-stock and out-of-stock products client-side, considering sizes
      setInStockCount(
        items.filter(p =>
          Array.isArray(p.sizes)
            ? p.sizes.some((size: any) => Number(size.stock) > 0)
            : Number(p.stock) > 0
        ).length
      );
      setOutOfStockCount(
        items.filter(p =>
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
    if (brand) {
      fetchProducts();
    }
  }, [brand]);

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
          <h1 className="text-3xl font-bold mb-4 md:mb-0 text-center w-full md:text-left md:w-auto">{brand.toUpperCase()}</h1>
          {/* Mobile: Single Filter Dropdown */}
          <div className="flex items-center gap-4 w-full md:w-auto justify-center md:justify-end">
            <div className="block md:hidden">
              <button
                type="button"
                className="flex items-center gap-2 px-4 py-2 rounded bg-[#19223a] border border-[#22304a] text-[#60A5FA] font-semibold focus:outline-none"
                onClick={() => setShowMobileFilter(v => !v)}
              >
                Filter
                <svg className={`w-4 h-4 transition-transform ${showMobileFilter ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showMobileFilter && (
                <div className="absolute left-0 right-0 mx-auto z-30 mt-2 bg-[#19223a] border border-[#22304a] rounded p-4 shadow-lg w-[95vw] max-w-xs">
                  {/* Availability */}
                  <div className="mb-4">
                    <div className="text-sm font-semibold mb-2 text-[#60A5FA]">Availability</div>
                    <div className="flex flex-col gap-2">
                      {availabilityOptions.map(opt => {
                        let count = null;
                        if (opt.value === 'in-stock') count = inStockCount;
                        if (opt.value === 'out-of-stock') count = outOfStockCount;
                        return (
                          <button
                            key={opt.value}
                            className={`text-left px-2 py-1 rounded hover:bg-[#22304a] ${availability === opt.value ? 'bg-[#22304a] font-semibold' : ''} text-[#60A5FA]`}
                            onClick={() => { setAvailability(opt.value); setShowMobileFilter(false); }}
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
                  {/* Price Range */}
                  <div className="mb-4">
                    <div className="text-sm font-semibold mb-2 text-[#60A5FA]">Price Range</div>
                    <div className="flex gap-2 mb-2">
                      <div className="relative flex items-center w-24">
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
                      <div className="relative flex items-center w-24">
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
                    <div className="text-xs text-[#60A5FA]">Highest price: <span className="font-semibold">₱{highestPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                  </div>
                  {/* Sort By */}
                  <div className="mb-2">
                    <div className="text-sm font-semibold mb-2 text-[#60A5FA]">Sort by</div>
                    <div className="flex flex-col gap-2">
                      {sortOptions.map(opt => (
                        <button
                          key={opt.value}
                          className={`text-left px-2 py-1 rounded hover:bg-[#22304a] ${sort === opt.value ? 'bg-[#22304a] font-semibold' : ''} text-[#60A5FA]`}
                          onClick={() => { setSort(opt.value); setShowMobileFilter(false); }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* Desktop: Show all filters as before */}
            <div className="hidden md:flex items-center gap-4">
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
            </div>
            <span className="text-[#60A5FA] text-sm">{filteredProducts.length} product{filteredProducts.length === 1 ? '' : 's'}</span>
          </div>
        </div>
        {loading ? (
          <div className="text-center py-20 text-lg text-[#60A5FA]">Loading products...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 text-lg text-[#60A5FA]">
            No products found for this brand.
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-4 md:gap-8 max-w-7xl mx-auto px-2 sm:px-4 md:px-0">
            {filteredProducts.map(product => (
              <div key={product.id} className="bg-[#19223a] rounded-2xl shadow-lg p-3 sm:p-6 flex flex-col items-center w-full max-w-[150px] sm:max-w-xs mx-auto">
                <div className="relative w-[100px] h-[100px] sm:w-[180px] sm:h-[180px] md:w-[200px] md:h-[200px] flex items-center justify-center">
                  <Link href={`/products/${product.id}`}> 
                    <Image
                      src={product.imageUrls?.[0] || product.image || "/placeholder.jpg"}
                      alt={product.name}
                      fill
                      className="object-contain rounded-lg bg-white"
                      priority
                      sizes="(max-width: 640px) 100px, (max-width: 1024px) 180px, 200px"
                    />
                  </Link>
                  {(
                    (typeof product.totalStock === 'number' && product.totalStock === 0) ||
                    (Array.isArray(product.sizes) && !product.sizes.some((size: any) => Number(size.stock) > 0)) ||
                    (typeof product.stock === 'number' && product.stock === 0)
                  ) && (
                    <div className="absolute left-2 bottom-2 bg-red-600 text-white text-xs sm:text-sm font-semibold px-2 sm:px-4 py-0.5 sm:py-1 rounded-full shadow-lg select-none z-10">Sold out</div>
                  )}
                </div>
                <div className="mt-6 text-center">
                  <div className="font-bold text-lg text-[#60A5FA]">{product.name}</div>
                  <div className="text-[#60A5FA] font-semibold mt-2">₱{Number(product.price).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 