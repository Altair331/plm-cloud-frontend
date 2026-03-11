"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { MetaDictionaryDto, MetaDictionaryEntryDto } from "@/models/dictionary";
import { dictionaryApi } from "@/services/dictionary";

type DictionaryMap = Record<string, MetaDictionaryDto>;

interface DictionaryContextValue {
  loading: boolean;
  dictionaries: DictionaryMap;
  ensureScene: (sceneCode: string) => Promise<void>;
  ensureBatch: (codes: string[]) => Promise<void>;
  getDictionary: (code: string) => MetaDictionaryDto | undefined;
  getEntries: (code: string) => MetaDictionaryEntryDto[];
  getEntry: (
    code: string,
    value: string | undefined | null,
    options?: { matchDbValue?: boolean },
  ) => MetaDictionaryEntryDto | undefined;
  getLabel: (
    code: string,
    value: string | undefined | null,
    options?: { matchDbValue?: boolean; fallback?: string },
  ) => string;
}

const DictionaryContext = createContext<DictionaryContextValue | null>(null);

const normalizeCode = (code: string) => code.trim().toUpperCase();
const normalizeValue = (value?: string | null) => (value || "").trim().toUpperCase();

export function DictionaryProvider({
  children,
  initialScenes = ["category-admin"],
}: {
  children: React.ReactNode;
  initialScenes?: string[];
}) {
  // TODO(dictionary-cache): Add local cache (sessionStorage/localStorage) with version+locale invalidation.
  const [loading, setLoading] = useState(false);
  const [dictionaries, setDictionaries] = useState<DictionaryMap>({});

  const mergeDictionaries = useCallback((items: MetaDictionaryDto[]) => {
    if (!items?.length) return;
    setDictionaries((prev) => {
      const next = { ...prev };
      items.forEach((item) => {
        next[normalizeCode(item.code)] = item;
      });
      return next;
    });
  }, []);

  const ensureScene = useCallback(async (sceneCode: string) => {
    setLoading(true);
    try {
      const res = await dictionaryApi.getByScene(sceneCode, {
        lang: "zh-CN",
        includeDisabled: false,
      });
      mergeDictionaries(res.items || []);
    } finally {
      setLoading(false);
    }
  }, [mergeDictionaries]);

  const ensureBatch = useCallback(async (codes: string[]) => {
    const normalized = Array.from(new Set(codes.map(normalizeCode))).filter(Boolean);
    if (!normalized.length) return;

    setLoading(true);
    try {
      const res = await dictionaryApi.batch({
        codes: normalized,
        lang: "zh-CN",
        includeDisabled: false,
      });
      mergeDictionaries(res.items || []);
    } finally {
      setLoading(false);
    }
  }, [mergeDictionaries]);

  useEffect(() => {
    if (!initialScenes.length) return;
    initialScenes.forEach((scene) => {
      void ensureScene(scene);
    });
  }, [initialScenes, ensureScene]);

  const getDictionary = useCallback(
    (code: string) => dictionaries[normalizeCode(code)],
    [dictionaries],
  );

  const getEntries = useCallback(
    (code: string) => getDictionary(code)?.entries || [],
    [getDictionary],
  );

  const getEntry = useCallback(
    (
      code: string,
      value: string | undefined | null,
      options?: { matchDbValue?: boolean },
    ) => {
      const entries = getEntries(code);
      const normalized = normalizeValue(value);
      if (!normalized) return undefined;

      return entries.find((entry) => {
        const candidates = [entry.key, entry.value];
        if (options?.matchDbValue) {
          const dbValue = entry.extra?.dbValue;
          if (typeof dbValue === "string") candidates.push(dbValue);
        }
        return candidates.some((item) => normalizeValue(String(item)) === normalized);
      });
    },
    [getEntries],
  );

  const getLabel = useCallback(
    (
      code: string,
      value: string | undefined | null,
      options?: { matchDbValue?: boolean; fallback?: string },
    ) => {
      const entry = getEntry(code, value, { matchDbValue: options?.matchDbValue });
      if (entry?.label) return entry.label;
      if (options?.fallback) return options.fallback;
      return value || "-";
    },
    [getEntry],
  );

  const value = useMemo<DictionaryContextValue>(
    () => ({
      loading,
      dictionaries,
      ensureScene,
      ensureBatch,
      getDictionary,
      getEntries,
      getEntry,
      getLabel,
    }),
    [loading, dictionaries, ensureScene, ensureBatch, getDictionary, getEntries, getEntry, getLabel],
  );

  return <DictionaryContext.Provider value={value}>{children}</DictionaryContext.Provider>;
}

export function useDictionary() {
  const context = useContext(DictionaryContext);
  if (!context) {
    throw new Error("useDictionary must be used within DictionaryProvider");
  }
  return context;
}
