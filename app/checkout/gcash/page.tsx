"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy route — forwards to QR Ph payment */
export default function GcashCheckoutRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/checkout/qrph-pay");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#101828] text-[#60A5FA] flex items-center justify-center">
      <p className="text-sm">Redirecting to payment...</p>
    </div>
  );
}
