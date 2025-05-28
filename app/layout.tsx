// app/layout.tsx
import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./contexts/AuthContext";
import { SearchProvider } from "./contexts/SearchContext";
import { FilterProvider } from "./contexts/FilterContext"; // Import FilterProvider
import Header from "./components/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kanban App",
  description: "A Kanban board application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Force dark mode before hydration */}
        <Script id="force-dark" strategy="beforeInteractive">
          {`document.documentElement.classList.add('dark')`}
        </Script>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <SearchProvider>
            <FilterProvider> {/* Wrap Header and children with FilterProvider */}
              <Header />
              {children}
            </FilterProvider>
          </SearchProvider>
        </AuthProvider>
        <div id="hint-portal-root"></div>
      </body>
    </html>
  );
}
