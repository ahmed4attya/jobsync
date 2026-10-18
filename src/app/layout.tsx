import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "react-goal-calendar/style.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

export const dynamic = "force-dynamic";

const inter = localFont({
  src: "./fonts/Inter-Variable.woff2",
  variable: "--font-inter",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: {
    template: "%s | JobSync",
    default: "JobSync",
  },
  description: "Job Application Tracking System",
};

interface Props {
  children: React.ReactNode;
}

import { LanguageProvider } from "@/context/LanguageContext";

export default function RootLayout({ children }: Readonly<Props>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          inter.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LanguageProvider>
            {children}
            <Toaster />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
