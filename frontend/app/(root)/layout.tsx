"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import MobileNavigation from "@/components/MobileNavigation";
import Header from "@/components/Header";
import { getCurrentUser } from "@/lib/actions/user.actions";
import { redirect } from "next/navigation";
import { Toaster } from "@/components/ui/toaster";
import { UploadProvider } from "@/contexts/UploadContext";
import GlobalUploadPopup from "@/components/GlobalUploadPopup";

export const dynamic = "force-dynamic";

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          window.location.href = "/sign-in";
          return;
        }
        setCurrentUser(user);
      } catch (error) {
        window.location.href = "/sign-in";
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const handleUploadComplete = () => {
    // This will be overridden by child components that need custom behavior
    // For now, just refresh the page
    window.location.reload();
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!currentUser) {
    return null; // Will redirect to sign-in
  }

  return (
    <UploadProvider onUploadComplete={handleUploadComplete}>
      <main className="flex h-screen">
        <Sidebar {...currentUser} />

        <section className="flex h-full flex-1 flex-col">
          <MobileNavigation 
            $id={currentUser.$id || currentUser.id}
            accountId={currentUser.accountId || currentUser.id}
            fullName={currentUser.username}
            avatar={currentUser.avatar || ''}
            email={currentUser.email}
          />
          <Header 
            userId={currentUser.$id || currentUser.id} 
            accountId={currentUser.accountId || currentUser.id}
            userEmail={currentUser.email}
            userName={currentUser.username}
          />
          <div className="main-content">{children}</div>
        </section>

        <Toaster />
      </main>
      <GlobalUploadPopup />
    </UploadProvider>
  );
};
export default Layout;
