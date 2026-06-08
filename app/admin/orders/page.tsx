"use client";

import {
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter } from "lucide-react";
import {
  fetchAdminOrders,
  updateAdminOrderStatus,
  type AdminAddress,
  type AdminOrder,
} from "@/lib/admin/orders";
import { ADMIN_REALTIME_TABLES } from "@/lib/admin/realtime";
import { useAdminRealtimeQuery } from "@/hooks/useAdminRealtimeQuery";

type Order = AdminOrder;

const ORDER_STATUSES = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
  "returned/refunded",
];

const EMPTY_ORDERS: Order[] = [];

export default function AdminOrdersPage() {
  const orderTables = useMemo(() => [...ADMIN_REALTIME_TABLES.orders], []);
  const {
    data: ordersData,
    loading,
    setData: setOrdersData,
  } = useAdminRealtimeQuery<Order[]>({
    channel: "orders",
    tables: orderTables,
    fetcher: fetchAdminOrders,
  });
  const orders = ordersData ?? EMPTY_ORDERS;
  const setOrders: Dispatch<SetStateAction<Order[]>> = (updater) => {
    setOrdersData((prev) => {
      const current = prev ?? [];
      return typeof updater === "function" ? updater(current) : updater;
    });
  };
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date-desc");
  const [showMobileFilter, setShowMobileFilter] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    let filtered = [...orders];
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter((order) => {
        const fields = [order.orderNumber, order.userName, order.userEmail].map(
          (f) => (f || "").toLowerCase()
        );
        return fields.some((f) => f.includes(lower));
      });
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }
    if (sortBy === "date-desc") {
      filtered.sort((a, b) => {
        const dateA = a.dateOrdered ? a.dateOrdered.getTime() : 0;
        const dateB = b.dateOrdered ? b.dateOrdered.getTime() : 0;
        return dateB - dateA;
      });
    } else if (sortBy === "date-asc") {
      filtered.sort((a, b) => {
        const dateA = a.dateOrdered ? a.dateOrdered.getTime() : 0;
        const dateB = b.dateOrdered ? b.dateOrdered.getTime() : 0;
        return dateA - dateB;
      });
    } else if (sortBy === "total-desc") {
      filtered.sort((a, b) => (b.total || 0) - (a.total || 0));
    } else if (sortBy === "total-asc") {
      filtered.sort((a, b) => (a.total || 0) - (b.total || 0));
    }
    return filtered;
  }, [orders, searchTerm, statusFilter, sortBy]);

  const formatDate = (date: Date | string | undefined | null, withTime = false) => {
    if (!date) return "N/A";
    let d: Date;
    if (typeof date === "string") {
      d = new Date(date);
    } else {
      d = date;
    }
    if (isNaN(d.getTime())) return "N/A";
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {})
    }).format(d);
  };

  const formatDateLong = (date: Date | string | undefined | null) => {
    if (!date) return "N/A";
    if (date === 'pending') return "Pending...";
    let d: Date;
    if (typeof date === "string") {
      d = new Date(date);
    } else {
      d = date as Date;
    }
    if (isNaN(d.getTime())) return "N/A";
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(d);
  };

  const formatAddress = (addr?: AdminAddress) => {
    if (!addr) return "N/A";
    return `${addr.firstName} ${addr.lastName}, ${addr.address1}${addr.address2 ? ', ' + addr.address2 : ''}, ${addr.city}, ${addr.region} ${addr.postalCode}, ${addr.phone}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "processing": return "bg-blue-100 text-blue-800";
      case "shipped": return "bg-purple-100 text-purple-800";
      case "delivered": return "bg-green-100 text-green-800";
      case "cancelled": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return "⏳";
      case "processing": return "⚙️";
      case "shipped": return "📦";
      case "delivered": return "✅";
      case "cancelled": return "❌";
      default: return "📋";
    }
  };

  async function updateOrderStatus({
    orderId,
    newStatus,
    optimisticDeliveredAt,
  }: {
    orderId: string;
    newStatus: string;
    optimisticDeliveredAt?: Date | null;
  }) {
    const previous = orders.find((o) => o.id === orderId);
    if (!previous) {
      alert("Failed to update order status: Order not found.");
      return;
    }

    const newHistoryEntry = {
      status: newStatus,
      timestamp: new Date().toISOString(),
    };

    setUpdatingOrderId(orderId);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: newStatus,
              deliveredAt:
                optimisticDeliveredAt !== undefined
                  ? optimisticDeliveredAt
                  : o.deliveredAt,
              statusHistory: [...(o.statusHistory || []), newHistoryEntry],
            }
          : o
      )
    );

    try {
      await updateAdminOrderStatus(
        orderId,
        newStatus,
        newStatus === "delivered"
          ? (optimisticDeliveredAt ?? new Date()).toISOString()
          : newStatus !== "delivered" && previous.status === "delivered"
            ? null
            : undefined
      );
    } catch (err) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? previous : o))
      );
      alert(
        "Failed to update order status: " +
          (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setUpdatingOrderId(null);
    }
  }

  // Helper to get a valid date from order (robust for Firestore Timestamp, string, number, or serverTimestamp placeholder)
  const getOrderDate = (order: Order) => {
    if (
      order.dateOrdered &&
      order.dateOrdered instanceof Date &&
      !isNaN(order.dateOrdered.getTime())
    ) {
      return order.dateOrdered;
    }
    if (order.statusHistory?.length) {
      const timestamps = order.statusHistory
        .map((h) => {
          const t = new Date(h.timestamp);
          return isNaN(t.getTime()) ? null : t;
        })
        .filter((t): t is Date => t !== null);
      if (timestamps.length > 0) {
        return new Date(Math.min(...timestamps.map((t) => t.getTime())));
      }
    }
    return undefined;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3390ff] mx-auto"></div>
          <p className="mt-4 text-[#8ec0ff]">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full pb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          {/* Mobile Filter Button */}
          <div className="flex gap-2 items-center w-full">
            {/* Desktop: show all controls */}
            <div className="hidden sm:flex gap-2 items-center w-full">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#8ec0ff] h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search orders, customer name, or email..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-[#22304a] rounded-md focus:outline-none focus:ring-2 focus:ring-[#3390ff] focus:border-transparent text-white bg-[#22304a] placeholder-[#8ec0ff]"
                />
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="border border-[#22304a] rounded-md px-3 py-2 text-white bg-[#22304a] focus:outline-none focus:ring-2 focus:ring-[#3390ff]"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="border border-[#22304a] rounded-md px-3 py-2 text-white bg-[#22304a] focus:outline-none focus:ring-2 focus:ring-[#3390ff]"
              >
                <option value="total-desc">Total: High to Low</option>
                <option value="total-asc">Total: Low to High</option>
              </select>
            </div>
            {/* Mobile: show filter button */}
            <button
              className="sm:hidden flex items-center gap-2 px-4 py-2 bg-[#22304a] text-[#8ec0ff] rounded-md border border-[#22304a] w-full justify-center"
              onClick={() => setShowMobileFilter(true)}
            >
              <Filter className="w-4 h-4" /> Filter
            </button>
            {/* Mobile Filter Dropdown/Modal */}
            {showMobileFilter && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
                <div className="bg-[#161e2e] rounded-lg p-6 w-11/12 max-w-sm mx-auto flex flex-col gap-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-lg font-semibold text-[#8ec0ff]">Filter Orders</span>
                    <button onClick={() => setShowMobileFilter(false)} className="text-[#8ec0ff] text-2xl leading-none">&times;</button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#8ec0ff] h-4 w-4" />
                    <input
                      type="text"
                      placeholder="Search orders, customer name, or email..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-[#22304a] rounded-md focus:outline-none focus:ring-2 focus:ring-[#3390ff] focus:border-transparent text-white bg-[#22304a] placeholder-[#8ec0ff] w-full"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="border border-[#22304a] rounded-md px-3 py-2 text-white bg-[#22304a] focus:outline-none focus:ring-2 focus:ring-[#3390ff] w-full"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    className="border border-[#22304a] rounded-md px-3 py-2 text-white bg-[#22304a] focus:outline-none focus:ring-2 focus:ring-[#3390ff] w-full"
                  >
                    <option value="total-desc">Total: High to Low</option>
                    <option value="total-asc">Total: Low to High</option>
                  </select>
                  <button
                    className="mt-2 w-full bg-[#3390ff] text-white py-2 rounded-md font-semibold hover:bg-[#2360b7]"
                    onClick={() => setShowMobileFilter(false)}
                  >Apply Filters</button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#3390ff] mb-2">All Orders</h1>
          <p className="text-[#8ec0ff]">View and manage all active orders</p>
        </div>
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="mt-2 text-sm font-medium text-[#8ec0ff]">No orders found</h3>
            <p className="mt-1 text-sm text-[#8ec0ff]">No orders have been placed yet.</p>
          </div>
        ) : (
          <div className="space-y-6 overflow-x-auto w-full">
            {filteredOrders.map((order) => (
                <Card key={order.id} className="overflow-hidden bg-[#161e2e] text-white border border-[#22304a] w-full max-w-full box-border">
                  <CardHeader className="bg-[#22304a]">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl">{getStatusIcon(order.status)}</span>
                        <Badge className={
                          (order.status === 'pending' ? 'bg-yellow-300 text-black' :
                          order.status === 'processing' ? 'bg-blue-400 text-white' :
                          order.status === 'shipped' ? 'bg-purple-400 text-white' :
                          order.status === 'delivered' ? 'bg-green-400 text-white' :
                          order.status === 'cancelled' ? 'bg-red-400 text-white' :
                          'bg-[#8ec0ff] text-black') + ' flex justify-center items-center'
                        }>
                          {order.status === "cancelled" ? (
                            <span className="font-semibold px-2 py-1">Cancelled</span>
                          ) : (
                            <Select
                              value={order.status}
                              disabled={updatingOrderId === order.id}
                              onValueChange={async (newStatus) => {
                                if (newStatus === order.status) return;
                                let optimisticDeliveredAt: Date | null | undefined;
                                if (newStatus === "delivered") {
                                  optimisticDeliveredAt = new Date();
                                } else if (
                                  order.status === "delivered" &&
                                  newStatus !== "delivered"
                                ) {
                                  optimisticDeliveredAt = null;
                                }
                                await updateOrderStatus({
                                  orderId: order.id,
                                  newStatus,
                                  optimisticDeliveredAt,
                                });
                              }}
                            >
                              <SelectTrigger className="h-8 min-w-[9rem] border-none bg-transparent shadow-none text-inherit font-semibold focus:ring-2 focus:ring-[#3390ff]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ORDER_STATUSES.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {status === "returned/refunded"
                                      ? "Returned/Refunded"
                                      : status.charAt(0).toUpperCase() + status.slice(1)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </Badge>
                        <div>
                          <p className="font-medium text-white">{order.orderNumber}</p>
                          <p className="text-xs text-[#8ec0ff]">Date Ordered: {formatDateLong(getOrderDate(order))}</p>
                          {order.userEmail && (
                            <p className="text-xs text-[#8ec0ff]">{order.userEmail}</p>
                          )}
                          {order.userPhone && (
                            <p className="text-xs text-[#8ec0ff]">{order.userPhone}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className="block text-xs text-[#8ec0ff] font-semibold">Payment: {order.paymentMethod?.toUpperCase() || 'N/A'}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="block text-xs text-[#8ec0ff]">Status: {order.status.charAt(0).toUpperCase() + order.status.slice(1)}</span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 bg-[#161e2e] text-white">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Order Items */}
                      <div className="lg:col-span-2">
                        <h4 className="font-medium text-[#8ec0ff] mb-3">Items Ordered</h4>
                        <div className="space-y-3">
                          {order.items.map((item, idx) => (
                            <div key={`${item.id}-${idx}`} className="flex items-center gap-3">
                              <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-[#22304a]">
                                {item.image ? (
                                  <img
                                    src={item.image}
                                    alt={item.name}
                                    className="object-cover w-full h-full"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[#8ec0ff] text-xs">
                                    No image
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-white truncate">{item.name}</p>
                                <p className="text-sm text-[#8ec0ff]">
                                  Qty: {item.quantity}
                                  {Array.isArray(item.size)
                                    ? (item.size as any[]).map((s, idx) => (
                                        <span key={idx}> • {s.size}: {s.stock}</span>
                                      ))
                                    : item.size && typeof item.size === 'object'
                                      ? ` • ${(item.size as any).size}: ${(item.size as any).stock}`
                                      : item.size
                                        ? ` • ${item.size}`
                                        : null}
                                  {item.color && <> • {item.color}</>}
                                </p>
                                <p className="text-sm font-medium text-[#3390ff]">
                                  {formatCurrency(item.price)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Order Summary */}
                      <div className="bg-[#22304a] rounded-lg p-4">
                        <h4 className="font-medium text-[#8ec0ff] mb-3">Order Summary</h4>
                        <div className="flex flex-col gap-1 text-sm">
                          <span>Subtotal: <span className="text-[#3390ff]">{formatCurrency(order.subtotal)}</span></span>
                          <span>Shipping: <span className="text-[#3390ff]">{formatCurrency(order.shipping)}</span></span>
                          <span>Tax: <span className="text-[#3390ff]">{formatCurrency(order.tax)}</span></span>
                          <span className="font-semibold">Total: <span className="text-[#3390ff]">{formatCurrency(order.total)}</span></span>
                        </div>
                        <div className="mt-4">
                          {order.dateOrdered && (() => {
                            let dateOrderedObj: any = order.dateOrdered;
                            if (typeof dateOrderedObj === 'number' || typeof dateOrderedObj === 'string') dateOrderedObj = new Date(dateOrderedObj);
                            if ((dateOrderedObj as any) instanceof Date && !isNaN(dateOrderedObj.getTime())) {
                              return <span className="block text-xs text-[#8ec0ff]">Date Ordered: {formatDateLong(dateOrderedObj)}</span>;
                            }
                            return null;
                          })()}
                          {(() => {
                            let deliveredDateObj: any = order.deliveredAt;
                            if (typeof deliveredDateObj === 'number' || typeof deliveredDateObj === 'string') deliveredDateObj = new Date(deliveredDateObj);
                            if ((deliveredDateObj as any) instanceof Date && !isNaN(deliveredDateObj.getTime()) && order.status === 'delivered') {
                              return (
                                <span className="block text-xs text-[#8ec0ff]">
                                  Status: Delivered {formatDateLong(deliveredDateObj)}
                                </span>
                              );
                            }
                            return (
                              <span className="block text-xs text-[#8ec0ff]">Status: {order.status.charAt(0).toUpperCase() + order.status.slice(1)}</span>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                    {/* Addresses */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                      <div className="bg-[#22304a] rounded-lg p-4">
                        <h4 className="font-medium text-[#8ec0ff] mb-2">Shipping Address</h4>
                        <p className="text-sm text-white">{formatAddress(order.shippingAddress)}</p>
                      </div>
                      <div className="bg-[#22304a] rounded-lg p-4">
                        <h4 className="font-medium text-[#8ec0ff] mb-2">Billing Address</h4>
                        <p className="text-sm text-white">{formatAddress(order.billingAddress)}</p>
                      </div>
                    </div>
                    {/* Status History */}
                    <div className="flex flex-col gap-4 pl-2 border-l-2 border-blue-900">
                      {order.statusHistory && order.statusHistory.length > 0 ? (
                        order.statusHistory.map((entry, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            <div className="w-3 h-3 rounded-full bg-blue-400 mt-1" />
                            <div>
                              <div className="font-medium">{entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}</div>
                              <div className="text-xs text-[#93c5fd]">{formatDateLong(entry.timestamp)}</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-[#93c5fd]">No status history yet.</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
            ))}
          </div>
        )}
    </div>
  );
} 