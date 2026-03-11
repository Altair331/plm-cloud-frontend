"use client";

import React from "react";
import { DictionaryProvider } from "@/contexts/DictionaryContext";

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return <DictionaryProvider initialScenes={["category-admin"]}>{children}</DictionaryProvider>;
}
