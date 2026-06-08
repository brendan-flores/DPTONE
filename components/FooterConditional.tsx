"use client";
import { usePathname } from 'next/navigation';
import Image from "next/image";
import { LOGO_URL } from "@/lib/assets";

export default function FooterConditional() {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) return null;
  return (
    <footer className="bg-[#101828] text-[#60A5FA] font-sans mt-16">
      <div className="max-w-7xl mx-auto px-4 py-14 flex flex-col md:flex-row justify-between items-center md:items-start gap-12 md:gap-0">
        <div className="flex flex-col items-center md:items-start w-full md:w-1/3 mb-8 md:mb-0">
          <Image src={LOGO_URL} alt="DPT ONE Footer Logo" width={90} height={90} className="mb-4" priority style={{ width: "90px", height: "90px" }} />
        </div>
        <div className="w-full md:w-1/3 text-center md:text-left mb-8 md:mb-0">
          <h2 className="text-xl font-bold mb-2 text-[#60A5FA]">Why Shop With Us?</h2>
          <p className="text-[#60A5FA]">Discover the best in local streetwear. DPT ONE brings you curated collections, exclusive drops, and a seamless shopping experience right from Cebu to your doorstep.</p>
        </div>
        <div className="w-full md:w-1/3 text-center md:text-right">
          <h2 className="text-xl font-bold mb-2 text-[#60A5FA]">Contact Us</h2>
          <div className="flex flex-col items-center md:items-end gap-1 text-[#60A5FA]">
            <span>✉️ sisiglovers@gmail.com</span>
            <span>📞 +639828282612</span>
            <span>📍 Cebu, Philippines</span>
          </div>
        </div>
      </div>
      <div className="border-t border-[#222f43] text-center py-4 text-[#60A5FA] text-sm">
        © 2025. All rights reserved.
      </div>
    </footer>
  );
} 