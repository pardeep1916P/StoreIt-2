"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Search from "@/components/Search";
import FileUploader from "@/components/FileUploader";
import { signOut } from "@/lib/actions/user.actions";
import { useUpload } from "@/contexts/UploadContext";

// Utility function to generate a unique color based on email
const generateAvatarColor = (email: string) => {
  const colors = [
    'bg-gradient-to-br from-blue-500 to-blue-600',
    'bg-gradient-to-br from-emerald-500 to-emerald-600',
    'bg-gradient-to-br from-purple-500 to-purple-600',
    'bg-gradient-to-br from-pink-500 to-pink-600',
    'bg-gradient-to-br from-indigo-500 to-indigo-600',
    'bg-gradient-to-br from-amber-500 to-amber-600',
    'bg-gradient-to-br from-rose-500 to-rose-600',
    'bg-gradient-to-br from-teal-500 to-teal-600',
    'bg-gradient-to-br from-orange-500 to-orange-600',
    'bg-gradient-to-br from-cyan-500 to-cyan-600',
    'bg-gradient-to-br from-violet-500 to-violet-600',
    'bg-gradient-to-br from-fuchsia-500 to-fuchsia-600',
    'bg-gradient-to-br from-sky-500 to-sky-600',
    'bg-gradient-to-br from-lime-500 to-lime-600',
    'bg-gradient-to-br from-red-500 to-red-600',
    'bg-gradient-to-br from-green-500 to-green-600'
  ];
  
  // Simple hash function to get consistent color for same email
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    const char = email.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return colors[Math.abs(hash) % colors.length];
};

// Utility function to get initials from username
const getInitials = (userName: string) => {
  if (!userName) return 'U';
  
  // Split by spaces and get first letter of each word
  const words = userName.trim().split(' ');
  if (words.length === 1) {
    // Single word: take first and last letter
    const word = userName.trim();
    return (word.charAt(0) + word.charAt(word.length - 1)).toUpperCase();
  } else {
    // Multiple words: take first letter of first two words
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }
};

const Header = ({
  userId,
  accountId,
  userEmail,
  userName,
}: {
  userId: string;
  accountId: string;
  userEmail?: string;
  userName?: string;
}) => {
  const { onUploadComplete } = useUpload();
  const avatarColor = userEmail ? generateAvatarColor(userEmail) : 'bg-gray-500';
  const initials = userName ? getInitials(userName) : 'U';

  return (
    <header className="header">
      <Search />
      <div className="header-wrapper">
        <FileUploader 
          ownerId={userId} 
          accountId={accountId} 
          onUploadStart={() => {
            // For desktop, we don't need to close anything
            // This is just for consistency with mobile
          }}
          onUploadComplete={onUploadComplete}
        />
        
        {/* User Avatar - Always visible */}
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4 mr-2 sm:mr-4 min-w-0">
          {/* Avatar - Always visible */}
          <div className={`w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white text-sm sm:text-base font-medium shadow-lg border-2 border-white ${avatarColor}`}>
            {initials}
          </div>
          
          {/* Name and Email Stack - Desktop/Tablet */}
          <div className="hidden sm:block">
            {userName && (
              <div className="text-sm font-semibold text-gray-900 truncate max-w-[120px] md:max-w-[140px] lg:max-w-[150px] xl:max-w-[200px]">
                {userName}
              </div>
            )}
            {userEmail && (
              <div className="text-xs text-gray-600 truncate max-w-[120px] md:max-w-[140px] lg:max-w-[150px] xl:max-w-[200px]">
                {userEmail}
              </div>
            )}
          </div>
          
          {/* Mobile: Show only name */}
          {userName && (
            <div className="block sm:hidden">
              <div className="text-xs font-semibold text-gray-900 truncate max-w-[60px] sm:max-w-[80px]">
                {userName}
              </div>
            </div>
          )}
        </div>
        
        <form
          action={async (formData) => {
            const result = await signOut();
            if (result.success && result.redirect) {
              window.location.href = result.redirect;
            }
          }}
        >
          <Button type="submit" className="sign-out-button">
            <Image
              src="/assets/icons/logout.svg"
              alt="logo"
              width={24}
              height={24}
              className="w-6"
            />
          </Button>
        </form>
      </div>
    </header>
  );
};
export default Header;
