"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import {
  PERSONAL_GCASH_QR_PATH,
  PENDING_QRPH_ORDER_KEY,
  PENDING_GCASH_ORDER_KEY,
} from "@/lib/payment/personal-qr";
import type { PendingQrphOrder } from "@/lib/checkout/types";
import {
  completeCustomerOrder,
  saveOrderReceipt,
  type CheckoutAddress,
  type CheckoutOrderItem,
} from "@/lib/storefront/checkout";

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toCheckoutAddress(details: Record<string, unknown>): CheckoutAddress {
  return {
    firstName: str(details.firstName),
    lastName: str(details.lastName),
    address1: str(details.address1),
    address2: str(details.address2) || undefined,
    postalCode: str(details.postalCode),
    city: str(details.city),
    region: str(details.region),
    phone: str(details.phone),
    country: str(details.country, "Philippines"),
    email: str(details.email) || undefined,
  };
}

function loadPendingOrder(): PendingQrphOrder | null {
  if (typeof window === "undefined") return null;
  for (const key of [PENDING_QRPH_ORDER_KEY, PENDING_GCASH_ORDER_KEY]) {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      try {
        return JSON.parse(raw) as PendingQrphOrder;
      } catch {
        /* try next key */
      }
    }
  }
  return null;
}

/**
 * QR Ph checkout using your personal GCash QR (InstaPay).
 * Payment method saved as "qrph"; QR image is your static GCash code.
 */
