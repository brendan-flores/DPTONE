"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { CartItem } from "@/context/CartContext";
import { fetchUserAddresses, type UserAddress } from "@/lib/storefront/addresses";
import {
  completeCustomerOrder,
  type CheckoutAddress,
  type CheckoutOrderItem,
} from "@/lib/storefront/checkout";
import {
  PENDING_QRPH_ORDER_KEY,
  PERSONAL_GCASH_QR_PATH,
} from "@/lib/payment/personal-qr";
import type {
  PaymentMethod,
  CheckoutProcessingState,
  PendingQrphOrder,
} from "@/lib/checkout/types";
import { CheckoutSubmitButton } from "@/components/checkout/CheckoutSubmitButton";

function toCheckoutAddress(
  details: {
    firstName: string;
    lastName: string;
    address1: string;
    address2?: string;
    postalCode: string;
    city: string;
    region: string;
    phone: string;
    country?: string;
    email?: string;
  }
): CheckoutAddress {
  return {
    firstName: details.firstName,
    lastName: details.lastName,
    address1: details.address1,
    address2: details.address2 || undefined,
    postalCode: details.postalCode,
    city: details.city,
    region: details.region,
    phone: details.phone,
    country: details.country || "Philippines",
    email: details.email,
  };
}

function buildOrderItems(
  items: CartItem[],
  allCartItems: CartItem[]
): CheckoutOrderItem[] {
  return items.map((item) => {
    let color = item.selectedColor || item.color;
    if (!color && item.id) {
      const product = allCartItems.find((p) => p.id === item.id) || item;
      if (product?.color && typeof product.color === "string") {
        const colorOptions = product.color
          .split(",")
          .map((c: string) => c.trim())
          .filter(Boolean);
        if (colorOptions.length === 1) color = colorOptions[0];
      }
    }
    return {
      id: String(item.id),
      name: item.name,
      price:
        typeof item.price === "string"
          ? parseFloat(item.price.replace(/[^\d.]/g, ""))
          : Number(item.price),
      quantity: item.quantity,
      image: item.image,
      size: item.selectedSize,
      color: color || "N/A",
    };
  });
}

// Helper function for Philippine phone validation
function isValidPHPhone(phone: string) {
  // Accepts only +639XXXXXXXXX
  return /^\+639\d{9}$/.test(phone);
}

// Add this helper to get error message for a field
function getFieldError(field: string, value: string, isPhone: boolean = false) {
  if (!value || (isPhone && !isValidPHPhone(value))) {
    if (isPhone && value && !isValidPHPhone(value)) {
      return 'Please enter a valid Philippine phone number (e.g. +639XXXXXXXXX).';
    }
    switch (field) {
      case 'firstName': return 'First name is required.';
      case 'lastName': return 'Last name is required.';
      case 'address1': return 'Address is required.';
      case 'city': return 'City is required.';
      case 'postalCode': return 'Postal code is required.';
      case 'phone': return 'Phone number is required.';
      default: return 'This field is required.';
    }
  }
  return '';
}

