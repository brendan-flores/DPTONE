"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  subscribeAdminTables,
  type AdminRealtimeTable,
} from "@/lib/admin/realtime";

export function useAdminRealtimeQuery<T>({
  enabled = true,
  channel,
  tables,
  fetcher,
}: {
  enabled?: boolean;
  channel: string;
  tables: readonly AdminRealtimeTable[];
  fetcher: () => Promise<T>;
}) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => load(false), [load]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void load(true);
    const tablesKey = tables.join(",");
    const unsub = subscribeAdminTables(
      tables,
      () => {
        void load(false);
      },
      `${channel}:${tablesKey}`
    );
    return unsub;
  }, [enabled, channel, tables, load]);

  return { data, loading, error, refresh, setData };
}
