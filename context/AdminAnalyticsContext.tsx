"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  fetchAdminActivities,
  fetchRecentUsers,
  fetchSalesRows,
  sumSalesTotal,
  type AdminActivity,
} from "@/lib/admin/analytics";
import { countAdminProducts } from "@/lib/admin/products";
import { countAdminOrders } from "@/lib/admin/orders";
import {
  ADMIN_REALTIME_TABLES,
  subscribeAdminTables,
} from "@/lib/admin/realtime";

type AdminAnalyticsContextValue = {
  recentUsers: { id: string; email: string; created_at: string }[];
  recentActivities: AdminActivity[];
  totalProducts: number;
  totalOrders: number;
  totalSalesAmount: number;
  isLoadingUsers: boolean;
  isLoadingActivities: boolean;
  refreshAnalytics: () => Promise<void>;
  refreshActivities: () => Promise<void>;
};

const AdminAnalyticsContext = createContext<AdminAnalyticsContextValue | null>(
  null
);

export function AdminAnalyticsProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const [recentUsers, setRecentUsers] = useState<
    { id: string; email: string; created_at: string }[]
  >([]);
  const [recentActivities, setRecentActivities] = useState<AdminActivity[]>(
    []
  );
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalSalesAmount, setTotalSalesAmount] = useState(0);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const analyticsTables = useMemo(
    () => [...ADMIN_REALTIME_TABLES.analytics],
    []
  );
  const activitiesTables = useMemo(
    () => [...ADMIN_REALTIME_TABLES.activities],
    []
  );

  const refreshActivities = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoadingActivities(true);
    try {
      setRecentActivities(await fetchAdminActivities());
    } catch (e) {
      console.error(e);
      setRecentActivities([]);
    } finally {
      if (showLoading) setIsLoadingActivities(false);
    }
  }, []);

  const refreshAnalytics = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoadingUsers(true);
    try {
      const [users, productCount, orderCount, sales] = await Promise.all([
        fetchRecentUsers(),
        countAdminProducts(),
        countAdminOrders(),
        fetchSalesRows(),
      ]);
      setRecentUsers(users);
      setTotalProducts(productCount);
      setTotalOrders(orderCount);
      setTotalSalesAmount(sumSalesTotal(sales));
    } catch (e) {
      console.error(e);
    } finally {
      if (showLoading) setIsLoadingUsers(false);
    }
  }, []);

  const refreshAnalyticsRef = useRef(refreshAnalytics);
  const refreshActivitiesRef = useRef(refreshActivities);
  refreshAnalyticsRef.current = refreshAnalytics;
  refreshActivitiesRef.current = refreshActivities;

  useEffect(() => {
    if (!enabled) return;
    void refreshAnalytics(true);
    void refreshActivities(true);
    const unsubAnalytics = subscribeAdminTables(
      analyticsTables,
      () => {
        void refreshAnalyticsRef.current(false);
      },
      "context-analytics"
    );
    const unsubActivities = subscribeAdminTables(
      activitiesTables,
      () => {
        void refreshActivitiesRef.current(false);
      },
      "context-activities"
    );
    return () => {
      unsubAnalytics();
      unsubActivities();
    };
  }, [
    enabled,
    analyticsTables,
    activitiesTables,
    refreshAnalytics,
    refreshActivities,
  ]);

  return (
    <AdminAnalyticsContext.Provider
      value={{
        recentUsers,
        recentActivities,
        totalProducts,
        totalOrders,
        totalSalesAmount,
        isLoadingUsers,
        isLoadingActivities,
        refreshAnalytics: () => refreshAnalytics(true),
        refreshActivities: () => refreshActivities(true),
      }}
    >
      {children}
    </AdminAnalyticsContext.Provider>
  );
}

export function useAdminAnalytics() {
  const ctx = useContext(AdminAnalyticsContext);
  if (!ctx) {
    throw new Error("useAdminAnalytics must be used within AdminAnalyticsProvider");
  }
  return ctx;
}
