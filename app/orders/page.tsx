"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import {
  fetchUserOrders,
  markOrderReceived,
  updateUserOrderStatus,
  type StorefrontOrder,
} from "@/lib/storefront/orders";
import { subscribeUserOrders } from "@/lib/storefront/orderRealtime";
import { Calendar, Package, Search, Filter, Eye, Download } from "lucide-react";
import { useRouter } from 'next/navigation';


type Order = StorefrontOrder & {
  dateOrdered?: Date | string | null;
  status:
    | "pending"
    | "processing"
    | "shipped"
    | "delivered"
    | "cancelled"
    | "completed"
    | "returned/refunded"
    | string;
};

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showOptions, setShowOptions] = useState<{ [orderId: string]: boolean }>({});
  const [selectedRating, setSelectedRating] = useState<{ [orderId: string]: number }>({});
  const [showReturnForm, setShowReturnForm] = useState<{ [orderId: string]: boolean }>({});
  const [returnReason, setReturnReason] = useState<{ [orderId: string]: string }>({});
  const [returnSubmitted, setReturnSubmitted] = useState<{ [orderId: string]: boolean }>({});
  const [ratingSubmitted, setRatingSubmitted] = useState<{ [orderId: string]: boolean }>({});
  const [showStarRating, setShowStarRating] = useState<{ [orderId: string]: boolean }>({});
  const [actionCompleted, setActionCompleted] = useState<{ [orderId: string]: boolean }>({});
  const [showReturnPrompt, setShowReturnPrompt] = useState<{ [orderId: string]: boolean }>({});
  const [returnReasonInput, setReturnReasonInput] = useState<{ [orderId: string]: string }>({});
  const [showRatingPrompt, setShowRatingPrompt] = useState<{ [orderId: string]: boolean }>({});
  const [ratingInput, setRatingInput] = useState<{ [orderId: string]: number }>({});
  const ORDER_STATUSES = [
    "pending",
    "processing",
    "shipped",
    "delivered",
    "completed",
    "cancelled",
    "returned/refunded",
  ];

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setOrders([]);
      setFilteredOrders([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadOrders = async () => {
      try {
        const fetchedOrders = await fetchUserOrders(user.uid);
        if (!cancelled) {
          setOrders(fetchedOrders as Order[]);
          setFilteredOrders(fetchedOrders as Order[]);
        }
      } catch (error) {
        console.error("Error fetching orders:", error);
        if (!cancelled) {
          setOrders([]);
          setFilteredOrders([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadOrders();
    const unsubscribe = subscribeUserOrders(user.uid, () => {
      void loadOrders();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user, authLoading]);

  useEffect(() => {
    let filtered = orders;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.items.some(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      if (statusFilter === "completed") {
        filtered = filtered.filter(order => order.status === "completed");
      } else {
        filtered = filtered.filter(order => order.status === statusFilter);
      }
    }

    setFilteredOrders(filtered);
  }, [orders, searchTerm, statusFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'shipped': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-[#001F3F]';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'processing': return '⚙️';
      case 'shipped': return '📦';
      case 'delivered': return '✅';
      case 'cancelled': return '❌';
      case 'completed': return '✅';
      default: return '📋';
    }
  };

  // Helper to get a valid date from order (robust for Firestore Timestamp, string, number, or serverTimestamp placeholder)
  const getOrderDate = (order: any) => {
    const d = order.dateOrdered;
    if (!d) return undefined;
    if (typeof d.toDate === 'function') return d.toDate(); // Firestore Timestamp
    if (typeof d === 'object' && d._methodName === 'serverTimestamp') return 'pending'; // Pending server timestamp
    if (typeof d === 'string' || typeof d === 'number') {
      const dateObj = new Date(d);
      if (!isNaN(dateObj.getTime())) return dateObj;
    }
    return undefined;
  };

  // Use a long date format for 'Date Ordered', handle 'pending' state
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  // Add handler for return/refund
  const handleReturnRefund = async (order: Order, _reason: string) => {
    if (!user || !order) return;
    try {
      await updateUserOrderStatus(order.id, "completed");
      setActionCompleted((prev) => ({ ...prev, [order.id]: true }));
    } catch {
      alert("Failed to update order status. Please try again.");
    }
  };

  const handleRateOrder = async (order: Order, _rating: number) => {
    if (!user || !order) return;
    try {
      await updateUserOrderStatus(order.id, "completed");
      setActionCompleted((prev) => ({ ...prev, [order.id]: true }));
    } catch {
      alert("Failed to update order status. Please try again.");
    }
  };

  const handleOrderReceived = async (order: Order) => {
    if (!user || !order) return;
    try {
      await markOrderReceived(order.id);
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, orderReceived: true } : o))
      );
      setFilteredOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, orderReceived: true } : o))
      );
    } catch {
      alert("Failed to update order status. Please try again.");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-[#001F3F]">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101828] text-[#60A5FA] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#60A5FA] mb-2">My Orders</h1>
          <p className="text-[#60A5FA]">Track and manage your orders</p>
        </div>

        {/* Filters */}
        <div className="bg-[#19223a] rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#60A5FA] h-4 w-4" />
                <Input
                  placeholder="Search orders or products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-[#60A5FA] text-[#60A5FA] bg-[#101828] placeholder-[#60A5FA]"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  {ORDER_STATUSES.map(status => (
                    <SelectItem key={status} value={status}>
                      {status === 'returned/refunded' ? 'Returned/Refunded' : status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-[#60A5FA]" />
            <h3 className="mt-2 text-sm font-medium text-[#60A5FA]">No orders found</h3>
            <p className="mt-1 text-sm text-[#60A5FA]">
              {searchTerm || statusFilter !== "all" 
                ? "Try adjusting your search or filter criteria."
                : "Get started by placing your first order."
              }
            </p>
            {!searchTerm && statusFilter === "all" && (
              <div className="mt-6">
                <Link href="/#featured">
                  <Button className="bg-[#60A5FA] text-[#101828] hover:bg-[#3380c0]">Browse Products</Button>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {filteredOrders.map((order) => {
              const dateObj = getOrderDate(order);
              return (
                <div key={order.id}>
                  <Card
                    className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow bg-[#19223a] border-[#60A5FA] text-[#60A5FA]"
                    onClick={() => router.push(`/orders/${order.id}`)}
                  >
                    <CardHeader className="bg-[#19223a] border-b border-[#60A5FA]">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{getStatusIcon(order.status)}</span>
                            <span className={`ml-2 px-3 py-1 rounded-full font-semibold text-sm ${getStatusColor(order.status)} flex items-center gap-1`}>
                              {order.status === 'returned/refunded' ? 'Returned/Refunded' : order.status === 'completed' ? 'Completed' : order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-[#60A5FA]">{order.orderNumber}</p>
                            <p className="text-sm text-[#60A5FA]">
                              {order.status === "delivered" && order.estimatedDelivery
                                ? `Date Delivered: ${formatDateLong(order.estimatedDelivery)}`
                                : order.dateOrdered
                                  ? `Date Ordered: ${formatDateLong(order.dateOrdered)}`
                                  : ""}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 bg-[#19223a] text-[#60A5FA]">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Order Items */}
                        <div className="lg:col-span-2">
                          <h4 className="font-medium text-[#60A5FA] mb-3">Items</h4>
                          <div className="space-y-3">
                            {order.items.map((item, idx) => (
                              <div key={`${item.id}-${idx}`} className="flex items-center gap-3">
                                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                                  {item.image ? (
                                    <Image src={item.image} alt={item.name} fill className="object-cover" />
                                  ) : (
                                    <div className="w-16 h-16 flex items-center justify-center bg-[#101828] text-[#60A5FA] text-xs">No Image</div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-[#60A5FA] truncate">{item.name}</p>
                                  <p className="text-sm text-[#60A5FA]">
                                    Qty: {item.quantity}
                                    {item.size ? ` - Size: ${typeof item.size === 'object' && item.size !== null && 'size' in item.size ? (item.size as any).size : item.size}` : ''}
                                    {(() => {
                                      const colorVal = item.color;
                                      if (!colorVal) return '';
                                      if (typeof colorVal === 'object' && colorVal !== null && 'color' in colorVal) {
                                        return ` - Color: ${(colorVal as any).color}`;
                                      }
                                      return ` - Color: ${colorVal}`;
                                    })()}
                                  </p>
                                  <p className="text-sm font-medium text-[#60A5FA]">
                                    {formatCurrency(item.price)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Order Summary */}
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-medium text-[#60A5FA] mb-2">Order Summary</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span>Subtotal:</span>
                                <span>{formatCurrency(order.total)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Shipping:</span>
                                <span>Free</span>
                              </div>
                              <div className="border-t pt-2 flex justify-between font-medium">
                                <span>Total:</span>
                                <span>{formatCurrency(order.total)}</span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-medium text-[#60A5FA] mb-2">Shipping Address</h4>
                            <p className="text-sm text-[#60A5FA]">
                              {order.shippingAddress.firstName} {order.shippingAddress.lastName}<br />
                              {order.shippingAddress.address1}<br />
                              {order.shippingAddress.city}, {order.shippingAddress.region} {order.shippingAddress.postalCode}<br />
                              {order.shippingAddress.phone}
                            </p>
                          </div>

                          {order.billingAddress && (
                            <div>
                              <h4 className="font-medium text-[#60A5FA] mb-2">Billing Address</h4>
                              <p className="text-sm text-[#60A5FA]">
                                {order.billingAddress.firstName} {order.billingAddress.lastName}<br />
                                {order.billingAddress.address1 && <>{order.billingAddress.address1}<br /></>}
                                {order.billingAddress.address2 && <>{order.billingAddress.address2}<br /></>}
                                {order.billingAddress.city && <>{order.billingAddress.city}, </>}{order.billingAddress.region && <>{order.billingAddress.region} </>}{order.billingAddress.postalCode && <>{order.billingAddress.postalCode}<br /></>}
                                {order.billingAddress.phone}
                              </p>
                            </div>
                          )}

                          {order.trackingNumber && (
                            <div>
                              <h4 className="font-medium text-[#60A5FA] mb-2">Tracking</h4>
                              <p className="text-sm text-[#60A5FA]">
                                Number: {order.trackingNumber}<br />
                                {order.estimatedDelivery && (
                                  <>Estimated Delivery: {formatDateLong(order.estimatedDelivery)}</>
                                )}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
} 