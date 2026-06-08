import Image from "next/image";
import { LOGO_URL, WELCOME_MODAL_IMAGE_URL } from "@/lib/assets";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function WelcomeCard() {
  const [dismissed, setDismissed] = useState(true); // Start as dismissed
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Show the modal only on the first page load in this session
    const hasShownModal = sessionStorage.getItem('welcomeModalShown');
    if (!hasShownModal) {
      setDismissed(false);
      sessionStorage.setItem('welcomeModalShown', 'true');
    } else {
      setDismissed(true);
    }
    setMounted(true);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('welcomeCardDismissed', 'true');
  };

  const handleStartShopping = () => {
    handleDismiss();
    router.push("/");
  };

  // Only show on homepage
  console.log('[WelcomeCard] pathname:', pathname, 'mounted:', mounted, 'dismissed:', dismissed);
  if (pathname !== "/" || !mounted || dismissed) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="flex w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl border-2 border-[#60A5FA] bg-[#101828]
        flex-col sm:flex-row max-w-xs sm:max-w-3xl mx-2 sm:mx-0 min-h-[unset] sm:min-h-[340px]">
        {/* Left: Image */}
        <div className="w-full sm:w-1/2 min-h-[120px] sm:min-h-[340px] bg-[#101828] flex items-center justify-center border-b-2 sm:border-b-0 sm:border-r-2 border-[#60A5FA] relative overflow-hidden">
          <img
            src={WELCOME_MODAL_IMAGE_URL}
            alt="Welcome"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.insertAdjacentHTML('beforeend', '<span style=\'color:#60A5FA;font-size:1.2rem;\'>Image not found</span>'); }}
            className="h-28 sm:h-full w-full object-cover"
          />
        </div>
        {/* Right: Content */}
        <div className="w-full sm:w-1/2 flex flex-col justify-center items-center px-3 sm:px-8 pt-3 sm:pt-12 pb-3 sm:pb-10 bg-[#19223a] text-[#60A5FA] flex-grow">
          {/* Animated Logo */}
          <div className="mb-1 sm:mb-4 animate-bounce mt-1 flex justify-center items-center">
            <Image
              src={LOGO_URL}
              alt="DPT ONE Logo"
              width={48}
              height={48}
              className="rounded-full drop-shadow-lg bg-white"
              priority
              style={{ width: "48px", height: "48px" }}
            />
          </div>
          <h2 className="text-xl sm:text-3xl font-extrabold mb-1 sm:mb-2 text-center">Welcome to DPT ONE!</h2>
          <p className="text-center mb-3 sm:mb-6 text-sm sm:text-lg">Discover exclusive streetwear, local brands, and the freshest drops. Enjoy a seamless shopping experience—right here, right now.</p>
          <button
            className="w-full sm:w-[80%] bg-[#60A5FA] text-[#101828] font-bold py-2 sm:py-4 rounded-lg shadow-md hover:bg-[#3380c0] transition-colors text-base sm:text-xl mb-1 sm:mb-3"
            onClick={handleStartShopping}
          >
            Start Shopping
          </button>
        </div>
      </div>
    </div>
  );
} 