"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchStorefrontProducts,
  subscribeStorefrontProducts,
  type StorefrontProduct,
} from "@/lib/storefront/products";

export function useStorefrontProducts() {
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    try {
      setProducts(await fetchStorefrontProducts());
      setError(null);
    } catch {
      setError("Failed to load products. Please try again later.");
      setProducts([]);
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
    return subscribeStorefrontProducts(() => {
      void load(false);
    });
  }, [load]);

  return { products, loading, error };
}
