"use client";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function UserProfile() {
  const { user } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const getInitials = (displayName: string | null) => {
    if (!displayName) return "?";
    const nameParts = displayName.split(' ');
    if (nameParts.length === 1) {
      return nameParts[0].charAt(0).toUpperCase();
    } else if (nameParts.length > 1) {
      return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
    }
    return "?";
  };

  if (!user) {
    return (
      <div className="flex items-center space-x-4">
        <Link href="/login">
          <button
            className="px-4 py-2 rounded-md border-2 border-[#60A5FA] text-[#60A5FA] bg-[#101828] font-semibold hover:bg-[#19223a] hover:border-[#60A5FA] hover:text-white transition-all"
          >
            Log In
          </button>
        </Link>
        <Link href="/login?signup=true">
          <button
            className="px-4 py-2 rounded-md border-2 border-[#60A5FA] text-[#60A5FA] bg-[#101828] font-semibold hover:bg-[#19223a] hover:border-[#60A5FA] hover:text-white transition-all"
          >
            Sign Up
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        className="flex items-center space-x-1 text-white hover:text-[#60A5FA] focus:outline-none"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        <div className="w-8 h-8 rounded-full bg-[#222f43] flex items-center justify-center text-sm font-semibold text-[#60A5FA]">
          {getInitials(user.displayName)}
        </div>
        <span className="hidden md:inline text-sm font-medium text-white">{user.displayName || user.email}</span>
        <svg
          className={`h-4 w-4 transform transition-transform text-white ${isDropdownOpen ? 'rotate-180' : 'rotate-0'}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>
      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-[300px] bg-[#19223a] border border-[#222f43] rounded-md shadow-lg py-1 z-10">
          <div className="flex items-center px-4 py-2 text-sm text-white border-b border-[#222f43]">
            <div className="w-8 h-8 rounded-full bg-[#222f43] flex items-center justify-center text-sm font-semibold text-[#60A5FA] mr-1 flex-shrink-0">
              {getInitials(user.displayName)}
            </div>
            <div className="max-w-full">
              <div className="font-semibold text-white">{user.displayName || 'Your Name'}</div>
              <div className="text-[#60A5FA]">{user.email}</div>
            </div>
          </div>
          <Link href="/profile" className="block px-4 py-2 text-sm text-white hover:bg-[#222f43]" onClick={() => setIsDropdownOpen(false)}>Profile</Link>
          <button
            onClick={() => { handleSignOut(); setIsDropdownOpen(false); }}
            className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-[#222f43]"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
} 