"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, Package, Truck, CheckCircle, Clock, MapPin, Phone, Mail, CreditCard, Download, Share2 } from "lucide-react";
import { useParams, useRouter } from 'next/navigation';
import {
  fetchUserOrder,
  confirmOrderReceived,
  cancelUserOrder,
  canCustomerCancelOrder,
  returnUserOrder,
  rateOrderItems,
  type StorefrontOrder,
} from "@/lib/storefront/orders";
import { subscribeUserOrders } from "@/lib/storefront/orderRealtime";
import React from 'react';
import { Star } from "lucide-react";
import jsPDF from "jspdf";


interface OrderItem {
  id: string;
  productId?: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  size?: string;
  color?: string;
}

interface Address {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  region: string;
  postalCode: string;
  phone: string;
}

interface Order {
  id: string;
  orderNumber: string;
  orderDate: Date;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'completed' | 'returned/refunded';
  total: number;
  subtotal: number;
  shipping: number;
  tax: number;
  items: OrderItem[];
  shippingAddress: Address;
  billingAddress: Address;
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'failed';
  trackingNumber?: string;
  estimatedDelivery?: Date;
  deliveryDate?: Date;
  notes?: string;
  processedDate?: Date;
  shippedDate?: Date;
  statusHistory?: { status: string; timestamp: string | Date }[];
}

function mapStorefrontToPageOrder(row: StorefrontOrder): Order {
  const statusDate = (status: string) => {
    const entry = row.statusHistory.find((h) => h.status === status);
    if (!entry?.timestamp) return undefined;
    const d = new Date(entry.timestamp);
    return Number.isNaN(d.getTime()) ? undefined : d;
  };

  return {
    id: row.id,
    orderNumber: row.orderNumber,
    orderDate: row.dateOrdered ?? new Date(),
    status: (row.status === "rated" || row.status === "returned"
      ? "completed"
      : row.status) as Order["status"],
    total: row.total,
    subtotal: row.subtotal,
    shipping: row.shipping,
    tax: row.tax,
    items: row.items,
    shippingAddress: row.shippingAddress,
    billingAddress: row.billingAddress ?? row.shippingAddress,
    paymentMethod: row.paymentMethod,
    paymentStatus: (row.paymentStatus || "pending") as Order["paymentStatus"],
    trackingNumber: row.trackingNumber,
    estimatedDelivery: row.estimatedDelivery ?? undefined,
    deliveryDate: row.deliveredAt ?? undefined,
    notes: row.notes,
    processedDate: statusDate("processing"),
    shippedDate: statusDate("shipped"),
    statusHistory: row.statusHistory,
  };
}

