"use client";

import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Image from "next/image";
import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Separator } from "@radix-ui/react-separator";
import { navItems } from "@/constants";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import FileUploader from "@/components/FileUploader";
import Search from "@/components/Search";
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

interface Props {
  $id: string;
  accountId: string;
  fullName: string;
  avatar: string;
  email: string;
}

const MobileNavigation = ({
  $id: ownerId,
  accountId,
  fullName,
  avatar,
  email,
}: Props) => {
  const { onUploadComplete } = useUpload();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="mobile-header">
      <Image
        src="/assets/icons/logo-full-brand.svg"
        alt="logo"
        width={100}
        height={42}
        className="h-auto w-[80px] sm:w-[100px]"
        priority
      />

      <div className="flex-1 mx-2 sm:mx-4">
        <Search />
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger>
          <Image
            src="/assets/icons/menu.svg"
            alt="Search"
            width={28}
            height={28}
          />
        </SheetTrigger>
        <SheetContent className="shad-sheet h-screen px-3">
                     <SheetTitle>
             <div className="header-user">
                               <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-lg border-2 border-white ${generateAvatarColor(email)}`}>
                  {getInitials(fullName)}
                </div>
               <div className="sm:hidden lg:block">
                 <p className="subtitle-2 capitalize truncate max-w-[200px] lg:max-w-[250px]">{fullName}</p>
                 <p className="caption truncate max-w-[200px] lg:max-w-[250px]">{email}</p>
               </div>
             </div>
             <Separator className="mb-4 bg-light-200/20" />
           </SheetTitle>

                     <nav className="mobile-nav">
             <ul className="mobile-nav-list">
               {navItems.map(({ url, name, icon }) => (
                 <Link key={name} href={url} className="lg:w-full" onClick={() => setOpen(false)}>
                   <li
                     className={cn(
                       "mobile-nav-item",
                       pathname === url && "shad-active",
                     )}
                   >
                     <Image
                       src={icon}
                       alt={name}
                       width={24}
                       height={24}
                       className={cn(
                         "nav-icon",
                         pathname === url && "nav-icon-active",
                       )}
                     />
                     <p>{name}</p>
                   </li>
                 </Link>
               ))}
             </ul>
           </nav>

          <Separator className="my-5 bg-light-200/20" />

          <div className="flex flex-col justify-between gap-5 pb-5">
            <div className="upload-button-wrapper">
              <FileUploader 
                ownerId={ownerId} 
                accountId={accountId} 
                onUploadStart={() => setOpen(false)}
                onUploadComplete={onUploadComplete}
                showButtonOnly={true}
              />
            </div>
            <form
              action={async (formData) => {
                const result = await signOut();
                if (result.success && result.redirect) {
                  window.location.href = result.redirect;
                }
              }}
            >
              <Button
                type="submit"
                className="mobile-sign-out-button"
              >
                <Image
                  src="/assets/icons/logout.svg"
                  alt="logo"
                  width={24}
                  height={24}
                />
                <p>Logout</p>
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
};

export default MobileNavigation;
