"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingCart, Search, X, ChevronDown, Menu } from "lucide-react";
import UserProfile from "@/components/UserProfile";
import { useCart } from '@/context/CartContext';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { LOGO_URL } from "@/lib/assets";
import { getAdminDashboardUrl } from "@/lib/admin-host";
import { useStorefrontProducts } from "@/hooks/useStorefrontProducts";
import { supabase } from "@/lib/supabase";

export default function Header() {
  const { cartItems } = useCart();
  const router = useRouter();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const { products: allProducts } = useStorefrontProducts();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check if we're on the admin page
  const isAdminPage = pathname?.startsWith("/admin") ?? false;
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function checkAdmin() {
      if (!user?.uid) {
        setIsAdmin(false);
        return;
      }
      const { data, error } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.uid)
        .eq("is_active", true)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setIsAdmin(false);
        return;
      }
      setIsAdmin(Boolean(data?.user_id));
    }

    checkAdmin();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setIsSearchOpen(false);
      setSearchResults([]);
      setShowSuggestions(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.trim().length > 0) {
      const filtered = allProducts.filter(product =>
        product.name && product.name.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(filtered);
      setShowSuggestions(true);
    } else {
      setSearchResults([]);
      setShowSuggestions(false);
    }
  };

  const toggleSearch = () => {
    setIsSearchOpen(!isSearchOpen);
    if (isSearchOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setShowSuggestions(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setMobileMenuOpen(false);
      window.location.href = "/";
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Helper to get initials from displayName
  const getInitials = (displayName: string | null) => {
    if (!displayName) return "?";
    const nameParts = displayName.split(" ");
    if (nameParts.length === 1) {
      return nameParts[0].charAt(0).toUpperCase();
    } else if (nameParts.length > 1) {
      return (
        nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)
      ).toUpperCase();
    }
    return "?";
  };

  return (
    <header className="bg-[#101828] border-b border-[#222f43] py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row md:items-center md:justify-between">
        {(pathname === '/orders' || pathname.startsWith('/orders/')) ? (
          <div className="hidden md:flex w-full items-center justify-between">
            {/* Left: Logo + Shop by Brand + Orders */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center mr-4 flex-shrink-0">
                <Image
                  src={LOGO_URL}
                  alt="DPT ONE Logo"
                  width={60}
                  height={60}
                  priority
                  style={{ width: "60px !important", height: "60px !important" }}
                />
              </Link>
              <nav className="ml-6 flex items-center gap-6 text-sm font-medium text-[#60A5FA]">
                <div className="relative">
                  <button
                    onClick={() => setIsBrandDropdownOpen(!isBrandDropdownOpen)}
                    className="flex items-center space-x-1 hover:text-[#fff9f3] focus:outline-none"
                  >
                    <span>Shop by Brand</span>
                    <ChevronDown
                      className={`h-4 w-4 transform transition-transform duration-200 ${isBrandDropdownOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  <div className={`absolute ${isBrandDropdownOpen ? 'block' : 'hidden'} bg-[#001F3F] shadow-lg rounded-md py-1 mt-2 w-40 z-20`}>
                    <Link href="/brands/MN%2BLA" className="block w-full text-left px-4 py-2 text-white hover:bg-[#003366] hover:text-white" onClick={() => setIsBrandDropdownOpen(false)}>MN+LA</Link>
                    <Link href="/brands/Charlotte%20Folk" className="block w-full text-left px-4 py-2 text-white hover:bg-[#003366] hover:text-white" onClick={() => setIsBrandDropdownOpen(false)}>Charlotte Folk</Link>
                    <Link href="/brands/Strap" className="block w-full text-left px-4 py-2 text-white hover:bg-[#003366] hover:text-white" onClick={() => setIsBrandDropdownOpen(false)}>Strap</Link>
                    <Link href="/brands/Richboyz" className="block w-full text-left px-4 py-2 text-white hover:bg-[#003366] hover:text-white" onClick={() => setIsBrandDropdownOpen(false)}>Richboyz</Link>
                  </div>
                </div>
                <Link href="/orders" className="hover:text-[#fff9f3]">Orders</Link>
              </nav>
            </div>
            {/* Right: Profile & Cart */}
            <div className="flex items-center space-x-4 ml-4">
              {user && !isAdmin && <UserProfile />}
              <Link href="/cart" className="relative flex items-center justify-center">
                <ShoppingCart className="h-6 w-6 text-white hover:text-[#60A5FA] transition-colors" />
                {cartItems.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {cartItems.length}
                  </span>
                )}
              </Link>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex w-full items-center">
            {/* Logo and Navigation grouped */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center mr-4 flex-shrink-0">
                <Image
                  src={LOGO_URL}
                  alt="DPT ONE Logo"
                  width={60}
                  height={60}
                  priority
                  style={{ width: "60px !important", height: "60px !important" }}
                />
              </Link>
              <nav className="ml-6 flex items-center gap-6 text-sm font-medium text-[#60A5FA]">
                {/* Shop by Brand Dropdown */}
                {!isAdminPage && (
                  <div className="relative">
                    <button
                      onClick={() => setIsBrandDropdownOpen(!isBrandDropdownOpen)}
                      className="flex items-center space-x-1 hover:text-[#fff9f3] focus:outline-none"
                    >
                      <span>Shop by Brand</span>
                      <ChevronDown
                        className={`h-4 w-4 transform transition-transform duration-200 ${isBrandDropdownOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    <div className={`absolute ${isBrandDropdownOpen ? 'block' : 'hidden'} bg-[#001F3F] shadow-lg rounded-md py-1 mt-2 w-40 z-20`}>
                      <Link href="/brands/MN%2BLA" className="block w-full text-left px-4 py-2 text-white hover:bg-[#003366] hover:text-white" onClick={() => setIsBrandDropdownOpen(false)}>MN+LA</Link>
                      <Link href="/brands/Charlotte%20Folk" className="block w-full text-left px-4 py-2 text-white hover:bg-[#003366] hover:text-white" onClick={() => setIsBrandDropdownOpen(false)}>Charlotte Folk</Link>
                      <Link href="/brands/Strap" className="block w-full text-left px-4 py-2 text-white hover:bg-[#003366] hover:text-white" onClick={() => setIsBrandDropdownOpen(false)}>Strap</Link>
                      <Link href="/brands/Richboyz" className="block w-full text-left px-4 py-2 text-white hover:bg-[#003366] hover:text-white" onClick={() => setIsBrandDropdownOpen(false)}>Richboyz</Link>
                    </div>
                  </div>
                )}
                {user && !isAdminPage && !isAdmin && (
                  <Link href="/orders" className="hover:text-[#fff9f3]">Orders</Link>
                )}
                {!isAdminPage && isAdmin && (
                  <a
                    href={getAdminDashboardUrl()}
                    className="hover:text-[#fff9f3] text-[#60A5FA] font-semibold"
                  >
                    Admin Dashboard
                  </a>
                )}
              </nav>
            </div>
            {/* Centered Search Bar */}
            {!isAdminPage && !(pathname === '/orders') && !pathname.startsWith('/orders/') && (
              <div className="flex-1 flex justify-center mx-8">
                <form onSubmit={handleSearch} className="relative w-full max-w-xl">
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={handleInputChange}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
                    className="w-full px-5 py-2.5 pl-12 pr-5 border-2 border-[#60A5FA] rounded-full bg-[#f5f2ef] text-[#001F3F] placeholder-[#001F3F] focus:outline-none focus:ring-3 focus:ring-[#60A5FA] focus:border-[#60A5FA] transition-all duration-300 ease-in-out shadow-md text-base"
                  />
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#001F3F]" />
                  <button
                    type="submit"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#001F3F] hover:text-[#fff9f3] transition-colors"
                  >
                    <Search className="h-5 w-5" />
                  </button>
                  {/* Search Suggestions Dropdown (Desktop) */}
                  {showSuggestions && searchQuery.length > 0 && searchResults.length > 0 && (
                    <div className="absolute z-10 w-full bg-[#001F3F] border border-gray-200 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
                      <p className="px-4 py-2 text-xs text-white uppercase font-bold">Products</p>
                      {searchResults.map((product) => {
                        let productImg = '/images/placeholder.jpg';
                        if (Array.isArray(product.imageUrls) && product.imageUrls.length > 0) {
                          productImg = product.imageUrls[0];
                        } else if (product.image) {
                          productImg = product.image;
                        } else if (product.imageUrl) {
                          productImg = product.imageUrl;
                        }
                        return (
                          <Link href={`/products/${product.id}`} key={product.id} className="flex items-center px-4 py-2 hover:bg-[#003366] cursor-pointer">
                            <Image
                              src={productImg}
                              alt={product.name || 'Product'}
                              width={40}
                              height={40}
                              className="mr-3 rounded"
                            />
                            <span className="text-sm font-medium text-white">{product.name}</span>
                          </Link>
                        );
                      })}
                      <Link href={`/search?q=${encodeURIComponent(searchQuery)}`} className="block px-4 py-3 bg-[#003366] text-white hover:bg-[#001F3F] text-sm font-medium text-center border-t border-gray-200">
                        Search for "{searchQuery}"
                      </Link>
                    </div>
                  )}
                </form>
              </div>
            )}
            {/* User Profile & Cart */}
            <div className="flex items-center space-x-4 ml-4">
              {user && !isAdmin && <UserProfile />}
              {!isAdminPage && !isAdmin && (
                <Link href="/cart" className="relative flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 text-white hover:text-[#60A5FA] transition-colors" />
                  {cartItems.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {cartItems.length}
                    </span>
                  )}
                </Link>
              )}
              {/* Log In / Sign Up (show if not logged in) */}
              {!user && (
                <>
                  <Link href="/login" className="px-4 py-2 border border-[#60A5FA] rounded-md text-[#60A5FA] font-semibold hover:bg-[#60A5FA] hover:text-[#101828] transition-colors">Log In</Link>
                  <Link href="/signup" className="px-4 py-2 border border-[#60A5FA] rounded-md text-[#60A5FA] font-semibold hover:bg-[#60A5FA] hover:text-[#101828] transition-colors">Sign Up</Link>
                </>
              )}
            </div>
          </div>
        )}
        {/* Mobile header: Logo | Cart | Hamburger */}
        <div className="flex md:hidden items-center w-full mb-4 px-4 justify-between bg-[#101828]" style={{minHeight: '60px'}}>
          {/* Left: Logo */}
          <Link href="/" className="flex items-center">
            <Image
              src={LOGO_URL}
              alt="DPT ONE Logo"
              width={60}
              height={60}
              className="h-auto"
              priority
            />
          </Link>
          {/* Right: Cart and Hamburger */}
          <div className="flex items-center space-x-6">
            {/* Cart icon */}
            {!isAdminPage && !isAdmin && (
              <Link href="/cart" className="relative flex items-center justify-center">
                <ShoppingCart className="h-7 w-7 text-white hover:text-[#60A5FA] transition-colors" />
                {cartItems.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {cartItems.length}
                  </span>
                )}
              </Link>
            )}
            {/* Search icon for mobile */}
            {!isAdminPage && !isAdmin && (
              <button className="p-2 text-white" aria-label="Open search" onClick={toggleSearch}>
                <Search className="h-7 w-7" />
              </button>
            )}
            {/* Hamburger menu icon */}
            <button className="p-2 text-white" aria-label="Open menu" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="h-7 w-7" />
            </button>
            {/* Side drawer for mobile menu */}
            {mobileMenuOpen && (
              <div className="fixed inset-0 z-40 flex">
                {/* Overlay */}
                <div className="fixed inset-0 bg-black opacity-40" onClick={() => setMobileMenuOpen(false)} />
                {/* Drawer */}
                <div className="fixed left-0 top-0 bg-[#101828] w-64 h-full shadow-lg z-50 flex flex-col">
                  <div className="p-6 flex flex-col h-full">
                    <button className="absolute top-4 right-4 text-white" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">
                      <X className="h-6 w-6" />
                    </button>
                    {/* User info at the top */}
                    {user && (
                      <div className="flex items-center gap-3 mb-6 mt-2">
                        <div className="w-12 h-12 rounded-full bg-[#22304a] flex items-center justify-center text-lg font-bold text-[#60A5FA]">
                          {isAdmin ? 'SL' : getInitials(user.displayName)}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-white font-semibold truncate">{isAdmin ? 'Sisig Lovers' : (user.displayName || 'Your Name')}</span>
                          <span className="text-[#60A5FA] text-xs truncate">{user.email}</span>
                        </div>
                      </div>
                    )}
                    <div className="mt-2 flex flex-col h-full">
                      {/* Shop by Brand Dropdown for logged-in users */}
                      {user ? (
                        <div className="mb-4">
                          <button
                            onClick={() => setIsBrandDropdownOpen(!isBrandDropdownOpen)}
                            className="flex items-center w-full justify-between text-[#60A5FA] font-semibold text-base focus:outline-none hover:text-white"
                          >
                            <span>Shop by Brand</span>
                            <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${isBrandDropdownOpen ? 'rotate-180' : ''}`} />
                          </button>
                          <div className={`mt-2 flex flex-col gap-2 pl-2 ${isBrandDropdownOpen ? '' : 'hidden'}`}> 
                            <Link href="/brands/MN%2BLA" className="text-white hover:text-[#60A5FA]" onClick={() => setMobileMenuOpen(false)}>MN+LA</Link>
                            <Link href="/brands/Charlotte%20Folk" className="text-white hover:text-[#60A5FA]" onClick={() => setMobileMenuOpen(false)}>Charlotte Folk</Link>
                            <Link href="/brands/Strap" className="text-white hover:text-[#60A5FA]" onClick={() => setMobileMenuOpen(false)}>Strap</Link>
                            <Link href="/brands/Richboyz" className="text-white hover:text-[#60A5FA]" onClick={() => setMobileMenuOpen(false)}>Richboyz</Link>
                          </div>
                        </div>
                      ) : (
                        <div className="mb-4">
                          <span className="text-[#60A5FA] font-semibold text-base">Shop by Brand</span>
                          <div className="mt-2 flex flex-col gap-2">
                            <Link href="/brands/MN%2BLA" className="text-white hover:text-[#60A5FA]" onClick={() => setMobileMenuOpen(false)}>MN+LA</Link>
                            <Link href="/brands/Charlotte%20Folk" className="text-white hover:text-[#60A5FA]" onClick={() => setMobileMenuOpen(false)}>Charlotte Folk</Link>
                            <Link href="/brands/Strap" className="text-white hover:text-[#60A5FA]" onClick={() => setMobileMenuOpen(false)}>Strap</Link>
                            <Link href="/brands/Richboyz" className="text-white hover:text-[#60A5FA]" onClick={() => setMobileMenuOpen(false)}>Richboyz</Link>
                          </div>
                        </div>
                      )}
                      {/* Admin Dashboard link for admin */}
                      {isAdmin && !isAdminPage && (
                        <div className="mb-4">
                          <a
                            href={getAdminDashboardUrl()}
                            className="text-[#60A5FA] font-semibold block py-2"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            Admin Dashboard
                          </a>
                        </div>
                      )}
                      {/* User-specific links */}
                      {user && !isAdminPage && !isAdmin && (
                        <div className="mb-4">
                          <Link href="/orders" className="text-[#60A5FA] font-semibold hover:text-white block py-2" onClick={() => setMobileMenuOpen(false)}>Orders</Link>
                        </div>
                      )}
                      {/* Auth buttons - positioned at bottom */}
                      <div className="mt-auto pt-6 border-t border-[#22304a]">
                        {!user ? (
                          <div className="flex flex-col gap-3">
                            <Link 
                              href="/login" 
                              className="w-full px-4 py-3 border border-[#60A5FA] rounded-md text-[#60A5FA] font-semibold hover:bg-[#60A5FA] hover:text-[#101828] transition-colors text-center"
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              Log In
                            </Link>
                            <Link 
                              href="/signup" 
                              className="w-full px-4 py-3 bg-[#60A5FA] border border-[#60A5FA] rounded-md text-[#101828] font-semibold hover:bg-[#3380c0] transition-colors text-center"
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              Sign Up
                            </Link>
                          </div>
                        ) : (
                          <button
                            onClick={handleLogout}
                            className="w-full px-4 py-3 border border-[#60A5FA] rounded-md text-[#60A5FA] font-semibold hover:bg-[#60A5FA] hover:text-[#101828] transition-colors text-center"
                          >
                            Log Out
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Mobile Search Bar (hidden on /profile, /cart, /settings, and /admin) */}
      {isSearchOpen && !(pathname === '/profile' || pathname === '/cart' || pathname === '/settings' || pathname === '/checkout' || isAdminPage || pathname === '/orders') && (
        <div className="md:hidden px-4 py-3 border-t border-gray-200">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
              className="w-full px-5 py-2.5 pl-12 pr-5 border-2 border-[#60A5FA] rounded-full bg-[#f5f2ef] text-[#001F3F] placeholder-[#001F3F] focus:outline-none focus:ring-3 focus:ring-[#60A5FA] focus:border-[#60A5FA] transition-all duration-300 ease-in-out shadow-md text-base"
              autoFocus
            />
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#001F3F]" />
            <button
              type="submit"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#001F3F] hover:text-[#003366] transition-colors"
            >
              <Search className="h-5 w-5" />
            </button>
          </form>
        </div>
      )}
    </header>
  );
} 