export default function CheckoutPage() {
  const { user } = useAuth();
  const { cartItems, calculateTotal, clearCart, removeFromCartByIds } = useCart();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  // Get selected item IDs from query string (treat as strings)
  const selectedIdsParam = searchParams.get('selected');
  const buyNowParam = searchParams.get('buyNow');

  // Revert to original selectedCartItems logic (not in useEffect/useState)
  function getCartItemKey(item: CartItem) {
    return item.selectedSize ? `${item.id}-${item.selectedSize}` : String(item.id);
  }
  let selectedCartItems: CartItem[] = [];
  if (buyNowParam === '1') {
    // Load buy now item from localStorage
    if (typeof window !== 'undefined') {
      const buyNowItemRaw = localStorage.getItem('pendingBuyNowItem');
      if (buyNowItemRaw) {
        try {
          const buyNowItem = JSON.parse(buyNowItemRaw);
          selectedCartItems = [buyNowItem];
        } catch (e) {
          selectedCartItems = [];
        }
      }
    }
  } else {
    const selectedIds = selectedIdsParam ? selectedIdsParam.split(',') : cartItems.map(getCartItemKey);
    selectedCartItems = cartItems.filter(item => selectedIds.includes(getCartItemKey(item)));
    if (selectedCartItems.length === 0 && cartItems.length > 0) {
      selectedCartItems = cartItems;
    }
  }

  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  /** Drives checkout button spinner: idle | cod | qrph */
  const [checkoutProcessing, setCheckoutProcessing] =
    useState<CheckoutProcessingState>("idle");
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const isCheckoutBusy = checkoutProcessing !== "idle";

  const [deliveryDetails, setDeliveryDetails] = useState({
    firstName: user?.displayName?.split(" ")[0] || "",
    lastName: user?.displayName?.split(" ").slice(1).join(" ") || "",
    address1: "",
    address2: "",
    postalCode: "",
    city: "",
    region: "Cebu", // Default to Cebu as per image, can be dynamic
    phone: user?.phoneNumber || "+63",
    email: user?.email || "",
    emailOffers: false,
  });

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("qrph");
  const [sameAsShipping, setSameAsShipping] = useState(true);

  const [billingDetails, setBillingDetails] = useState({
    firstName: "",
    lastName: "",
    address1: "",
    address2: "",
    postalCode: "",
    city: "",
    region: "Cebu",
    country: "Philippines",
    phone: "+63",
  });

  const [shippingMethod, setShippingMethod] = useState('standard');
  const shippingOptions = [
    { value: 'standard', label: 'Standard Shipping', time: '3–5 business days', price: 0 },
    { value: 'express', label: 'Express Shipping', time: '1–2 business days', price: 149 },
    { value: 'sameDay', label: 'Same Day Delivery', time: 'Same day', price: 299 },
  ];

  const getShippingPrice = () => {
    const selected = shippingOptions.find(opt => opt.value === shippingMethod);
    return selected ? selected.price : 0;
  };

  useEffect(() => {
    const loadAddresses = async () => {
      if (!user) return;
      try {
        const fetchedAddresses = await fetchUserAddresses(user.uid);
        setAddresses(fetchedAddresses);
        const defaultAddr =
          fetchedAddresses.find((addr) => addr.isDefault) || fetchedAddresses[0];
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id);
          setDeliveryDetails((prev) => ({
            ...prev,
            firstName: defaultAddr.firstName,
            lastName: defaultAddr.lastName,
            address1: defaultAddr.address1,
            address2: defaultAddr.address2 || "",
            postalCode: defaultAddr.postalCode,
            city: defaultAddr.city,
            region: defaultAddr.region,
            phone: defaultAddr.phone,
          }));
        }
      } catch (err) {
        console.error("Failed to load addresses:", err);
      }
    };
    loadAddresses();
  }, [user]);

  // Update delivery details if user changes
  useEffect(() => {
    if (user) {
      setDeliveryDetails((prev) => ({
        ...prev,
        firstName: user.displayName?.split(" ")[0] || prev.firstName,
        lastName: user.displayName?.split(" ").slice(1).join(" ") || prev.lastName,
        phone: user.phoneNumber || prev.phone,
        email: user.email || prev.email,
      }));
    }
  }, [user]);

  useEffect(() => {
    if (searchParams.get("payment") === "cancelled") {
      toast({
        title: "Payment cancelled",
        description: "Your online payment was not completed. You can try again.",
      });
    }
  }, [searchParams, toast]);

  // Add a useEffect to keep billingDetails in sync if sameAsShipping is true
  useEffect(() => {
    if (sameAsShipping) {
      setBillingDetails({
        ...deliveryDetails,
        country: 'Philippines',
      });
    }
    // Do not clear billingDetails if unchecked, to preserve user input
  }, [sameAsShipping, deliveryDetails]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const inputValue = type === "checkbox" ? (e.target as HTMLInputElement).checked : value;
    setDeliveryDetails((prev) => ({
      ...prev,
      [name]: inputValue,
    }));
  };

  const handleBillingInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setBillingDetails((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const saveOrder = async (
    billingDetailsArg?: typeof billingDetails,
    orderNumber?: string
  ): Promise<string | undefined> => {
    if (!user) {
      toast({
        title: "Error",
        description: "Please log in to place an order",
      });
      return;
    }

    try {
      const items = buildOrderItems(selectedCartItems, cartItems);
      if (items.length === 0) throw new Error("No items in order");

      const subtotal = items.reduce(
        (total, item) => total + item.price * item.quantity,
        0
      );
      const shipping = getShippingPrice();
      const billing = billingDetailsArg ?? {
        ...deliveryDetails,
        country: "Philippines",
      };

      const orderId = await completeCustomerOrder({
        orderNumber: orderNumber ?? `ORD-${Date.now()}`,
        status: "pending",
        total: subtotal + shipping,
        subtotal,
        shipping,
        tax: 0,
        paymentMethod,
        paymentStatus: "pending",
        shippingAddress: toCheckoutAddress(deliveryDetails),
        billingAddress: toCheckoutAddress(billing),
        items,
        userEmail: user.email ?? undefined,
        notes: JSON.stringify({ shippingMethod }),
      });

      toast({
        title: "Successfully ordered.",
        description: "Thank you for purchasing with DPT ONE.",
        variant: "success",
      });
      return orderId;
    } catch (error) {
      toast({
        title: "Error",
        description:
          "Error saving order: " +
          (error instanceof Error ? error.message : String(error)),
      });
      console.error("Error saving order:", error);
      throw error;
    }
  };

  // Order totals (used by both COD and QR Ph flows)
  const calculateSelectedTotal = (): string => {
    return selectedCartItems
      .reduce((total, item) => {
        const price =
          typeof item.price === "string"
            ? parseFloat(item.price.replace(/[^\d.]/g, ""))
            : Number(item.price);
        return total + price * item.quantity;
      }, 0)
      .toFixed(2);
  };
  const totalAmount = (
    parseFloat(calculateSelectedTotal()) + getShippingPrice()
  ).toFixed(2);
  const totalAmountPhp = parseFloat(totalAmount);

  /** Validates delivery/billing before COD or online (QR Ph) checkout */
  const validateCheckoutForm = (): boolean => {
    const requiredDeliveryFields = [
      "firstName",
      "lastName",
      "address1",
      "city",
      "postalCode",
      "phone",
    ] as const;
    const missingDelivery = requiredDeliveryFields.filter(
      (field) => !deliveryDetails[field]
    );

    let missingBilling: string[] = [];
    if (!sameAsShipping) {
      const requiredBillingFields = [
        "lastName",
        "address1",
        "city",
        "postalCode",
        "phone",
      ] as const;
      missingBilling = requiredBillingFields.filter(
        (field) => !billingDetails[field]
      );
    }

    const deliveryPhoneInvalid = !isValidPHPhone(deliveryDetails.phone || "");
    const billingPhoneInvalid =
      !sameAsShipping && !isValidPHPhone(billingDetails.phone || "");

    if (
      missingDelivery.length > 0 ||
      missingBilling.length > 0 ||
      deliveryPhoneInvalid ||
      billingPhoneInvalid
    ) {
      setShowFieldErrors(true);
      let errorMsg = "Please fill in all required fields in the form.";
      if (deliveryPhoneInvalid || billingPhoneInvalid) {
        errorMsg =
          "Please enter a valid Philippine phone number (e.g. +639XXXXXXXXX).";
      }
      toast({ title: "Error", description: errorMsg });
      return false;
    }

    setShowFieldErrors(false);
    return true;
  };

  /**
   * COD: save order to Supabase, clear cart, go to orders page.
   */
  const handleCodCheckout = async (): Promise<void> => {
    const billingToSend = sameAsShipping
      ? { ...deliveryDetails, country: "Philippines" }
      : billingDetails;

    setCheckoutProcessing("cod");
    try {
      const orderId = await saveOrder(billingToSend);
      if (orderId) {
        removeFromCartByIds(selectedCartItems.map((item) => item.id));
        router.push("/orders");
      } else {
        toast({
          title: "Error",
          description: "Order was not saved. Please try again.",
        });
      }
    } finally {
      setCheckoutProcessing("idle");
    }
  };

  /**
   * QR Ph flow with your personal GCash QR (not PayMongo hosted QR).
   * Saves order draft → /checkout/qrph-pay to scan and upload proof.
   */
  const handleQrphCheckout = async (): Promise<void> => {
    const orderReference = `ORD-${Date.now()}`;
    const billingToSend = sameAsShipping
      ? { ...deliveryDetails, country: "Philippines" }
      : billingDetails;

    const pendingOrder: PendingQrphOrder = {
      reference: orderReference,
      deliveryDetails,
      billingDetails: billingToSend,
      shippingMethod,
      items: selectedCartItems,
      selectedIds: selectedCartItems.map((item) => item.id),
      amount: totalAmount,
      buyNow: buyNowParam === "1",
    };

    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        PENDING_QRPH_ORDER_KEY,
        JSON.stringify(pendingOrder)
      );
    }

    setCheckoutProcessing("qrph");
    router.push("/checkout/qrph-pay");
    setCheckoutProcessing("idle");
  };

  /**
   * Main checkout handler — branches on payment method (COD vs QR Ph).
   */
  const handleProceedToPayment = async (): Promise<void> => {
    if (!user) {
      toast({
        title: "Error",
        description: "Please log in to place an order",
      });
      return;
    }

    if (selectedCartItems.length === 0) {
      toast({ title: "Error", description: "Your cart is empty" });
      return;
    }

    if (!validateCheckoutForm()) {
      return;
    }

    try {
      if (paymentMethod === "cod") {
        await handleCodCheckout();
      } else {
        await handleQrphCheckout();
      }
    } catch (error) {
      setCheckoutProcessing("idle");
      toast({
        title: "Error",
        description:
          "Error processing order: " +
          (error instanceof Error ? error.message : String(error)),
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#101828] text-[#60A5FA] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Delivery and Payment */}
        <div className="bg-[#19223a] p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold mb-6 text-[#60A5FA]">Checkout</h1>

          {/* Account Section */}
          <div className="mb-8 pb-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-[#60A5FA] mb-4">Account</h2>
            <div className="flex items-center space-x-2 mb-4">
              <span className="font-medium text-[#60A5FA]">{deliveryDetails.email}</span>
            </div>
          </div>

          {/* Address Selector */}
          {addresses.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-[#60A5FA]">Select Address</label>
              <select
                className="mt-1 block w-full border border-[#60A5FA] rounded-md shadow-sm p-2 focus:ring-[#60A5FA] focus:border-[#60A5FA] sm:text-sm bg-[#101828] text-[#60A5FA]"
                value={selectedAddressId || ""}
                onChange={e => {
                  setSelectedAddressId(e.target.value);
                  const addr = addresses.find(a => a.id === e.target.value);
                  if (addr) {
                    setDeliveryDetails(prev => ({
                      ...prev,
                      firstName: addr.firstName,
                      lastName: addr.lastName,
                      address1: addr.address1,
                      address2: addr.address2 || "",
                      postalCode: addr.postalCode,
                      city: addr.city,
                      region: addr.region,
                      phone: addr.phone,
                    }));
                  }
                }}
              >
                {addresses.map(addr => (
                  <option key={addr.id} value={addr.id}>
                    {addr.isDefault ? "[Default] " : ""}
                    {addr.address1}, {addr.city}, {addr.region}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Delivery Section */}
          <div className="mb-8 pb-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-[#60A5FA] mb-4">Delivery</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-[#60A5FA]">First name</label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  className={`mt-1 block w-full border ${showFieldErrors && !deliveryDetails.firstName ? 'border-red-500' : 'border-[#60A5FA]'} rounded-md shadow-sm p-2 focus:ring-[#60A5FA] focus:border-[#60A5FA] sm:text-sm bg-[#101828] text-[#60A5FA]`}
                  value={deliveryDetails.firstName}
                  onChange={handleInputChange}
                  required
                  autoComplete="off"
                />
                {showFieldErrors && getFieldError('firstName', deliveryDetails.firstName) && (
                  <p className="text-red-500 text-xs mt-1">{getFieldError('firstName', deliveryDetails.firstName)}</p>
                )}
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-[#60A5FA]">Last name</label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  className={`mt-1 block w-full border ${showFieldErrors && !deliveryDetails.lastName ? 'border-red-500' : 'border-[#60A5FA]'} rounded-md shadow-sm p-2 focus:ring-[#60A5FA] focus:border-[#60A5FA] sm:text-sm bg-[#101828] text-[#60A5FA]`}
                  value={deliveryDetails.lastName}
                  onChange={handleInputChange}
                  required
                  autoComplete="off"
                />
                {showFieldErrors && getFieldError('lastName', deliveryDetails.lastName) && (
                  <p className="text-red-500 text-xs mt-1">{getFieldError('lastName', deliveryDetails.lastName)}</p>
                )}
              </div>
            </div>
            <div className="mb-4">
              <label htmlFor="address1" className="block text-sm font-medium text-[#60A5FA]">Address (Please do not forget to include your Barangay)</label>
              <input
                type="text"
                id="address1"
                name="address1"
                className={`mt-1 block w-full border ${showFieldErrors && !deliveryDetails.address1 ? 'border-red-500' : 'border-[#60A5FA]'} rounded-md shadow-sm p-2 focus:ring-[#60A5FA] focus:border-[#60A5FA] sm:text-sm bg-[#101828] text-[#60A5FA]`}
                value={deliveryDetails.address1}
                onChange={handleInputChange}
                required
                autoComplete="off"
              />
              {showFieldErrors && getFieldError('address1', deliveryDetails.address1) && (
                <p className="text-red-500 text-xs mt-1">{getFieldError('address1', deliveryDetails.address1)}</p>
              )}
            </div>
            <div className="mb-4">
              <label htmlFor="address2" className="block text-sm font-medium text-[#60A5FA]">Apartment, suite, etc. (optional)</label>
              <input
                type="text"
                id="address2"
                name="address2"
                className={`mt-1 block w-full border ${showFieldErrors && !deliveryDetails.address2 ? 'border-red-500' : 'border-[#60A5FA]'} rounded-md shadow-sm p-2 focus:ring-[#60A5FA] focus:border-[#60A5FA] sm:text-sm bg-[#101828] text-[#60A5FA]`}
                value={deliveryDetails.address2}
                onChange={handleInputChange}
                autoComplete="off"
              />
              {showFieldErrors && getFieldError('address2', deliveryDetails.address2) && (
                <p className="text-red-500 text-xs mt-1">{getFieldError('address2', deliveryDetails.address2)}</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="postalCode" className="block text-sm font-medium text-[#60A5FA]">Postal code</label>
                <input
                  type="text"
                  id="postalCode"
                  name="postalCode"
                  className={`mt-1 block w-full border ${showFieldErrors && !deliveryDetails.postalCode ? 'border-red-500' : 'border-[#60A5FA]'} rounded-md shadow-sm p-2 focus:ring-[#60A5FA] focus:border-[#60A5FA] sm:text-sm bg-[#101828] text-[#60A5FA]`}
                  value={deliveryDetails.postalCode}
                  onChange={handleInputChange}
                  required
                  autoComplete="off"
                />
                {showFieldErrors && getFieldError('postalCode', deliveryDetails.postalCode) && (
                  <p className="text-red-500 text-xs mt-1">{getFieldError('postalCode', deliveryDetails.postalCode)}</p>
                )}
              </div>
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-[#60A5FA]">City</label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  className={`mt-1 block w-full border ${showFieldErrors && !deliveryDetails.city ? 'border-red-500' : 'border-[#60A5FA]'} rounded-md shadow-sm p-2 focus:ring-[#60A5FA] focus:border-[#60A5FA] sm:text-sm bg-[#101828] text-[#60A5FA]`}
                  value={deliveryDetails.city}
                  onChange={handleInputChange}
                  required
                  autoComplete="off"
                />
                {showFieldErrors && getFieldError('city', deliveryDetails.city) && (
                  <p className="text-red-500 text-xs mt-1">{getFieldError('city', deliveryDetails.city)}</p>
                )}
              </div>
            </div>
            <div className="mb-4">
              <label htmlFor="region" className="block text-sm font-medium text-[#60A5FA]">Region</label>
              <Select value={deliveryDetails.region} onValueChange={value => setDeliveryDetails(prev => ({ ...prev, region: value }))}>
                <SelectTrigger className="mt-1 block w-full border border-[#60A5FA] rounded-md shadow-sm px-4 py-2 h-12 flex items-center justify-between text-base bg-[#101828] text-[#60A5FA] focus:outline-none focus:ring-2 focus:ring-[#60A5FA] focus:border-[#60A5FA]">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cebu">Cebu</SelectItem>
                  {/* Add more regions as needed */}
                </SelectContent>
              </Select>
            </div>
            <div className="mb-4">
              <label htmlFor="phone" className="block text-sm font-medium text-[#60A5FA]">Phone</label>
              <input
                type="text"
                id="phone"
                name="phone"
                className={`mt-1 block w-full border ${(showFieldErrors && (!deliveryDetails.phone || !isValidPHPhone(deliveryDetails.phone))) ? 'border-red-500' : 'border-[#60A5FA]'} rounded-md shadow-sm p-2 focus:ring-[#60A5FA] focus:border-[#60A5FA] sm:text-sm bg-[#101828] text-[#60A5FA]`}
                value={deliveryDetails.phone}
                onChange={handleInputChange}
                required
                autoComplete="off"
              />
              {showFieldErrors && getFieldError('phone', deliveryDetails.phone, true) && (
                <p className="text-red-500 text-xs mt-1">{getFieldError('phone', deliveryDetails.phone, true)}</p>
              )}
            </div>
          </div>

          {/* Shipping Method Section */}
          <div className="mb-8 pb-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-[#60A5FA] mb-4">Shipping method</h2>
            <RadioGroup value={shippingMethod} onValueChange={setShippingMethod} className="space-y-2">
              {shippingOptions.map(option => (
                <label key={option.value} className="flex items-center cursor-pointer">
                  <RadioGroupItem value={option.value} id={`shipping-${option.value}`} className="accent-[#60A5FA] focus:ring-[#60A5FA] border-[#60A5FA]" />
                  <span className="ml-2">{option.label} ({option.time}) — ₱{option.price.toFixed(2)}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Payment Section */}
          <div className="mb-8 pb-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-[#60A5FA] mb-4">Payment</h2>
            <p className="text-[#60A5FA] mb-2">All transactions are secure and encrypted.</p>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
              className="space-y-3"
              disabled={isCheckoutBusy}
            >
              <label className="flex items-center cursor-pointer rounded-md border border-transparent hover:border-[#60A5FA]/30 p-2 transition-colors">
                <RadioGroupItem value="qrph" id="payment-qrph" className="accent-[#60A5FA] focus:ring-[#60A5FA] border-[#60A5FA]" />
                <span className="ml-2 flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 text-sm sm:text-base">
                  <span className="font-medium">QR Ph (GCash / Maya / Banks)</span>
                  <span className="text-xs text-[#93c5fd]">
                    My personal GCash QR
                  </span>
                </span>
              </label>
              <label className="flex items-center cursor-pointer rounded-md border border-transparent hover:border-[#60A5FA]/30 p-2 transition-colors">
                <RadioGroupItem value="cod" id="payment-cod" className="accent-[#60A5FA] focus:ring-[#60A5FA] border-[#60A5FA]" />
                <span className="ml-2 text-sm sm:text-base">Cash on delivery (COD)</span>
              </label>
            </RadioGroup>
            {paymentMethod === "qrph" && (
              <div className="mt-4 flex flex-col sm:flex-row items-center gap-4 p-4 rounded-lg bg-[#101828] border border-[#60A5FA]/20">
                <div className="bg-white rounded-lg p-2 shrink-0">
                  <Image
                    src={PERSONAL_GCASH_QR_PATH}
                    alt="Personal QR Ph / GCash QR preview"
                    width={96}
                    height={96}
                    className="w-24 h-24 object-contain"
                  />
                </div>
                <p className="text-xs sm:text-sm text-[#93c5fd]/90 leading-relaxed text-center sm:text-left">
                  QR Ph payment using my personal GCash QR. After checkout,
                  scan the code, pay the exact total, then submit your reference
                  or screenshot.
                </p>
              </div>
            )}
          </div>

          {/* Billing Address */}
          <h2 className="text-xl font-semibold text-[#60A5FA] mb-4">Billing address</h2>
          <RadioGroup value={sameAsShipping ? "same" : "different"} onValueChange={v => setSameAsShipping(v === "same")} className="space-y-2">
            <label className="flex items-center cursor-pointer">
              <RadioGroupItem value="same" id="billing-same" className="accent-[#60A5FA] focus:ring-[#60A5FA] border-[#60A5FA]" />
              <span className="ml-3 block text-sm font-medium text-[#60A5FA]">Same as shipping address</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <RadioGroupItem value="different" id="billing-different" className="accent-[#60A5FA] focus:ring-[#60A5FA] border-[#60A5FA]" />
              <span className="ml-3 block text-sm font-medium text-[#60A5FA]">Use a different billing address</span>
            </label>
          </RadioGroup>
          {!sameAsShipping && (
            <div className="mt-4 p-4 border border-[#60A5FA] rounded-md bg-[#101828]">
              <div className="mb-4">
                <label htmlFor="savedAddresses" className="block text-sm font-medium text-[#60A5FA]">Saved addresses</label>
                <Select value={selectedAddressId || undefined} onValueChange={value => {
                  setSelectedAddressId(value);
                  const addr = addresses.find(a => a.id === value);
                  if (addr) {
                    setBillingDetails({
                      firstName: addr.firstName,
                      lastName: addr.lastName,
                      address1: addr.address1,
                      address2: addr.address2 || "",
                      postalCode: addr.postalCode,
                      city: addr.city,
                      region: addr.region,
                      country: addr.country || "Philippines",
                      phone: addr.phone,
                    });
                  }
                }}>
                  <SelectTrigger className="mt-1 block w-full border border-[#60A5FA] rounded-md shadow-sm px-4 py-2 h-12 flex items-center justify-between text-base bg-[#101828] text-[#60A5FA] focus:outline-none focus:ring-2 focus:ring-[#60A5FA] focus:border-[#60A5FA]">
                    <SelectValue placeholder="Select a saved address" />
                  </SelectTrigger>
                  <SelectContent>
                    {addresses.map(addr => (
                      <SelectItem key={addr.id} value={addr.id}>
                        {addr.address1}, {addr.city}, {addr.region}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mb-4">
                <label htmlFor="countryBilling" className="block text-sm font-medium text-[#60A5FA]">Country/Region</label>
                <Select value={billingDetails.country} onValueChange={value => setBillingDetails(prev => ({ ...prev, country: value }))}>
                  <SelectTrigger className="mt-1 block w-full border border-[#60A5FA] rounded-md shadow-sm px-4 py-2 h-12 flex items-center justify-between text-base bg-[#101828] text-[#60A5FA] focus:outline-none focus:ring-2 focus:ring-[#60A5FA] focus:border-[#60A5FA]">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Philippines">Philippines</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="firstNameBilling" className="block text-sm font-medium text-[#60A5FA]">First name (optional)</label>
                  <input
                    type="text"
                    id="firstNameBilling"
                    name="firstName"
                    className={`mt-1 block w-full border ${showFieldErrors && !billingDetails.firstName ? 'border-red-500' : 'border-[#60A5FA]'} rounded-md shadow-sm p-2 focus:ring-[#60A5FA] focus:border-[#60A5FA] sm:text-sm bg-[#101828] text-[#60A5FA]`}
                    value={billingDetails.firstName}
                    onChange={handleBillingInputChange}
                    autoComplete="off"
                  />
                  {showFieldErrors && getFieldError('firstName', billingDetails.firstName) && (
                    <p className="text-red-500 text-xs mt-1">{getFieldError('firstName', billingDetails.firstName)}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="lastNameBilling" className="block text-sm font-medium text-[#60A5FA]">Last name</label>
                  <input
                    type="text"
                    id="lastNameBilling"
                    name="lastName"
                    className={`mt-1 block w-full border ${showFieldErrors && !billingDetails.lastName ? 'border-red-500' : 'border-[#60A5FA]'} rounded-md shadow-sm p-2 focus:ring-[#60A5FA] focus:border-[#60A5FA] sm:text-sm bg-[#101828] text-[#60A5FA]`}
                    value={billingDetails.lastName}
                    onChange={handleBillingInputChange}
                    required
                    autoComplete="off"
                  />
                  {showFieldErrors && getFieldError('lastName', billingDetails.lastName) && (
                    <p className="text-red-500 text-xs mt-1">{getFieldError('lastName', billingDetails.lastName)}</p>
                  )}
                </div>
              </div>
              <div className="mb-4">
                <label htmlFor="address1Billing" className="block text-sm font-medium text-[#60A5FA]">Address</label>
                <input
                  type="text"
                  id="address1Billing"
                  name="address1"
                  className={`mt-1 block w-full border ${showFieldErrors && !billingDetails.address1 ? 'border-red-500' : 'border-[#60A5FA]'} rounded-md shadow-sm p-2 focus:ring-[#60A5FA] focus:border-[#60A5FA] sm:text-sm bg-[#101828] text-[#60A5FA]`}
                  value={billingDetails.address1}
                  onChange={handleBillingInputChange}
                  required
                  autoComplete="off"
                />
                {showFieldErrors && getFieldError('address1', billingDetails.address1) && (
                  <p className="text-red-500 text-xs mt-1">{getFieldError('address1', billingDetails.address1)}</p>
                )}
              </div>
              <div className="mb-4">
                <label htmlFor="address2Billing" className="block text-sm font-medium text-[#60A5FA]">Apartment, suite, etc. (optional)</label>
                <input
                  type="text"
                  id="address2Billing"
                  name="address2"
                  className={`mt-1 block w-full border ${showFieldErrors && !billingDetails.address2 ? 'border-red-500' : 'border-[#60A5FA]'} rounded-md shadow-sm p-2 focus:ring-[#60A5FA] focus:border-[#60A5FA] sm:text-sm bg-[#101828] text-[#60A5FA]`}
                  value={billingDetails.address2}
                  onChange={handleBillingInputChange}
                  autoComplete="off"
                />
                {showFieldErrors && getFieldError('address2', billingDetails.address2) && (
                  <p className="text-red-500 text-xs mt-1">{getFieldError('address2', billingDetails.address2)}</p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="postalCodeBilling" className="block text-sm font-medium text-[#60A5FA]">Postal code</label>
                  <input
                    type="text"
                    id="postalCodeBilling"
                    name="postalCode"
                    className={`mt-1 block w-full border ${showFieldErrors && !billingDetails.postalCode ? 'border-red-500' : 'border-[#60A5FA]'} rounded-md shadow-sm p-2 focus:ring-[#60A5FA] focus:border-[#60A5FA] sm:text-sm bg-[#101828] text-[#60A5FA]`}
                    value={billingDetails.postalCode}
                    onChange={handleBillingInputChange}
                    required
                    autoComplete="off"
                  />
                  {showFieldErrors && getFieldError('postalCode', billingDetails.postalCode) && (
                    <p className="text-red-500 text-xs mt-1">{getFieldError('postalCode', billingDetails.postalCode)}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="cityBilling" className="block text-sm font-medium text-[#60A5FA]">City</label>
                  <input
                    type="text"
                    id="cityBilling"
                    name="city"
                    className={`mt-1 block w-full border ${showFieldErrors && !billingDetails.city ? 'border-red-500' : 'border-[#60A5FA]'} rounded-md shadow-sm p-2 focus:ring-[#60A5FA] focus:border-[#60A5FA] sm:text-sm bg-[#101828] text-[#60A5FA]`}
                    value={billingDetails.city}
                    onChange={handleBillingInputChange}
                    required
                    autoComplete="off"
                  />
                  {showFieldErrors && getFieldError('city', billingDetails.city) && (
                    <p className="text-red-500 text-xs mt-1">{getFieldError('city', billingDetails.city)}</p>
                  )}
                </div>
              </div>
              <div className="mb-4">
                <label htmlFor="regionBilling" className="block text-sm font-medium text-[#60A5FA]">Region</label>
                <Select value={billingDetails.region} onValueChange={value => setBillingDetails(prev => ({ ...prev, region: value }))}>
                  <SelectTrigger className="mt-1 block w-full border border-[#60A5FA] rounded-md shadow-sm px-4 py-2 h-12 flex items-center justify-between text-base bg-[#101828] text-[#60A5FA] focus:outline-none focus:ring-2 focus:ring-[#60A5FA] focus:border-[#60A5FA]">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cebu">Cebu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="mb-4">
                <label htmlFor="phoneBilling" className="block text-sm font-medium text-[#60A5FA]">Phone</label>
                <input
                  type="text"
                  id="phoneBilling"
                  name="phone"
                  className={`mt-1 block w-full border ${(showFieldErrors && (!billingDetails.phone || !isValidPHPhone(billingDetails.phone))) ? 'border-red-500' : 'border-[#60A5FA]'} rounded-md shadow-sm p-2 focus:ring-[#60A5FA] focus:border-[#60A5FA] sm:text-sm bg-[#101828] text-[#60A5FA]`}
                  value={billingDetails.phone}
                  onChange={handleBillingInputChange}
                  required
                  autoComplete="off"
                />
                {showFieldErrors && getFieldError('phone', billingDetails.phone, true) && (
                  <p className="text-red-500 text-xs mt-1">{getFieldError('phone', billingDetails.phone, true)}</p>
                )}
              </div>
            </div>
          )}

          {/* Checkout CTA — spinner + disabled while COD or QR Ph is processing */}
          <CheckoutSubmitButton
            paymentMethod={paymentMethod}
            processingState={checkoutProcessing}
            onClick={handleProceedToPayment}
            disabled={selectedCartItems.length === 0}
          />
        </div>

        {/* Right Column: Order Summary */}
        <div className="bg-[#19223a] p-8 rounded-lg shadow-md sticky top-8 h-fit">
          <h2 className="text-xl font-bold text-[#60A5FA] mb-4">Your order</h2>
          {selectedCartItems.length === 0 ? (
            <p className="text-[#60A5FA]">Your cart is empty.</p>
          ) : (
            <>
              <div className="space-y-4 mb-6">
                
                {selectedCartItems.map((item) => (
                  <div key={typeof item.id === 'string' ? `${item.id}-${item.selectedSize || ''}` : String(item.id) + '-' + String(item.selectedSize || '')} className="flex items-center space-x-4">
                    <div className="relative w-24 h-24 flex-shrink-0 rounded-md overflow-hidden border border-gray-200 bg-white flex items-center justify-center">
                      {item.image ? (
                        <Image src={item.image} alt={item.name} width={96} height={96} className="object-cover mx-auto" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                      ) : (
                        <div className="w-24 h-24 flex items-center justify-center bg-[#19223a] text-[#60A5FA] text-xs">No Image</div>
                      )}
                      <span className="absolute -top-2 -right-2 bg-black text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex-grow">
                      <h3 className="text-lg font-semibold text-[#60A5FA]">{item.name}</h3>
                      {item.selectedSize && (
                        <p className="text-sm text-[#60A5FA]">
                          Size: {typeof item.selectedSize === 'object' && item.selectedSize !== null && 'size' in item.selectedSize
                            ? (item.selectedSize as any).size
                            : item.selectedSize}
                        </p>
                      )}
                      {item.selectedColor && (
                        <p className="text-sm text-[#60A5FA]">
                          Color: {item.selectedColor}
                        </p>
                      )}
                    </div>
                    <p className="text-md font-medium text-[#60A5FA]">
                      ₱{
                        ((typeof item.price === "string"
                          ? parseFloat(item.price.replace(/[^\d.]/g, ''))
                          : item.price) * item.quantity
                        ).toFixed(2)
                      }
                    </p>
                  </div>
                ))}
              </div>
              <div className="space-y-2 text-[#60A5FA] pt-4 border-t border-gray-200">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>₱{calculateSelectedTotal()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span>₱{getShippingPrice().toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2 border-gray-200">
                  <span>Total</span>
                  <span>₱{totalAmount}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}