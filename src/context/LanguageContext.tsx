"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { ar, TranslationKeys } from "@/lib/i18n/ar";
import { en } from "@/lib/i18n/en";

export type Locale = "ar" | "en";

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: TranslationKeys;
  isRtl: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = "jobsync_locale";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ar");

  useEffect(() => {
    // Read saved preference from cookie or localStorage
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Locale | null;
    if (saved && (saved === "ar" || saved === "en")) {
      setLocaleState(saved);
      document.documentElement.lang = saved;
      document.documentElement.dir = saved === "ar" ? "rtl" : "ltr";
    } else {
      // Default to Arabic
      document.documentElement.lang = "ar";
      document.documentElement.dir = "rtl";
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, newLocale);
    // Also set cookie so SSR/edge middleware can optionally pick it up
    document.cookie = `${LANGUAGE_STORAGE_KEY}=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    document.documentElement.lang = newLocale;
    document.documentElement.dir = newLocale === "ar" ? "rtl" : "ltr";
  };

  const toggleLocale = () => {
    setLocale(locale === "ar" ? "en" : "ar");
  };

  const isRtl = locale === "ar";
  const t = (locale === "ar" ? ar : (en as unknown as TranslationKeys));

  return (
    <LanguageContext.Provider
      value={{
        locale,
        setLocale,
        toggleLocale,
        t,
        isRtl,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
