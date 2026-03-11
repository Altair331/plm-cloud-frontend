export interface MetaDictionaryEntryDto {
  key: string;
  value: string;
  label: string;
  order?: number;
  enabled?: boolean;
  extra?: Record<string, unknown>;
}

export interface MetaDictionaryDto {
  code: string;
  name: string;
  version: number;
  source: string;
  locale: string;
  entries: MetaDictionaryEntryDto[];
}

export interface MetaDictionaryBatchRequestDto {
  codes: string[];
  lang?: string;
  includeDisabled?: boolean;
}

export interface MetaDictionaryBatchResponseDto {
  items: MetaDictionaryDto[];
}