export default function QrphPayPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { removeFromCartByIds } = useCart();
  const { toast } = useToast();

  const [order, setOrder] = useState<PendingQrphOrder | null>(null);
  const [paymentRef, setPaymentRef] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }
    const pending = loadPendingOrder();
    if (!pending) {
      router.replace("/checkout");
      return;
    }
    setOrder(pending);
  }, [user, router]);

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please upload an image screenshot of your payment.",
      });
      return;
    }
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
  };

  const uploadReceipt = async (reference: string): Promise<string | null> => {
    if (!receiptFile || !user) return null;
    const ext = receiptFile.name.split(".").pop() || "jpg";
    const path = `payment-receipts/${user.uid}/${reference}.${ext}`;
    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, receiptFile, { upsert: true, contentType: receiptFile.type });
    if (error) {
      console.error("Receipt upload failed:", error);
      return null;
    }
    return supabase.storage.from("product-images").getPublicUrl(path).data
      .publicUrl;
  };

  const handleConfirmPayment = async () => {
    if (!user || !order) return;

    const refTrimmed = paymentRef.trim();
    if (!refTrimmed && !receiptFile) {
      toast({
        title: "Proof required",
        description:
          "Enter your payment reference number or upload a screenshot.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      let receiptUrl: string | null = null;
      if (receiptFile) {
        receiptUrl = await uploadReceipt(order.reference);
      }

      const items = order.items;
      const subtotal = items.reduce((total, item) => {
        const price =
          typeof item.price === "string"
            ? parseFloat(item.price.replace(/[^\d.]/g, ""))
            : Number(item.price);
        return total + price * item.quantity;
      }, 0);

      const shippingOptions = [
        { value: "standard", price: 0 },
        { value: "express", price: 149 },
        { value: "sameDay", price: 299 },
      ];
      const shipping =
        shippingOptions.find((o) => o.value === order.shippingMethod)?.price ??
        0;

      const mappedItems: CheckoutOrderItem[] = items.map((item) => ({
        id: String(item.id),
        name: item.name,
        price:
          typeof item.price === "string"
            ? parseFloat(item.price.replace(/[^\d.]/g, ""))
            : Number(item.price),
        quantity: item.quantity,
        image: item.image,
        size: item.selectedSize,
        color: item.selectedColor || item.color || "N/A",
      }));

      if (mappedItems.length === 0) throw new Error("No product in order");

      const orderId = await completeCustomerOrder({
        orderNumber: order.reference,
        status: "pending",
        total: subtotal + shipping,
        subtotal,
        shipping,
        tax: 0,
        paymentMethod: "qrph",
        paymentStatus: "awaiting_confirmation",
        shippingAddress: toCheckoutAddress(order.deliveryDetails),
        billingAddress: toCheckoutAddress(order.billingDetails),
        items: mappedItems,
        userEmail: user.email ?? undefined,
        notes: JSON.stringify({
          paymentQrSource: "personal_gcash",
          paymentReference: refTrimmed || null,
          paymentReceiptUrl: receiptUrl,
          shippingMethod: order.shippingMethod,
        }),
      });

      await saveOrderReceipt(user.uid, orderId, order.reference, {
        paymentMethod: "qrph",
        paymentReference: refTrimmed || null,
        paymentReceiptUrl: receiptUrl,
        shippingMethod: order.shippingMethod,
      });

      sessionStorage.removeItem(PENDING_QRPH_ORDER_KEY);
      sessionStorage.removeItem(PENDING_GCASH_ORDER_KEY);
      removeFromCartByIds(order.selectedIds);

      toast({
        title: "Order placed",
        description: "We will verify your QR Ph payment shortly.",
        variant: "success",
      });
      router.push("/orders");
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Could not place order.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!order) {
    return (
      <div className="min-h-screen bg-[#101828] text-[#60A5FA] flex items-center justify-center">
        <p className="text-sm">Loading QR Ph payment...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101828] text-[#60A5FA] py-8 px-4 sm:px-6">
      <div className="max-w-lg mx-auto">
        <Link
          href="/checkout"
          className="text-sm text-[#93c5fd] hover:underline mb-6 inline-block"
        >
          ← Back to checkout
        </Link>

        <div className="bg-[#19223a] rounded-lg p-6 sm:p-8 shadow-md space-y-6">
          <div className="text-center space-y-2">
            <span className="inline-block text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded bg-[#60A5FA]/15 text-[#60A5FA] border border-[#60A5FA]/30">
              QR Ph · InstaPay
            </span>
            <h1 className="text-2xl font-bold">Pay with QR Ph</h1>
            <p className="text-sm text-[#93c5fd]">
              Scan my personal GCash QR below (QR Ph enabled). Works with GCash,
              Maya, and participating bank apps.
            </p>
          </div>

          <div className="text-center bg-[#101828] rounded-lg p-4 border border-[#60A5FA]/30">
            <p className="text-xs uppercase tracking-wide text-[#93c5fd] mb-1">
              Amount to send
            </p>
            <p className="text-3xl font-bold text-white">
              ₱{parseFloat(order.amount).toFixed(2)}
            </p>
            <p className="text-xs text-[#93c5fd] mt-2">
              Reference:{" "}
              <span className="font-mono text-[#60A5FA]">{order.reference}</span>
            </p>
            <p className="text-xs text-[#93c5fd] mt-1">
              Add this reference in the payment message if your app allows it.
            </p>
          </div>

          <div className="flex justify-center">
            <div className="bg-white rounded-xl p-3 shadow-lg ring-2 ring-[#60A5FA]/20">
              <Image
                src={PERSONAL_GCASH_QR_PATH}
                alt="Personal GCash QR Ph code"
                width={280}
                height={280}
                className="w-full max-w-[280px] h-auto rounded-lg"
                priority
              />
            </div>
          </div>

          <p className="text-xs text-center text-[#93c5fd]/90">
            This is the store owner&apos;s personal GCash QR (InstaPay / QR Ph).
          </p>

          <ol className="text-sm text-[#93c5fd] space-y-2 list-decimal list-inside">
            <li>Open GCash (or Maya / your bank app with QR Ph).</li>
            <li>Tap Scan QR and scan the code above.</li>
            <li>Send exactly ₱{parseFloat(order.amount).toFixed(2)}.</li>
            <li>Submit your reference or screenshot below.</li>
          </ol>

          <div className="space-y-4 pt-2 border-t border-[#60A5FA]/20">
            <div>
              <label
                htmlFor="payment-ref"
                className="block text-sm font-medium mb-1"
              >
                Payment reference no.
              </label>
              <input
                id="payment-ref"
                type="text"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="GCash / bank reference number"
                className="w-full border border-[#60A5FA] rounded-md p-2 bg-[#101828] text-[#60A5FA] text-sm"
                autoComplete="off"
              />
              <p className="text-xs text-[#93c5fd] mt-1">
                Required unless you upload a screenshot below.
              </p>
            </div>

            <div>
              <label
                htmlFor="receipt"
                className="block text-sm font-medium mb-1"
              >
                Payment screenshot
              </label>
              <input
                id="receipt"
                type="file"
                accept="image/*"
                onChange={handleReceiptChange}
                className="w-full text-sm text-[#93c5fd] file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-[#60A5FA] file:text-[#101828] file:font-medium"
              />
              {receiptPreview && (
                <img
                  src={receiptPreview}
                  alt="Receipt preview"
                  className="mt-3 max-h-40 rounded border border-[#60A5FA]/30 object-contain"
                />
              )}
            </div>
          </div>

          <Button
            className="w-full bg-[#60A5FA] text-[#101828] hover:bg-[#3380c0] min-h-[48px] font-semibold"
            onClick={handleConfirmPayment}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting order..." : "I've paid — place order"}
          </Button>

          <p className="text-xs text-center text-[#93c5fd]/80">
            Order stays pending until we confirm your QR Ph payment.
          </p>
        </div>
      </div>
    </div>
  );
}
