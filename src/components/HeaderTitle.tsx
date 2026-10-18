"use client";

import React from "react";
import { useLanguage } from "@/context/LanguageContext";

export function HeaderTitle() {
  const { t } = useLanguage();

  return (
    <h1 className="font-semibold text-sm sm:text-base">
      JobSync<span className="hidden sm:inline"> — {t.app.title.replace("JobSync — ", "")}</span>
    </h1>
  );
}
