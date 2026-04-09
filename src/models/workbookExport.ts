export type WorkbookExportModuleKey = 'CATEGORY' | 'ATTRIBUTE' | 'ENUM_OPTION';

export type WorkbookExportOutputFormat = 'XLSX';

export type WorkbookExportJobStatusValue =
  | 'QUEUED'
  | 'RESOLVING_SCOPE'
  | 'LOADING_CATEGORIES'
  | 'LOADING_ATTRIBUTES'
  | 'LOADING_ENUM_OPTIONS'
  | 'BUILDING_WORKBOOK'
  | 'STORING_FILE'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELED';

export type WorkbookExportLogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface WorkbookExportColumnRequestDto {
  fieldKey: string;
  headerText?: string;
  clientColumnId?: string;
}

export interface WorkbookExportStartRequestDto {
  businessDomain: string;
  scope: {
    categoryIds: string[];
    includeChildren?: boolean;
  };
  output: {
    format: WorkbookExportOutputFormat;
    fileName?: string;
    pathSeparator?: string;
  };
  modules: Array<{
    moduleKey: WorkbookExportModuleKey;
    enabled: boolean;
    sheetName?: string;
    columns: WorkbookExportColumnRequestDto[];
  }>;
  operator?: string;
  clientRequestId?: string;
}

export interface WorkbookExportSchemaResponseDto {
  schemaVersion: string;
  modules: Array<{
    moduleKey: WorkbookExportModuleKey;
    defaultSheetName: string;
    fields: Array<{
      fieldKey: string;
      defaultHeader: string;
      description: string;
      valueType: string;
      defaultSelected: boolean;
      allowCustomHeader: boolean;
    }>;
  }>;
}

export interface WorkbookExportPlanResponseDto {
  normalizedRequest: WorkbookExportStartRequestDto;
  estimate: {
    categoryRows: number;
    attributeRows: number;
    enumOptionRows: number;
  };
  warnings: string[];
}

export interface WorkbookExportStartResponseDto {
  jobId: string;
  status: WorkbookExportJobStatusValue;
  currentStage: WorkbookExportJobStatusValue;
  createdAt: string;
}

export interface WorkbookExportLogEventDto {
  cursor: string | null;
  sequence: number | null;
  timestamp: string | null;
  level: WorkbookExportLogLevel | string | null;
  stage: string | null;
  eventType: string | null;
  moduleKey: WorkbookExportModuleKey | string | null;
  code: string | null;
  message: string;
  details: Record<string, unknown> | null;
}

export interface WorkbookExportModuleProgressDto {
  total: number;
  processed: number;
  exported: number;
  failed: number;
}

export interface WorkbookExportJobStatusDto {
  jobId: string;
  businessDomain: string;
  status: WorkbookExportJobStatusValue;
  currentStage: string;
  fileName: string | null;
  overallPercent: number;
  stagePercent: number;
  createdAt: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
  progress: {
    categories: WorkbookExportModuleProgressDto;
    attributes: WorkbookExportModuleProgressDto;
    enumOptions: WorkbookExportModuleProgressDto;
  };
  latestLogCursor: string | null;
  latestLogs: WorkbookExportLogEventDto[];
  warnings: string[];
}

export interface WorkbookExportLogPageDto {
  jobId: string;
  nextCursor: string | null;
  items: WorkbookExportLogEventDto[];
}

export interface WorkbookExportModuleSummaryDto {
  sheetName: string;
  totalRows: number;
  exportedRows: number;
}

export interface WorkbookExportJobResultDto {
  jobId: string;
  status: WorkbookExportJobStatusValue;
  summary: {
    categories: WorkbookExportModuleSummaryDto | null;
    attributes: WorkbookExportModuleSummaryDto | null;
    enumOptions: WorkbookExportModuleSummaryDto | null;
  };
  resolvedRequest: WorkbookExportStartRequestDto;
  file: {
    fileName: string;
    contentType: string;
    size: number;
    checksum: string;
    expiresAt: string | null;
  };
  warnings: string[];
  completedAt: string | null;
}