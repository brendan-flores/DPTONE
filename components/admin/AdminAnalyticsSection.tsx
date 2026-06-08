"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
} from "recharts";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useAdminAnalytics } from "@/context/AdminAnalyticsContext";
import {
  buildMonthlySalesForMonth,
  buildSalesByMonth,
  buildWeeklySales,
  fetchProductRatingSummaries,
  fetchProductReviews,
  fetchReturnsThisMonth,
  fetchSalesRows,
  getAvailableSalesMonths,
  loadInventoryInsights,
  type SaleRow,
} from "@/lib/admin/analytics";
import { ADMIN_REALTIME_TABLES, subscribeAdminTables } from "@/lib/admin/realtime";

type ChartType =
  | "sales"
  | "quantity"
  | "inventory"
  | "feedback"
  | "weekly"
  | "monthly";

export default function AdminAnalyticsSection() {
  const {
    recentUsers,
    totalProducts,
    totalOrders,
    totalSalesAmount,
  } = useAdminAnalytics();

  const [chartType, setChartType] = useState<ChartType>("sales");
  const [salesRows, setSalesRows] = useState<SaleRow[]>([]);
  const [salesData, setSalesData] = useState<
    { month: string; sales: number; quantity: number }[]
  >([]);
  const [weeklySalesData, setWeeklySalesData] = useState<
    { day: string; sales: number }[]
  >([]);
  const [monthlySalesData, setMonthlySalesData] = useState<
    { day: string; sales: number }[]
  >([]);
  const [availableMonths, setAvailableMonths] = useState<
    { month: number; year: number }[]
  >([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return { month: now.getMonth(), year: now.getFullYear() };
  });
  const [lowStockProducts, setLowStockProducts] = useState<unknown[]>([]);
  const [outOfStockProducts, setOutOfStockProducts] = useState<unknown[]>([]);
  const [bestSellingTshirts, setBestSellingTshirts] = useState<
    { name: string; quantity: number; imageUrl: string | null; productId: string }[]
  >([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [recentReviews, setRecentReviews] = useState<
    {
      id: string;
      productName: string;
      userEmail?: string;
      rating: number;
      feedback: string;
      timestamp: Date;
    }[]
  >([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [averageReviews, setAverageReviews] = useState<
    {
      id: string;
      productName: string;
      averageRating: number;
      reviewCount: number;
    }[]
  >([]);
  const [loadingAverageReviews, setLoadingAverageReviews] = useState(true);
  const [returnsThisMonth, setReturnsThisMonth] = useState(0);
  const [totalRefunded, setTotalRefunded] = useState(0);

  const salesTables = useMemo(() => [...ADMIN_REALTIME_TABLES.sales], []);
  const inventoryTables = useMemo(() => [...ADMIN_REALTIME_TABLES.products], []);
  const feedbackTables = useMemo(
    () => [...ADMIN_REALTIME_TABLES.analyticsFeedback],
    []
  );

  const applySalesRows = (rows: SaleRow[]) => {
    setSalesRows(rows);
    setSalesData(buildSalesByMonth(rows));
    setWeeklySalesData(buildWeeklySales(rows));
    const months = getAvailableSalesMonths(rows);
    setAvailableMonths(months);
    if (months.length > 0) {
      const m = months[0];
      setSelectedMonth((prev) =>
        months.some((x) => x.month === prev.month && x.year === prev.year)
          ? prev
          : { month: m.month, year: m.year }
      );
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadSales = async () => {
      try {
        const rows = await fetchSalesRows();
        if (!cancelled) applySalesRows(rows);
      } catch (e) {
        console.error(e);
      }
    };
    void loadSales();
    const unsub = subscribeAdminTables(salesTables, () => {
      void loadSales();
    }, "analytics-sales");
    return () => {
      cancelled = true;
      unsub();
    };
  }, [salesTables]);

  useEffect(() => {
    if (chartType !== "inventory") return;
    let cancelled = false;
    const loadInventory = async (showLoading: boolean) => {
      if (showLoading) setLoadingInventory(true);
      try {
        const { lowStock, outOfStock, bestSelling } =
          await loadInventoryInsights();
        if (!cancelled) {
          setLowStockProducts(lowStock);
          setOutOfStockProducts(outOfStock);
          setBestSellingTshirts(bestSelling);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled && showLoading) setLoadingInventory(false);
      }
    };
    void loadInventory(true);
    const unsub = subscribeAdminTables(inventoryTables, () => {
      void loadInventory(false);
    }, "analytics-inventory");
    return () => {
      cancelled = true;
      unsub();
    };
  }, [chartType, inventoryTables]);

  useEffect(() => {
    if (chartType !== "monthly" || !salesRows.length) return;
    setMonthlySalesData(
      buildMonthlySalesForMonth(
        salesRows,
        selectedMonth.year,
        selectedMonth.month
      )
    );
  }, [chartType, selectedMonth, salesRows]);

  useEffect(() => {
    if (chartType !== "feedback") return;
    let cancelled = false;
    const loadFeedback = async (showLoading: boolean) => {
      if (showLoading) {
        setLoadingReviews(true);
        setLoadingAverageReviews(true);
      }
      try {
        const [reviews, ratings, returns] = await Promise.all([
          fetchProductReviews(),
          fetchProductRatingSummaries(),
          fetchReturnsThisMonth(),
        ]);
        if (!cancelled) {
          setRecentReviews(reviews);
          setAverageReviews(ratings);
          setReturnsThisMonth(returns.count);
          setTotalRefunded(returns.totalRefunded);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setRecentReviews([]);
          setAverageReviews([]);
        }
      } finally {
        if (!cancelled && showLoading) {
          setLoadingReviews(false);
          setLoadingAverageReviews(false);
        }
      }
    };
    void loadFeedback(true);
    const unsub = subscribeAdminTables(feedbackTables, () => {
      void loadFeedback(false);
    }, "analytics-feedback");
    return () => {
      cancelled = true;
      unsub();
    };
  }, [chartType, feedbackTables]);

  const aov =
    totalOrders > 0
      ? (totalSalesAmount / totalOrders).toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })
      : "0.00";

  return (
    <div className="w-full flex flex-col gap-8 text-[#8ec0ff] pb-8">
      <div className="w-full mb-8 flex flex-row gap-1 sm:gap-2 md:flex-wrap md:gap-6 md:justify-center">
        <div className="w-1/5 bg-[#22304a] rounded-lg p-0.5 text-center shadow text-[10px] sm:flex-1 sm:min-w-0 sm:p-6 sm:text-lg">
          <div className="font-semibold leading-tight">Customers</div>
          <div className="font-bold mt-0.5 text-sm sm:text-3xl">{recentUsers.length}</div>
        </div>
        <div className="w-1/5 bg-[#22304a] rounded-lg p-0.5 text-center shadow text-[10px] sm:flex-1 sm:min-w-0 sm:p-6 sm:text-lg">
          <div className="font-semibold leading-tight">Products</div>
          <div className="font-bold mt-0.5 text-sm sm:text-3xl">{totalProducts}</div>
        </div>
        <div className="w-1/5 bg-[#22304a] rounded-lg p-0.5 text-center shadow text-[10px] sm:flex-1 sm:min-w-0 sm:p-6 sm:text-lg">
          <div className="font-semibold leading-tight">Total Orders</div>
          <div className="font-bold mt-0.5 text-sm sm:text-3xl">{totalOrders}</div>
        </div>
        <div className="w-1/5 bg-[#22304a] rounded-lg p-0.5 text-center shadow text-[10px] sm:flex-1 sm:min-w-0 sm:p-6 sm:text-lg">
          <div className="font-semibold leading-tight">Total Sales</div>
          <div className="font-bold mt-0.5 text-sm sm:text-xl md:text-3xl">
            ₱{totalSalesAmount.toLocaleString()}
          </div>
        </div>
        <div className="w-1/5 bg-[#22304a] rounded-lg p-0.5 text-center shadow text-[10px] sm:flex-1 sm:min-w-0 sm:p-6 sm:text-lg">
          <div className="font-semibold leading-tight">Average Order Value</div>
          <div className="font-bold mt-0.5 text-sm sm:text-xl md:text-3xl">₱{aov}</div>
        </div>
      </div>

      <div className="flex justify-end max-w-3xl mx-auto mb-2 gap-2">
        <Select
          value={chartType}
          onValueChange={(v) => setChartType(v as ChartType)}
        >
          <SelectTrigger className="w-56 bg-[#22304a] border border-[#60A5FA] text-[#8ec0ff]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sales">Total Sales (₱)</SelectItem>
            <SelectItem value="quantity">Products Purchased</SelectItem>
            <SelectItem value="weekly">Weekly Sales</SelectItem>
            <SelectItem value="monthly">Monthly Sales</SelectItem>
            <SelectItem value="inventory">Inventory</SelectItem>
            <SelectItem value="feedback">Feedback</SelectItem>
          </SelectContent>
        </Select>
        {chartType === "monthly" && (
          <Select
            value={`${selectedMonth.year}-${selectedMonth.month}`}
            onValueChange={(v) => {
              const [year, month] = v.split("-").map(Number);
              setSelectedMonth({ year, month });
            }}
          >
            <SelectTrigger className="w-40 bg-[#22304a] border border-[#60A5FA] text-[#8ec0ff]">
              <SelectValue placeholder="Select Month" />
            </SelectTrigger>
            <SelectContent>
              {availableMonths.map((m) => (
                <SelectItem
                  key={`${m.year}-${m.month}`}
                  value={`${m.year}-${m.month}`}
                >{`${new Date(m.year, m.month).toLocaleString("default", { month: "short", year: "numeric" })}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {chartType === "inventory" ? (
        <InventoryPanel
          loading={loadingInventory}
          lowStock={lowStockProducts}
          outOfStock={outOfStockProducts}
          bestSelling={bestSellingTshirts}
        />
      ) : chartType === "feedback" ? (
        <FeedbackPanel
          averageReviews={averageReviews}
          loadingAverage={loadingAverageReviews}
          returnsThisMonth={returnsThisMonth}
          totalRefunded={totalRefunded}
          recentReviews={recentReviews}
          loadingReviews={loadingReviews}
        />
      ) : chartType === "weekly" ? (
        <ChartPanel title="Weekly Sales" data={weeklySalesData} dataKey="sales" />
      ) : chartType === "monthly" ? (
        <ChartPanel title="Monthly Sales" data={monthlySalesData} dataKey="sales" />
      ) : (
        <ChartPanel
          title={
            chartType === "sales"
              ? "Sales Over Time"
              : "Products Purchased Over Time"
          }
          data={salesData}
          dataKey={chartType}
          xKey="month"
        />
      )}
    </div>
  );
}

function ChartPanel({
  title,
  data,
  dataKey,
  xKey = "day",
}: {
  title: string;
  data: Record<string, string | number>[];
  dataKey: string;
  xKey?: string;
}) {
  return (
    <div className="bg-[#22304a] rounded-lg p-6 w-full max-w-3xl mx-auto shadow">
      <div className="text-xl font-semibold mb-4">{title}</div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} stroke="#8ec0ff" />
          <YAxis
            stroke="#8ec0ff"
            tickFormatter={(v) => {
              if (dataKey === "sales") {
                if (v >= 1000) return `₱${v / 1000}K`;
                if (v === 0) return "₱0";
                return `₱${v.toLocaleString()}`;
              }
              return String(v);
            }}
          />
          <Tooltip />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke="#60A5FA"
            fill="rgba(96,165,250,0.1)"
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke="#60A5FA"
            strokeWidth={3}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function InventoryPanel({
  loading,
  lowStock,
  outOfStock,
  bestSelling,
}: {
  loading: boolean;
  lowStock: unknown[];
  outOfStock: unknown[];
  bestSelling: {
    name: string;
    quantity: number;
    imageUrl: string | null;
    productId: string;
  }[];
}) {
  const productImg = (p: Record<string, unknown>) => {
    const urls = p.imageUrls as string[] | undefined;
    if (Array.isArray(urls) && urls.length > 0) return urls[0];
    return (p.image || p.imageUrl) as string | undefined;
  };

  return (
    <div className="bg-[#22304a] rounded-lg p-6 w-full max-w-3xl mx-auto shadow flex flex-col gap-6">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 bg-[#19223a] rounded-lg p-4 shadow flex flex-col min-h-[120px]">
          <div className="text-lg font-semibold mb-2 text-[#8ec0ff]">
            Low Stock Alerts (≤ 5)
          </div>
          {loading ? (
            <div className="text-[#8ec0ff]">Loading...</div>
          ) : lowStock.length === 0 ? (
            <div className="text-[#8ec0ff]">No low stock products.</div>
          ) : (
            <ul className="list-disc pl-6 text-sm">
              {lowStock.map((raw) => {
                const p = raw as Record<string, unknown> & {
                  id: string;
                  name: string;
                  lowStockSizes?: { size: string; stock: number }[] | null;
                  totalStock?: number;
                };
                const imgSrc = productImg(p);
                return (
                  <li key={p.id} className="mb-1 flex items-center gap-2">
                    {imgSrc ? (
                      <img
                        src={imgSrc}
                        alt={p.name}
                        className="w-8 h-8 object-cover rounded bg-[#161e2e] border border-[#22304a]"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded bg-[#22304a] flex items-center justify-center text-xs text-[#8ec0ff] border">
                        N/A
                      </div>
                    )}
                    <span className="font-semibold text-white">{p.name}</span>
                    {Array.isArray(p.lowStockSizes) && p.lowStockSizes.length > 0 ? (
                      <span className="text-[#60A5FA]">
                        [{" "}
                        {p.lowStockSizes
                          .map((s) => `${s.size}: ${s.stock}`)
                          .join(", ")}{" "}
                        ]
                      </span>
                    ) : (
                      <span className="text-[#60A5FA]">
                        ({p.totalStock ?? 0} left)
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex-1 bg-[#19223a] rounded-lg p-4 shadow flex flex-col min-h-[120px]">
          <div className="text-lg font-semibold mb-2 text-[#8ec0ff]">
            Out of Stock Products
          </div>
          {loading ? (
            <div className="text-[#8ec0ff]">Loading...</div>
          ) : outOfStock.length === 0 ? (
            <div className="text-[#8ec0ff]">No out of stock products.</div>
          ) : (
            <ul className="list-disc pl-6 text-sm">
              {outOfStock.map((raw) => {
                const p = raw as Record<string, unknown> & {
                  id: string;
                  name: string;
                };
                const imgSrc = productImg(p);
                return (
                  <li
                    key={p.id}
                    className="mb-1 flex items-center gap-2 font-semibold text-white"
                  >
                    {imgSrc ? (
                      <img
                        src={imgSrc}
                        alt={p.name}
                        className="w-8 h-8 object-cover rounded bg-[#161e2e] border border-[#22304a]"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded bg-[#22304a] flex items-center justify-center text-xs text-[#8ec0ff] border">
                        N/A
                      </div>
                    )}
                    <span>{p.name}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      <div className="bg-[#19223a] rounded-lg p-4 shadow flex flex-col items-center min-h-[220px]">
        <div className="text-lg font-semibold mb-2 text-[#8ec0ff]">
          Best Selling Products
        </div>
        {loading ? (
          <div className="text-[#8ec0ff]">Loading...</div>
        ) : bestSelling.length > 0 ? (
          <ul className="w-full max-w-md mx-auto overflow-y-auto max-h-[400px]">
            {bestSelling.map((t, idx) => (
              <li
                key={t.productId}
                className="flex items-center gap-4 mb-2 p-2 rounded bg-[#22304a]"
              >
                <span className="font-bold text-xl text-[#60A5FA]">{idx + 1}.</span>
                {t.imageUrl && (
                  <img
                    src={t.imageUrl}
                    alt={t.name}
                    className="w-10 h-10 object-contain rounded bg-[#161e2e]"
                  />
                )}
                <span className="font-semibold text-white">{t.name}</span>
                <span className="text-[#60A5FA] ml-auto">
                  Purchased: {t.quantity}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-[#8ec0ff]">No product sales data.</div>
        )}
      </div>
    </div>
  );
}

function FeedbackPanel({
  averageReviews,
  loadingAverage,
  returnsThisMonth,
  totalRefunded,
  recentReviews,
  loadingReviews,
}: {
  averageReviews: {
    id: string;
    productName: string;
    averageRating: number;
    reviewCount: number;
  }[];
  loadingAverage: boolean;
  returnsThisMonth: number;
  totalRefunded: number;
  recentReviews: {
    id: string;
    productName: string;
    userEmail?: string;
    rating: number;
    feedback: string;
    timestamp: Date;
  }[];
  loadingReviews: boolean;
}) {
  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 bg-[#19223a] rounded-lg p-6 shadow flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl text-[#ffe066]">★</span>
            <span className="text-xl font-semibold text-white">
              Average Product Ratings
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {loadingAverage ? (
              <div className="text-[#8ec0ff]">Loading...</div>
            ) : averageReviews.length === 0 ? (
              <div className="text-[#8ec0ff]">No ratings yet.</div>
            ) : (
              averageReviews.map((product) => (
                <div key={product.id} className="flex items-center gap-2">
                  <span className="text-[#cbd5e1] font-medium">
                    {product.productName}
                  </span>
                  <span className="text-[#ffe066] flex items-center">
                    {"★".repeat(Math.round(product.averageRating))}
                    <span className="text-[#334155]">
                      {"★".repeat(5 - Math.round(product.averageRating))}
                    </span>
                  </span>
                  <span className="text-white font-semibold ml-1">
                    {product.averageRating.toFixed(1)}
                  </span>
                  <span className="text-[#8ec0ff] text-sm">
                    ({product.reviewCount} reviews)
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="flex-1 bg-[#19223a] rounded-lg p-6 shadow flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl text-[#8ec0ff]">↻</span>
            <span className="text-xl font-semibold text-white">
              Returns & Refunds
            </span>
          </div>
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex justify-between items-center">
              <span className="text-[#cbd5e1]">Returns This Month</span>
              <span className="text-2xl font-bold text-[#f87171]">
                {returnsThisMonth}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#cbd5e1]">Total Refunded</span>
              <span className="text-2xl font-bold text-[#f87171]">
                ₱{totalRefunded.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-[#19223a] rounded-lg p-6 shadow flex flex-col h-[250px] overflow-y-auto">
        <div className="text-2xl font-semibold text-white mb-4">Recent Reviews</div>
        {loadingReviews ? (
          <div className="text-[#8ec0ff]">Loading reviews...</div>
        ) : recentReviews.length === 0 ? (
          <div className="text-[#8ec0ff]">No reviews yet.</div>
        ) : (
          <div className="flex flex-col gap-4">
            {recentReviews.map((review) => (
              <div
                key={review.id}
                className="bg-[#22304a] rounded p-4 flex flex-col gap-2"
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-white">
                    {review.userEmail
                      ? review.userEmail.replace(/(.{1}).*(@.*)/, "$1*****$2")
                      : "Anonymous"}{" "}
                    <span className="text-[#ffe066]">
                      {"★".repeat(review.rating)}
                      <span className="text-[#334155]">
                        {"★".repeat(5 - review.rating)}
                      </span>
                    </span>
                  </span>
                  <span className="text-[#8ec0ff] text-sm">
                    {review.timestamp.toLocaleDateString()}
                  </span>
                </div>
                <div className="text-white">{review.feedback}</div>
                <div className="text-[#8ec0ff] text-sm">{review.productName}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
