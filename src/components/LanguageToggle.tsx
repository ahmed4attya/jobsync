"use client";

import React from "react";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";

export function LanguageToggle() {
  const { locale, toggleLocale } = useLanguage();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleLocale}
      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border-muted-foreground/30 hover:bg-accent transition-colors"
      title={locale === "ar" ? "Switch to English" : "التبديل إلى العربية"}
    >
      <Languages className="h-3.5 w-3.5 text-primary" />
      <span>{locale === "ar" ? "EN" : "عربي"}</span>
    </Button>
  );
}
