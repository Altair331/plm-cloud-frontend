import type { MetaDictionaryEntryDto } from '@/models/dictionary';

export interface CategoryBusinessDomainConfig {
  code: string;
  label: string;
  order?: number;
  entry: MetaDictionaryEntryDto;
}

export const CATEGORY_BUSINESS_DOMAIN_DICT_CODE = 'META_CATEGORY_BUSINESS_DOMAIN';

const normalizeBusinessDomain = (value?: string | null) => String(value || '').trim().toUpperCase();

export const getCategoryBusinessDomainConfigs = (entries: MetaDictionaryEntryDto[]) => {
  return [...entries]
    .map((entry) => ({
      code: normalizeBusinessDomain(entry.value || entry.key),
      label: entry.label || entry.value || entry.key,
      order: entry.order,
      entry,
    }))
    .filter((entry) => Boolean(entry.code))
    .sort((left, right) => {
      const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return left.label.localeCompare(right.label, 'zh-CN');
    });
};

export const formatCategoryBusinessDomainMenuLabel = (label?: string | null) => {
  const normalizedLabel = String(label || '').trim();
  if (!normalizedLabel) {
    return '未命名类';
  }

  return normalizedLabel.endsWith('类') ? normalizedLabel : `${normalizedLabel}类`;
};

export const getCategoryBusinessDomainPath = (businessDomain: string) => {
  return `/admin/category/${normalizeBusinessDomain(businessDomain)}`;
};

export const resolveCategoryBusinessDomain = (
  entries: MetaDictionaryEntryDto[],
  rawValue?: string | null,
) => {
  if (!rawValue) {
    return null;
  }

  const normalizedValue = normalizeBusinessDomain(rawValue);

  return getCategoryBusinessDomainConfigs(entries).find((item) => {
    const dbValue = typeof item.entry.extra?.dbValue === 'string'
      ? normalizeBusinessDomain(item.entry.extra.dbValue)
      : '';

    return [
      item.code,
      normalizeBusinessDomain(item.entry.key),
      dbValue,
    ].some((candidate) => candidate === normalizedValue);
  }) || null;
};

export const getCategoryBusinessDomainLabel = (
  entries: MetaDictionaryEntryDto[],
  businessDomain?: string | null,
  fallback?: string,
) => {
  return resolveCategoryBusinessDomain(entries, businessDomain)?.label || fallback || businessDomain || '-';
};

export const getDefaultCategoryBusinessDomain = (entries: MetaDictionaryEntryDto[]) => {
  return getCategoryBusinessDomainConfigs(entries)[0] || null;
};