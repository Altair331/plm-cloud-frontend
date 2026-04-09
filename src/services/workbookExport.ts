import { API_BASE_URL } from '@/config';
import request from './request';
import type {
  WorkbookExportJobResultDto,
  WorkbookExportJobStatusDto,
  WorkbookExportLogPageDto,
  WorkbookExportPlanResponseDto,
  WorkbookExportSchemaResponseDto,
  WorkbookExportStartRequestDto,
  WorkbookExportStartResponseDto,
} from '@/models/workbookExport';

export type {
  WorkbookExportColumnRequestDto,
  WorkbookExportJobResultDto,
  WorkbookExportJobStatusDto,
  WorkbookExportJobStatusValue,
  WorkbookExportLogEventDto,
  WorkbookExportLogLevel,
  WorkbookExportLogPageDto,
  WorkbookExportModuleKey,
  WorkbookExportModuleProgressDto,
  WorkbookExportModuleSummaryDto,
  WorkbookExportOutputFormat,
  WorkbookExportPlanResponseDto,
  WorkbookExportSchemaResponseDto,
  WorkbookExportStartRequestDto,
  WorkbookExportStartResponseDto,
} from '@/models/workbookExport';

const WORKBOOK_EXPORT_BASE = '/api/meta/exports/workbook';

const normalizeBaseUrl = (baseUrl: string): string => {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
};

const buildWorkbookExportStreamUrl = (path: string): string => {
  if (typeof window !== 'undefined') {
    return path;
  }

  const baseUrl = normalizeBaseUrl(API_BASE_URL);
  return baseUrl ? `${baseUrl}${path}` : path;
};

type WorkbookExportLogQueryParams = {
  cursor?: string;
  limit?: number;
  level?: string;
  stage?: string;
  moduleKey?: string;
};

export const workbookExportApi = {
  getSchema(): Promise<WorkbookExportSchemaResponseDto> {
    return request.get(`${WORKBOOK_EXPORT_BASE}/schema`);
  },

  plan(requestData: WorkbookExportStartRequestDto): Promise<WorkbookExportPlanResponseDto> {
    return request.post(`${WORKBOOK_EXPORT_BASE}/plan`, requestData);
  },

  startJob(requestData: WorkbookExportStartRequestDto): Promise<WorkbookExportStartResponseDto> {
    return request.post(`${WORKBOOK_EXPORT_BASE}/jobs`, requestData);
  },

  getJobStatus(jobId: string): Promise<WorkbookExportJobStatusDto> {
    return request.get(`${WORKBOOK_EXPORT_BASE}/jobs/${encodeURIComponent(jobId)}`);
  },

  listJobLogs(jobId: string, params?: WorkbookExportLogQueryParams): Promise<WorkbookExportLogPageDto> {
    return request.get(`${WORKBOOK_EXPORT_BASE}/jobs/${encodeURIComponent(jobId)}/logs`, { params });
  },

  getJobStreamUrl(jobId: string): string {
    const path = `${WORKBOOK_EXPORT_BASE}/jobs/${encodeURIComponent(jobId)}/stream`;
    return buildWorkbookExportStreamUrl(path);
  },

  getJobResult(jobId: string): Promise<WorkbookExportJobResultDto> {
    return request.get(`${WORKBOOK_EXPORT_BASE}/jobs/${encodeURIComponent(jobId)}/result`);
  },

  cancelJob(jobId: string): Promise<WorkbookExportJobStatusDto> {
    return request.delete(`${WORKBOOK_EXPORT_BASE}/jobs/${encodeURIComponent(jobId)}`);
  },

  downloadFile(jobId: string): Promise<Blob> {
    return request.get(`${WORKBOOK_EXPORT_BASE}/jobs/${encodeURIComponent(jobId)}/download`, {
      responseType: 'blob',
    });
  },
};