function parseHistoryTimestamp(timestamp: string | Date): Date {
  if (timestamp instanceof Date) return timestamp;
  const d = new Date(timestamp);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

interface TrackingEvent {
  date: Date;
  status: string;
  location: string;
  description: string;
}

export default function OrderDetailsPage() {
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedRating, setSelectedRating] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const [orderReceived, setOrderReceived] = useState(false);
  const [actionCompleted, setActionCompleted] = useState(false);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [showRatingSection, setShowRatingSection] = useState(false);

  const params = useParams();
  const orderId = params.id as string;
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setOrder(null);
      setOrderItems([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadOrder = async () => {
      try {
        const row = await fetchUserOrder(user.uid, orderId);
        if (cancelled) return;
        if (row) {
          const mapped = mapStorefrontToPageOrder(row);
          setOrder(mapped);
          setOrderItems(mapped.items);
          setOrderReceived(!!row.orderReceived);
          setActionCompleted(!!row.actionCompleted);
        } else {
          setOrder(null);
          setOrderItems([]);
        }
      } catch (error) {
        console.error("Error fetching order details:", error);
        if (!cancelled) {
          setOrder(null);
          setOrderItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadOrder();
    const unsubscribe = subscribeUserOrders(user.uid, () => {
      void loadOrder();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user, authLoading, orderId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'shipped': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-[#001F3F]';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-5 w-5" />;
      case 'processing': return <Package className="h-5 w-5" />;
      case 'shipped': return <Truck className="h-5 w-5" />;
      case 'delivered': return <CheckCircle className="h-5 w-5" />;
      case 'cancelled': return <Clock className="h-5 w-5" />;
      case 'completed': return <CheckCircle className="h-5 w-5" />;
      default: return <Package className="h-5 w-5" />;
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  // Add handler to mark order as received
  const handleOrderReceived = async () => {
    if (!user || !order) return;
    try {
      await confirmOrderReceived(order.id);
      setOrderReceived(true);
      setOrder({
        ...order,
        status: "delivered",
        paymentStatus: "paid",
        deliveryDate: new Date(),
      });
    } catch {
      alert("Failed to update order status. Please try again.");
    }
  };

  const handleReturnRefund = async (reason: string) => {
    if (!user || !order) return;
    try {
      await returnUserOrder(order.id, order.items, reason, user.uid);
      setActionCompleted(true);
      router.push("/orders");
    } catch {
      alert("Failed to update order status. Please try again.");
    }
  };

  const handleRateOrder = async (rating: number, feedbackText: string) => {
    if (!user || !order) return;
    try {
      await rateOrderItems(
        order.id,
        order.items,
        rating,
        feedbackText,
        user.uid,
        user.email,
        order.orderNumber
      );
      setActionCompleted(true);
      router.push("/orders");
    } catch (err) {
      console.error("Failed to update order status or add rating:", err);
      alert("Failed to update order status or add rating. Please try again.");
    }
  };

  const handleReturnRefundWithReason = async () => {
    if (!user || !order) return;
    try {
      await returnUserOrder(
        order.id,
        order.items,
        returnReason,
        user.uid
      );
      setActionCompleted(true);
      router.push("/orders");
    } catch (err) {
      console.error("Failed to update order status or add return reason:", err);
      alert("Failed to update order status or add return reason. Please try again.");
    }
    setShowReturnForm(false);
    setReturnReason("");
  };

  const handleCancelOrder = async () => {
    if (!user || !order) return;
    if (!canCustomerCancelOrder(order.status)) {
      alert(
        "This order can no longer be cancelled. Only pending orders can be cancelled."
      );
      return;
    }
    try {
      await cancelUserOrder(order.id);
      setOrder({ ...order, status: "cancelled" });
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Failed to cancel order. Please try again."
      );
    }
  };

  // PDF receipt download handler
  const handleDownloadReceipt = () => {
    if (!order) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'normal');
    // Set dark background
    doc.setFillColor(30, 30, 30);
    doc.rect(0, 0, 210, 297, 'F');

    // FROM section
    doc.setTextColor(100, 150, 255); // blue
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('FROM', 12, 18);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.text('DPT ONE', 12, 24);

    // TO section
    doc.setTextColor(100, 150, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('TO', 12, 34);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.text(`${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`, 12, 40);
    doc.text(order.shippingAddress.address1 || '', 12, 45);
    doc.text(`${order.shippingAddress.city?.toUpperCase() || ''}, ${order.shippingAddress.region} ${order.shippingAddress.postalCode}`, 12, 50);

    // RECEIPT title
    doc.setTextColor(100, 150, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('RECEIPT', 198, 22, { align: 'right' });

    // Receipt #: and Date
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('Receipt #:', 140, 32);
    doc.text('Receipt Date:', 140, 38);
    doc.setFont('helvetica', 'normal');
    doc.text(order.orderNumber, 198, 32, { align: 'right' });
    doc.text(formatDateMMDDYYYY(new Date()), 198, 38, { align: 'right' });

    // Table header
    let y = 60;
    doc.setFillColor(30, 30, 30);
    doc.setDrawColor(100, 150, 255);
    doc.setTextColor(100, 150, 255);
    doc.setFont('helvetica', 'bold');
    doc.rect(12, y - 6, 186, 8, 'S');
    doc.text('QTY', 16, y);
    doc.text('Description', 36, y);
    doc.text('Unit Price', 120, y, { align: 'right' });
    doc.text('Amount', 196, y, { align: 'right' });
    y += 6;
    doc.setDrawColor(255, 255, 255);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    // Table rows
    order.items.forEach((item, idx) => {
      doc.text(String(item.quantity), 16, y);
      doc.text(item.name, 36, y);
      doc.text(`PHP ${item.price.toFixed(2)}`, 120, y, { align: 'right' });
      doc.text(`PHP ${(item.price * item.quantity).toFixed(2)}`, 196, y, { align: 'right' });
      y += 7;
    });
    // Subtotal, Shipping Fee, Total
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Subtotal:', 150, y, { align: 'right' });
    doc.text(`PHP ${order.subtotal.toFixed(2)}`, 196, y, { align: 'right' });
    y += 7;
    doc.text('Shipping Fee:', 150, y, { align: 'right' });
    doc.text(`PHP ${order.shipping.toFixed(2)}`, 196, y, { align: 'right' });
    y += 7;
    doc.text('Total:', 150, y, { align: 'right' });
    doc.text(`PHP ${order.total.toFixed(2)}`, 196, y, { align: 'right' });

    // Terms and conditions
    y += 15;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 150, 255);
    doc.text('TERMS AND CONDITIONS', 12, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.text('Payment is due within 14 days of project completion.', 12, y);
    y += 5;
    doc.text('All checks to be made out to DPT ONE.', 12, y);
    y += 5;
    doc.text('Thank you for your business!', 12, y);

    // Footer - Contact Us
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 150, 255);
    doc.text('Contact Us', 12, 285);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.text('sisiglovers@gmail.com', 12, 290);
    doc.text('+639670095657', 12, 295);
    doc.text('Cebu, Philippines', 60, 295);
    doc.save(`DPTONE_Receipt_${order.orderNumber}.pdf`);
  }

  // Helper to format date as MM/DD/YYYY
  function formatDateMMDDYYYY(date: Date | undefined) {
    if (!date) return '-';
    const d = new Date(date);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#101828] flex items-center justify-center text-[#60A5FA]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#60A5FA] mx-auto"></div>
          <p className="mt-4">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#101828] flex items-center justify-center text-[#60A5FA]">
        <div className="text-center">
          <Package className="mx-auto h-12 w-12" />
          <h3 className="mt-2 text-sm font-medium">Order not found</h3>
          <p className="mt-1 text-sm">The order you're looking for doesn't exist.</p>
          <div className="mt-6">
            <Link href="/orders">
              <Button>Back to Orders</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101828] text-[#60A5FA] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/orders" className="inline-flex items-center text-sm hover:text-[#93c5fd] mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Orders
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-[#60A5FA]">Order {order.orderNumber}</h1>
              <p className="text-[#60A5FA] mt-1 font-medium">
                {order.status === "delivered" && order.deliveryDate
                  ? `Date Delivered: ${formatDate(order.deliveryDate)}`
                  : order.orderDate
                    ? `Date Ordered: ${formatDate(order.orderDate)}`
                    : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Status */}
            <div className="bg-[#19223a] rounded-2xl shadow-lg p-4">
              <div className="flex items-center gap-2 text-2xl font-semibold mb-4">
                {order.status === 'returned/refunded' && <span className="text-xl">📋</span>}
                <span>Order Status</span>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <Badge className={getStatusColor(order.status)}>
                  {order.status === 'completed' ? 'Completed' : order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </Badge>
                {order.estimatedDelivery && (
                  <span className="text-sm">
                    Estimated delivery: {formatDate(order.estimatedDelivery)}
                  </span>
                )}
              </div>
              {/* Status Dates Section */}
              <div className="flex flex-col gap-1 mt-2 text-[#60A5FA] text-base">
                {order.orderDate && (
                  <div>Date Ordered: <span className="font-medium">{formatDate(order.orderDate)}</span></div>
                )}
                {order.processedDate && (
                  <div>Date Processed: <span className="font-medium">{formatDate(order.processedDate)}</span></div>
                )}
                {order.shippedDate && (
                  <div>Date Shipped: <span className="font-medium">{formatDate(order.shippedDate)}</span></div>
                )}
                {order.deliveryDate && (
                  <div>Date Delivered: <span className="font-medium">{formatDate(order.deliveryDate)}</span></div>
                )}
              </div>
              {order.notes && (
                <div className="bg-blue-900 bg-opacity-30 p-3 rounded-lg">
                  <p className="text-sm">{order.notes}</p>
                </div>
              )}
            </div>

            {/* Status History */}
            <div className="bg-[#19223a] rounded-2xl shadow-lg p-4">
              <div className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <span>Status History</span>
              </div>
              <div className="flex flex-col gap-4 pl-2 border-l-2 border-blue-900">
                {order.statusHistory && order.statusHistory.length > 0 ? (
                  order.statusHistory.map((entry, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="w-3 h-3 rounded-full bg-blue-400 mt-1" />
                      <div>
                        <div className="font-medium flex items-center gap-1">
                          {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                        </div>
                        <div className="text-xs text-[#93c5fd]">{formatDate(parseHistoryTimestamp(entry.timestamp))}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-[#93c5fd]">No status history yet.</div>
                )}
              </div>
            </div>

            {/* Order Items */}
            <div className="bg-[#19223a] rounded-2xl shadow-lg p-4">
              <div className="text-2xl font-semibold mb-4">Items ({orderItems.length})</div>
              <div className="space-y-4">
                {orderItems.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="flex items-start gap-4 p-4 border border-[#22304a] rounded-lg bg-[#101828]">
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium">{item.name}</h4>
                      <p className="text-sm mt-1">
                        Qty: {item.quantity}
                        {item.size ? ` - Size: ${typeof item.size === 'object' && item.size !== null && 'size' in item.size ? (item.size as any).size : item.size}` : ''}
                        {item.color ? ` - Color: ${typeof item.color === 'object' && item.color !== null && 'color' in item.color ? (item.color as any).color : item.color}` : ''}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm">Qty: {item.quantity}</span>
                        <span className="font-medium">
                          {formatCurrency(item.price)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Order Summary */}
            <div className="bg-[#19223a] rounded-2xl shadow-lg p-4">
              <div className="text-2xl font-semibold mb-4">Order Summary</div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(order.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span>{order.shipping === 0 ? 'Free' : formatCurrency(order.shipping)}</span>
                </div>
                {order.tax > 0 && (
                  <div className="flex justify-between">
                    <span>Tax</span>
                    <span>{formatCurrency(order.tax)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-medium text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(order.total)}</span>
                </div>
              </div>
            </div>

            {/* Payment Information */}
            <div className="bg-[#19223a] rounded-2xl shadow-lg p-4">
              <div className="text-2xl font-semibold mb-4">Payment Information</div>
              <div className="space-y-3">
                {order.status === 'returned/refunded' ? (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-red-100 text-red-800">Returned/Refunded</Badge>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      <span className="text-sm">{order.paymentMethod}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={order.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                        {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                      </Badge>
                    </div>
                  </>
                )}
                {/* Cancel Order button for all except cancelled/completed */}
                {canCustomerCancelOrder(order.status) && (
                  <Button
                    className="bg-red-600 hover:bg-red-700 text-white px-6 mt-4"
                    onClick={handleCancelOrder}
                  >
                    Cancel Order
                  </Button>
                )}
                {(order.status === 'delivered' || order.status === 'completed') && actionCompleted && (
                  <Button
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 mt-4"
                    onClick={() => {
                      if (order && order.items && order.items.length > 0) {
                        router.push(
                          `/products/${order.items[0].productId ?? order.items[0].id}`
                        );
                      } else {
                        router.push('/products'); // Fallback if no items
                      }
                    }}
                  >
                    Buy again
                  </Button>
                )}
                {order.status === 'delivered' && !orderReceived && !actionCompleted ? (
                  <div className="space-y-4 mt-4">
                    <Button
                      className="bg-green-600 hover:bg-green-700 text-white px-6"
                      onClick={handleOrderReceived}
                    >
                      Order Received
                    </Button>
                  </div>
                ) : order.status === 'delivered' && orderReceived && !actionCompleted ? (
                  <div className="flex flex-col gap-2 mt-4">
                    {/* Return/Refund button or form */}
                    {!showReturnForm ? (
                      <Button
                        className="bg-red-600 hover:bg-red-700 text-white px-6"
                        onClick={() => setShowReturnForm(true)}
                      >
                        Return / Refund
                      </Button>
                    ) : (
                      <form className="flex flex-col gap-2 w-full" onSubmit={e => {
                        e.preventDefault();
                        handleReturnRefundWithReason();
                      }}>
                        <textarea
                          className="w-full border border-gray-300 rounded p-2 mb-2 text-black"
                          rows={3}
                          value={returnReason}
                          onChange={e => setReturnReason(e.target.value)}
                          required
                          placeholder="Enter your reason here..."
                        />
                        <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-6">Submit</Button>
                        <Button type="button" variant="outline" className="px-6" onClick={() => setShowReturnForm(false)}>Cancel</Button>
                      </form>
                    )}
                    {/* Rating Section: Show Rate button first, then stars/feedback after click, always below Return/Refund */}
                    {!showRatingSection ? (
                      <Button
                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 mt-2"
                        onClick={() => setShowRatingSection(true)}
                      >
                        Rate
                      </Button>
                    ) : (
                      <>
                        <div className="flex items-center gap-1 mb-2 mt-4">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-6 w-6 cursor-pointer ${i < selectedRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400'}`}
                              onClick={() => setSelectedRating(i + 1)}
                            />
                          ))}
                        </div>
                        <textarea
                          className="w-full border border-gray-300 rounded p-2 mb-2 text-black"
                          rows={3}
                          value={feedback}
                          onChange={e => setFeedback(e.target.value)}
                          placeholder="Share your feedback..."
                        />
                        <Button
                          className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 mt-2"
                          onClick={() => handleRateOrder(selectedRating, feedback)}
                          disabled={selectedRating === 0}
                        >
                          Submit Rating
                        </Button>
                      </>
                    )}
                  </div>
                ) : null /* Render nothing for other statuses */}
              </div>
            </div>

            {/* Shipping Address */}
            <div className="bg-[#19223a] rounded-2xl shadow-lg p-4">
              <div className="text-2xl font-semibold mb-4">Shipping Address</div>
              <div className="space-y-2">
                <p className="font-medium">
                  {order?.shippingAddress?.firstName} {order?.shippingAddress?.lastName}
                </p>
                <p className="text-sm">{order?.shippingAddress?.address1}</p>
                {order?.shippingAddress?.address2 && (
                  <p className="text-sm">{order?.shippingAddress?.address2}</p>
                )}
                <p className="text-sm">
                  {order?.shippingAddress?.city}, {order?.shippingAddress?.region} {order?.shippingAddress?.postalCode}
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3 w-3" />
                  {order?.shippingAddress?.phone}
                </div>
              </div>
            </div>

            {/* Billing Address */}
            {order?.billingAddress && order?.shippingAddress && JSON.stringify(order.shippingAddress) !== JSON.stringify(order.billingAddress) && (
              <div className="bg-[#19223a] rounded-2xl shadow-lg p-4">
                <div className="text-2xl font-semibold mb-4">Billing Address</div>
                <div className="space-y-2">
                  <p className="font-medium">
                    {order?.billingAddress?.firstName} {order?.billingAddress?.lastName}
                  </p>
                  <p className="text-sm">{order?.billingAddress?.address1}</p>
                  {order?.billingAddress?.address2 && (
                    <p className="text-sm">{order?.billingAddress?.address2}</p>
                  )}
                  <p className="text-sm">
                    {order?.billingAddress?.city}, {order?.billingAddress?.region} {order?.billingAddress?.postalCode}
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3 w-3" />
                    {order?.billingAddress?.phone}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mb-4">
              <Button onClick={handleDownloadReceipt} variant="outline" size="sm" className="flex items-center gap-1">
                <Download className="w-4 h-4 mr-1" /> Download Receipt
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 