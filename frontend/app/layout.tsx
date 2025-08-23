import type { Metadata } from "next";
import { Poppins } from 'next/font/google'
import { Toaster } from "@/components/ui/toaster";

// Import source map error handling utility
import "@/lib/sourceMapFix";

import "./globals.css";

const poppins = Poppins({
    subsets: ['latin'],
    weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
    variable: '--font-poppins',
})

export const metadata: Metadata = {
  title: "StoreIt",
  description: "StoreIt - The only storage solution you need.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${poppins.variable} font-poppins antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
