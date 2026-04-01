import { API_BASE_URL } from '@/config';
import request from './request';
import type {
  WorkbookImportDryRunOptionsDto,
  WorkbookImportDryRunResponseDto,
  WorkbookImportJobStatusDto,
  WorkbookImportLogPageDto,
  WorkbookImportStartRequestDto,
  WorkbookImportStartResponseDto,
} from '@/models/workbookImport';

export type {
  WorkbookImportDryRunOptionsDto,
  WorkbookImportDryRunResponseDto,
  WorkbookImportEntityProgressDto,
  WorkbookImportIssueDto,
  WorkbookImportJobStatusDto,
  WorkbookImportJobStatusValue,
  WorkbookImportLogEventDto,
  WorkbookImportLogPageDto,
  WorkbookImportResolvedAction,
  WorkbookImportStage,
  WorkbookImportStartRequestDto,
  WorkbookImportStartResponseDto,
} from '@/models/workbookImport';

const WORKBOOK_IMPORT_BASE = '/api/meta/imports/workbook';
const WORKBOOK_DRY_RUN_TIMEOUT = 30000;

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

export const workbookImportApi = {
  dryRun(
    file: File,
    options: WorkbookImportDryRunOptionsDto,
    operator: string = 'admin',
  ): Promise<WorkbookImportDryRunResponseDto> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('options', new Blob([JSON.stringify(options)], { type: 'application/json' }));

    return request.post(`${WORKBOOK_IMPORT_BASE}/dry-run`, formData, {
      params: { operator },
      timeout: WORKBOOK_DRY_RUN_TIMEOUT,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  getSession(importSessionId: string): Promise<WorkbookImportDryRunResponseDto> {
    return request.get(`${WORKBOOK_IMPORT_BASE}/sessions/${encodeURIComponent(importSessionId)}`);
  },

  startImport(data: WorkbookImportStartRequestDto): Promise<WorkbookImportStartResponseDto> {
    return request.post(`${WORKBOOK_IMPORT_BASE}/import`, data);
  },

  getJobStatus(jobId: string): Promise<WorkbookImportJobStatusDto> {
    return request.get(`${WORKBOOK_IMPORT_BASE}/jobs/${encodeURIComponent(jobId)}`);
  },

  listJobLogs(
    jobId: string,
    params?: {
      cursor?: string;
      limit?: number;
      level?: string;
      stage?: string;
      sheetName?: string;
      rowNumber?: number;
    },
  ): Promise<WorkbookImportLogPageDto> {
    return request.get(`${WORKBOOK_IMPORT_BASE}/jobs/${encodeURIComponent(jobId)}/logs`, { params });
  },

  getJobStreamUrl(jobId: string): string {
    const path = `${WORKBOOK_IMPORT_BASE}/jobs/${encodeURIComponent(jobId)}/stream`;
    const baseUrl = normalizeBaseUrl(API_BASE_URL);
    return baseUrl ? `${baseUrl}${path}` : path;
  },
};