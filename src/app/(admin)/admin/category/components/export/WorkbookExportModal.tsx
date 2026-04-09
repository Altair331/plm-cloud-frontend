'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Descriptions,
  Empty,
  Flex,
  Input,
  Progress,
  Result,
  Select,
  Segmented,
  Space,
  Spin,
  Splitter,
  Steps,
  Switch,
  Table,
  Tag,
  Tree,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { DataNode } from 'antd/es/tree';
import {
  CheckCircleFilled,
  CloseCircleFilled,
  DownloadOutlined,
  FileExcelOutlined,
  HolderOutlined,
  InfoCircleOutlined,
  LoadingOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule,
  ModuleRegistry,
  type CellStyle,
  type CellValueChangedEvent,
  type ColDef,
  type ICellRendererParams,
  type RowDragEndEvent,
  themeQuartz,
} from 'ag-grid-community';
import DraggableModal from '@/components/DraggableModal';
import { metaAttributeApi } from '@/services/metaAttribute';
import { metaCategoryApi } from '@/services/metaCategory';
import { workbookExportApi } from '@/services/workbookExport';
import type {
  WorkbookExportJobResultDto,
  WorkbookExportJobStatusDto,
  WorkbookExportLogEventDto,
  WorkbookExportModuleKey,
  WorkbookExportPlanResponseDto,
  WorkbookExportSchemaResponseDto,
  WorkbookExportStartRequestDto,
} from '@/services/workbookExport';
import {
  buildWorkbookExportConfigFromSchema,
  buildWorkbookExportRequest,
  createEmptyWorkbookExportConfig,
  getEnabledWorkbookModuleKeys,
  getInitialWorkbookSelection,
  getWorkbookExportEstimateRows,
  WORKBOOK_EXPORT_MODULE_LABELS,
  WORKBOOK_EXPORT_MODULE_ORDER,
  WORKBOOK_EXPORT_STEPS,
  type WorkbookExportConfig,
  type WorkbookExportFieldConfig,
  type WorkbookExportStep,
} from './workbookTypes';

const { Text } = Typography;

ModuleRegistry.registerModules([AllCommunityModule]);

const LOG_POLL_INTERVAL = 3000;
const SSE_RECONNECT_DELAY = 3000;
const PREVIEW_ROW_LIMIT = 50;
const PREVIEW_SCOPE_ROOT_LIMIT = 3;
const PREVIEW_SCOPE_NODE_LIMIT = 120;
const PREVIEW_CATEGORY_REQUEST_LIMIT = 6;
const PREVIEW_ATTRIBUTE_PAGE_SIZE = 20;
const PREVIEW_ENUM_ATTRIBUTE_LIMIT = 10;

const STATUS_LABELS: Record<string, string> = {
  QUEUED: '已排队',
  RESOLVING_SCOPE: '解析范围中',
  LOADING_CATEGORIES: '加载分类中',
  LOADING_ATTRIBUTES: '加载属性中',
  LOADING_ENUM_OPTIONS: '加载枚举值中',
  BUILDING_WORKBOOK: '生成工作簿中',
  STORING_FILE: '保存文件中',
  COMPLETED: '已完成',
  FAILED: '失败',
  CANCELED: '已取消',
};

const STAGE_LABELS: Record<string, string> = {
  RESOLVING_SCOPE: '解析导出范围',
  LOADING_CATEGORIES: '加载分类数据',
  LOADING_ATTRIBUTES: '加载属性数据',
  LOADING_ENUM_OPTIONS: '加载枚举值数据',
  BUILDING_WORKBOOK: '生成工作簿',
  STORING_FILE: '保存导出文件',
};

interface WorkbookExportModalProps {
  open: boolean;
  checkedKeys: React.Key[];
  treeData: DataNode[];
  defaultBusinessDomain?: string;
  onCancel: () => void;
  onSuccess?: () => void;
}

interface ExportRuntimeState {
  jobId: string | null;
  status: WorkbookExportJobStatusDto | null;
  logs: WorkbookExportLogEventDto[];
  lastLogCursor: string | null;
  sseConnected: boolean;
  result: WorkbookExportJobResultDto | null;
}

interface ExportRuntimeTracker {
  eventSource: EventSource | null;
  pollTimer: number | null;
  reconnectTimer: number | null;
  lastLogCursor: string | null;
  seenLogKeys: Set<string>;
}

interface PreviewScopeCategory {
  id: string;
  code?: string | null;
  name?: string | null;
  businessDomain?: string | null;
  parentId?: string | null;
  path?: string | null;
  level?: number | null;
  status?: string | null;
}

interface PreviewTableRow {
  key: string;
  [fieldKey: string]: string | number | boolean | null | undefined;
}

interface PreviewSheetRow extends PreviewTableRow {
  __sheetKind?: 'header';
}

const createEmptyRuntimeState = (): ExportRuntimeState => ({
  jobId: null,
  status: null,
  logs: [],
  lastLogCursor: null,
  sseConnected: false,
  result: null,
});

const createRuntimeTracker = (): ExportRuntimeTracker => ({
  eventSource: null,
  pollTimer: null,
  reconnectTimer: null,
  lastLogCursor: null,
  seenLogKeys: new Set<string>(),
});

const toExcelColumnLabel = (index: number): string => {
  let current = index + 1;
  let label = '';

  while (current > 0) {
    const remainder = (current - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    current = Math.floor((current - 1) / 26);
  }

  return label;
};

const isTerminalStatus = (status: string | null | undefined): boolean => {
  return status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELED';
};

const getErrorMessage = (error: any, fallback: string): string => {
  return error?.message || error?.error || fallback;
};

const formatDateTime = (value?: string | null): string => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', { hour12: false });
};

const triggerBlobDownload = (blob: Blob, fileName: string) => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
};

const findNodeByKey = (nodes: DataNode[], key: React.Key): DataNode | null => {
  for (const node of nodes) {
    if (node.key === key) {
      return node;
    }
    if (node.children?.length) {
      const found = findNodeByKey(node.children, key);
      if (found) {
        return found;
      }
    }
  }
  return null;
};

const collectSelectedNodes = (treeData: DataNode[], selectedKeys: string[]): DataNode[] => {
  return selectedKeys
    .map((key) => findNodeByKey(treeData, key))
    .filter((node): node is DataNode => Boolean(node));
};

const collectPersistedTreeKeys = (nodes: DataNode[]): string[] => {
  const keys: string[] = [];

  const visit = (items: DataNode[]) => {
    items.forEach((item) => {
      const key = String(item.key);
      if (!key.startsWith('local_')) {
        keys.push(key);
      }
      if (item.children?.length) {
        visit(item.children);
      }
    });
  };

  visit(nodes);
  return keys;
};

const collectPersistedRootKeys = (nodes: DataNode[]): string[] => {
  return nodes
    .map((node) => String(node.key))
    .filter((key) => !key.startsWith('local_'));
};

const resolveBusinessDomains = (nodes: DataNode[], fallback?: string): string[] => {
  const domains = nodes
    .map((node) => ((node as any)?.dataRef?.businessDomain as string | undefined) || fallback)
    .filter((value): value is string => Boolean(value && value.trim()));

  return Array.from(new Set(domains));
};

const getModuleProgress = (
  status: WorkbookExportJobStatusDto | null,
  moduleKey: WorkbookExportModuleKey,
) => {
  if (!status?.progress) {
    return { total: 0, processed: 0, exported: 0, failed: 0 };
  }

  switch (moduleKey) {
    case 'CATEGORY':
      return status.progress.categories;
    case 'ATTRIBUTE':
      return status.progress.attributes;
    case 'ENUM_OPTION':
      return status.progress.enumOptions;
    default:
      return { total: 0, processed: 0, exported: 0, failed: 0 };
  }
};

const extractNodeRef = (node: DataNode | null | undefined) => {
  return (node as any)?.dataRef as {
    id?: string;
    code?: string;
    name?: string;
    businessDomain?: string;
    parentId?: string | null;
    path?: string | null;
    level?: number;
    status?: string;
  } | undefined;
};


const formatPreviewValue = (value: unknown): string | number | boolean => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }
  if (Array.isArray(value)) {
    return value.length ? value.join(', ') : '—';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
};

const buildCategoryPreviewRecord = (detail: any, fallback?: PreviewScopeCategory): PreviewTableRow => {
  const latestVersion = detail?.latestVersion ?? {};
  return {
    key: String(detail?.id || fallback?.id || Math.random()),
    categoryId: detail?.id ?? fallback?.id,
    businessDomain: detail?.businessDomain ?? fallback?.businessDomain,
    categoryCode: detail?.code ?? fallback?.code,
    categoryName: latestVersion?.name ?? detail?.name ?? fallback?.name,
    status: detail?.status ?? fallback?.status,
    parentId: detail?.parentId ?? fallback?.parentId,
    parentCode: detail?.parentCode,
    parentName: detail?.parentName,
    rootId: detail?.rootId,
    rootCode: detail?.rootCode,
    rootName: detail?.rootName,
    path: detail?.path ?? fallback?.path,
    fullPathName: detail?.path ?? fallback?.path,
    level: detail?.level ?? fallback?.level,
    depth: detail?.depth,
    sortOrder: detail?.sort,
    isLeaf: detail?.leaf,
    hasChildren: detail?.leaf === undefined ? undefined : !detail.leaf,
    externalCode: detail?.externalCode,
    codeKeyManualOverride: detail?.codeKeyManualOverride,
    codeKeyFrozen: detail?.codeKeyFrozen,
    generatedRuleCode: detail?.generatedRuleCode,
    generatedRuleVersionNo: detail?.generatedRuleVersionNo,
    copiedFromCategoryId: detail?.copiedFromCategoryId,
    latestVersionNo: detail?.version,
    latestVersionDate: latestVersion?.versionDate,
    latestVersionUpdatedBy: latestVersion?.updatedBy,
    latestVersionDescription: latestVersion?.description,
    createdAt: detail?.createdAt,
    createdBy: detail?.createdBy,
    modifiedAt: detail?.modifiedAt,
    modifiedBy: detail?.modifiedBy,
  };
};

const buildAttributePreviewRecord = (
  detail: any,
  listItem: any,
  categoryMeta?: PreviewScopeCategory,
): PreviewTableRow => {
  const latestVersion = detail?.latestVersion ?? {};
  return {
    key: String(detail?.key || listItem?.key || Math.random()),
    attributeId: detail?.id ?? listItem?.id,
    businessDomain: detail?.businessDomain ?? categoryMeta?.businessDomain,
    categoryId: detail?.categoryId ?? categoryMeta?.id,
    categoryCode: detail?.categoryCode ?? listItem?.categoryCode ?? categoryMeta?.code,
    categoryName: detail?.categoryName ?? categoryMeta?.name,
    attributeKey: detail?.key ?? listItem?.key,
    status: detail?.status ?? listItem?.status,
    hasLov: detail?.hasLov ?? listItem?.hasLov,
    autoBindKey: detail?.autoBindKey,
    keyManualOverride: detail?.keyManualOverride,
    keyFrozen: detail?.keyFrozen,
    generatedRuleCode: detail?.generatedRuleCode,
    generatedRuleVersionNo: detail?.generatedRuleVersionNo,
    latestVersionId: latestVersion?.id,
    latestVersionNo: latestVersion?.versionNo ?? listItem?.latestVersionNo,
    categoryVersionId: latestVersion?.categoryVersionId,
    resolvedCodePrefix: latestVersion?.resolvedCodePrefix,
    structureHash: latestVersion?.hash,
    displayName: latestVersion?.displayName ?? listItem?.displayName,
    description: latestVersion?.description,
    attributeField: latestVersion?.attributeField ?? listItem?.attributeField,
    dataType: latestVersion?.dataType ?? listItem?.dataType,
    unit: latestVersion?.unit ?? listItem?.unit,
    defaultValue: latestVersion?.defaultValue,
    required: latestVersion?.required ?? listItem?.required,
    unique: latestVersion?.unique ?? listItem?.unique,
    hidden: latestVersion?.hidden ?? listItem?.hidden,
    readOnly: latestVersion?.readOnly ?? listItem?.readOnly,
    searchable: latestVersion?.searchable ?? listItem?.searchable,
    lovKey: detail?.lovKey ?? latestVersion?.lovKey,
    minValue: latestVersion?.minValue,
    maxValue: latestVersion?.maxValue,
    step: latestVersion?.step,
    precision: latestVersion?.precision,
    trueLabel: latestVersion?.trueLabel,
    falseLabel: latestVersion?.falseLabel,
    createdAt: detail?.createdAt ?? listItem?.createdAt,
    createdBy: detail?.createdBy,
    modifiedAt: detail?.modifiedAt,
    modifiedBy: detail?.modifiedBy,
  };
};

const buildEnumPreviewRecord = (
  option: any,
  detail: any,
  listItem: any,
  categoryMeta?: PreviewScopeCategory,
): PreviewTableRow => {
  const latestVersion = detail?.latestVersion ?? {};
  return {
    key: `${detail?.key || listItem?.key || 'attr'}_${option?.code || option?.value || Math.random()}`,
    businessDomain: detail?.businessDomain ?? categoryMeta?.businessDomain,
    categoryId: detail?.categoryId ?? categoryMeta?.id,
    categoryCode: detail?.categoryCode ?? listItem?.categoryCode ?? categoryMeta?.code,
    categoryName: detail?.categoryName ?? categoryMeta?.name,
    attributeId: detail?.id ?? listItem?.id,
    attributeKey: detail?.key ?? listItem?.key,
    attributeDisplayName: latestVersion?.displayName ?? listItem?.displayName,
    attributeField: latestVersion?.attributeField ?? listItem?.attributeField,
    attributeDataType: latestVersion?.dataType ?? listItem?.dataType,
    lovDefId: detail?.lovDefId,
    lovKey: detail?.lovKey ?? latestVersion?.lovKey,
    lovStatus: detail?.lovStatus,
    lovDescription: detail?.lovDescription,
    sourceAttributeKey: detail?.sourceAttributeKey,
    lovKeyManualOverride: detail?.lovKeyManualOverride,
    lovKeyFrozen: detail?.lovKeyFrozen,
    lovGeneratedRuleCode: detail?.lovGeneratedRuleCode,
    lovGeneratedRuleVersionNo: detail?.lovGeneratedRuleVersionNo,
    lovCreatedAt: detail?.lovCreatedAt,
    lovCreatedBy: detail?.lovCreatedBy,
    lovVersionId: detail?.lovVersionId,
    lovVersionNo: detail?.lovVersionNo,
    lovResolvedCodePrefix: detail?.lovResolvedCodePrefix,
    lovHash: detail?.lovHash,
    lovVersionCreatedAt: detail?.lovVersionCreatedAt,
    lovVersionCreatedBy: detail?.lovVersionCreatedBy,
    optionCode: option?.code,
    optionName: option?.name,
    optionLabel: option?.label,
    optionOrder: option?.order,
    optionDisabled: option?.disabled,
  };
};

const WorkbookExportModal: React.FC<WorkbookExportModalProps> = ({
  open,
  checkedKeys,
  treeData,
  defaultBusinessDomain,
  onCancel,
  onSuccess,
}) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const previewGridRef = useRef<AgGridReact>(null);

  const [currentStep, setCurrentStep] = useState<WorkbookExportStep>(0);
  const [schema, setSchema] = useState<WorkbookExportSchemaResponseDto | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [config, setConfig] = useState<WorkbookExportConfig>(() => createEmptyWorkbookExportConfig());
  const [selectedNodeKeys, setSelectedNodeKeys] = useState<string[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [activeModule, setActiveModule] = useState<WorkbookExportModuleKey>('CATEGORY');
  const [planLoading, setPlanLoading] = useState(false);
  const [planResult, setPlanResult] = useState<WorkbookExportPlanResponseDto | null>(null);
  const [runtime, setRuntime] = useState<ExportRuntimeState>(() => createEmptyRuntimeState());
  const [exporting, setExporting] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewTableRow[]>([]);

  const runtimeTrackerRef = useRef<ExportRuntimeTracker>(createRuntimeTracker());
  const runtimeStateRef = useRef<ExportRuntimeState>(createEmptyRuntimeState());
  const planRequestSignatureRef = useRef<string | null>(null);
  const resultLoadedJobIdRef = useRef<string | null>(null);
  const previewRequestIdRef = useRef(0);

  runtimeStateRef.current = runtime;

  const resetRuntime = useCallback(() => {
    const tracker = runtimeTrackerRef.current;

    if (tracker.eventSource) {
      tracker.eventSource.close();
      tracker.eventSource = null;
    }
    if (tracker.pollTimer !== null) {
      window.clearInterval(tracker.pollTimer);
      tracker.pollTimer = null;
    }
    if (tracker.reconnectTimer !== null) {
      window.clearTimeout(tracker.reconnectTimer);
      tracker.reconnectTimer = null;
    }

    tracker.lastLogCursor = null;
    tracker.seenLogKeys.clear();
    resultLoadedJobIdRef.current = null;
    setRuntime(createEmptyRuntimeState());
    setExporting(false);
    setDownloadLoading(false);
  }, []);

  const selectedNodes = useMemo(() => {
    return collectSelectedNodes(treeData, selectedNodeKeys);
  }, [selectedNodeKeys, treeData]);

  const selectionBusinessDomains = useMemo(() => {
    return resolveBusinessDomains(selectedNodes, defaultBusinessDomain);
  }, [defaultBusinessDomain, selectedNodes]);

  const resolvedBusinessDomain = selectionBusinessDomains.length === 1
    ? selectionBusinessDomains[0]
    : selectionBusinessDomains.length === 0
      ? defaultBusinessDomain || null
      : null;

  const hasMixedBusinessDomains = selectionBusinessDomains.length > 1;

  const enabledModuleKeys = useMemo(() => {
    return getEnabledWorkbookModuleKeys(config);
  }, [config]);

  const currentModuleConfig = config.modules[activeModule];

  const enabledColumns = useMemo(() => {
    return currentModuleConfig?.columns.filter((column) => column.enabled) ?? [];
  }, [currentModuleConfig]);

  const availableColumns = useMemo(() => {
    return currentModuleConfig?.columns.filter((column) => !column.enabled) ?? [];
  }, [currentModuleConfig]);

  const exportRequest = useMemo<WorkbookExportStartRequestDto | null>(() => {
    if (!resolvedBusinessDomain || selectedNodeKeys.length === 0 || enabledModuleKeys.length === 0) {
      return null;
    }

    const categoryIds = selectedNodeKeys.filter((key) => !key.startsWith('local_'));
    if (!categoryIds.length) {
      return null;
    }

    return buildWorkbookExportRequest(config, resolvedBusinessDomain, categoryIds, 'admin');
  }, [config, enabledModuleKeys.length, resolvedBusinessDomain, selectedNodeKeys]);

  const exportRequestSignature = useMemo(() => {
    return exportRequest ? JSON.stringify(exportRequest) : '';
  }, [exportRequest]);

  const estimateRows = useMemo(() => {
    return getWorkbookExportEstimateRows(
      planResult?.estimate.categoryRows,
      planResult?.estimate.attributeRows,
      planResult?.estimate.enumOptionRows,
    );
  }, [planResult]);

  const allTreeExpandedKeys = useMemo(() => collectPersistedTreeKeys(treeData), [treeData]);
  const allRootSelectableKeys = useMemo(() => collectPersistedRootKeys(treeData), [treeData]);

  const activeModuleOptions = useMemo(() => {
    return WORKBOOK_EXPORT_MODULE_ORDER.map((moduleKey) => ({
      value: moduleKey,
      label: `${WORKBOOK_EXPORT_MODULE_LABELS[moduleKey]}表`,
      disabled: !config.modules[moduleKey].enabled,
    }));
  }, [config.modules]);

  const selectableModuleKeys = useMemo(() => {
    return WORKBOOK_EXPORT_MODULE_ORDER.filter((moduleKey) => config.modules[moduleKey].enabled);
  }, [config.modules]);

  const loadSchema = useCallback(async () => {
    setSchemaLoading(true);
    setSchemaError(null);
    try {
      const nextSchema = await workbookExportApi.getSchema();
      const nextConfig = buildWorkbookExportConfigFromSchema(nextSchema);
      setSchema(nextSchema);
      setConfig(nextConfig);
      setActiveModule(getEnabledWorkbookModuleKeys(nextConfig)[0] ?? 'CATEGORY');
    } catch (error: any) {
      setSchemaError(getErrorMessage(error, '加载导出 schema 失败'));
    } finally {
      setSchemaLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      planRequestSignatureRef.current = null;
      resetRuntime();
      setCurrentStep(0);
      setSchema(null);
      setSchemaError(null);
      setPlanResult(null);
      setPlanLoading(false);
      setPreviewRows([]);
      setPreviewError(null);
      setPreviewLoading(false);
      setConfig(createEmptyWorkbookExportConfig());
      setSelectedNodeKeys([]);
      setExpandedKeys([]);
      return;
    }

  planRequestSignatureRef.current = null;
    resetRuntime();
    setCurrentStep(0);
    setPlanResult(null);
    setPlanLoading(false);
    setPreviewRows([]);
    setPreviewError(null);
    setPreviewLoading(false);
    setSelectedNodeKeys(getInitialWorkbookSelection(checkedKeys));
    setExpandedKeys(allTreeExpandedKeys);
    void loadSchema();
  }, [allTreeExpandedKeys, checkedKeys, loadSchema, open, resetRuntime]);

  useEffect(() => {
    if (selectableModuleKeys.length === 0) {
      return;
    }

    if (!selectableModuleKeys.includes(activeModule)) {
      setActiveModule(selectableModuleKeys[0]);
    }
  }, [activeModule, selectableModuleKeys]);

  useEffect(() => {
    if (planRequestSignatureRef.current === exportRequestSignature) {
      return;
    }

    setPlanResult(null);
  }, [exportRequestSignature]);

  const updateModuleConfig = useCallback((
    moduleKey: WorkbookExportModuleKey,
    updater: (moduleConfig: WorkbookExportConfig['modules'][WorkbookExportModuleKey]) => WorkbookExportConfig['modules'][WorkbookExportModuleKey],
  ) => {
    setConfig((prev) => ({
      ...prev,
      modules: {
        ...prev.modules,
        [moduleKey]: updater(prev.modules[moduleKey]),
      },
    }));
  }, []);

  const loadPlan = useCallback(async (options?: { force?: boolean; showLoading?: boolean; showError?: boolean }) => {
    const force = options?.force ?? false;
    const showLoading = options?.showLoading ?? false;
    const showError = options?.showError ?? (force || showLoading);

    if (!exportRequest) {
      return null;
    }

    if (!force && planRequestSignatureRef.current === exportRequestSignature) {
      return planResult;
    }

    planRequestSignatureRef.current = exportRequestSignature;

    if (showLoading) {
      setPlanLoading(true);
    }

    try {
      const response = await workbookExportApi.plan(exportRequest);
      setPlanResult(response);
      return response;
    } catch (error: any) {
      if (showError) {
        message.error(getErrorMessage(error, '导出计划预校验失败'));
      }
      return null;
    } finally {
      if (showLoading) {
        setPlanLoading(false);
      }
    }
  }, [exportRequest, exportRequestSignature, message, planResult]);

  const resolveScopeCategories = useCallback(async (): Promise<PreviewScopeCategory[]> => {
    const persistedKeys = selectedNodeKeys.filter((key) => !key.startsWith('local_'));
    if (!persistedKeys.length) {
      return [];
    }

    const previewRootKeys = persistedKeys.slice(0, PREVIEW_SCOPE_ROOT_LIMIT);

    if (!config.includeChildren) {
      return previewRootKeys.map((key) => {
        const nodeRef = extractNodeRef(findNodeByKey(treeData, key));
        return {
          id: key,
          code: nodeRef?.code,
          name: nodeRef?.name,
          businessDomain: nodeRef?.businessDomain ?? resolvedBusinessDomain,
          parentId: nodeRef?.parentId,
          path: nodeRef?.path,
          level: nodeRef?.level,
          status: nodeRef?.status,
        };
      });
    }

    const merged = new Map<string, PreviewScopeCategory>();
    const responses = await Promise.allSettled(
      previewRootKeys.map((categoryId) => metaCategoryApi.getCategorySubtree({
        parentId: categoryId,
        includeRoot: true,
        mode: 'FLAT',
        status: 'ALL',
        nodeLimit: PREVIEW_SCOPE_NODE_LIMIT,
      })),
    );

    for (const response of responses) {
      if (response.status !== 'fulfilled') {
        continue;
      }
      const rows = Array.isArray(response.value.data) ? response.value.data : [];
      for (const row of rows as any[]) {
        const key = String(row?.id || '');
        if (!key || merged.has(key)) {
          continue;
        }
        if (merged.size >= PREVIEW_SCOPE_NODE_LIMIT) {
          break;
        }
        merged.set(key, {
          id: key,
          code: row?.code,
          name: row?.name,
          businessDomain: row?.businessDomain ?? resolvedBusinessDomain,
          parentId: row?.parentId ? String(row.parentId) : null,
          path: row?.path,
          level: row?.level,
          status: row?.status,
        });
      }

      if (merged.size >= PREVIEW_SCOPE_NODE_LIMIT) {
        break;
      }
    }

    return Array.from(merged.values());
  }, [config.includeChildren, resolvedBusinessDomain, selectedNodeKeys, treeData]);


  const loadPreviewRows = useCallback(async () => {
    if (!open || currentStep !== 1 || !resolvedBusinessDomain || !enabledColumns.length) {
      setPreviewRows([]);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;
    setPreviewLoading(true);
    setPreviewError(null);

    try {
      const scopeCategories = await resolveScopeCategories();
      const categoryMapByCode = new Map(scopeCategories.map((item) => [item.code || '', item]));
      let rows: PreviewTableRow[] = [];

      if (activeModule === 'CATEGORY') {
        const targets = scopeCategories.slice(0, PREVIEW_ROW_LIMIT);
        const details = await Promise.allSettled(targets.map((item) => metaCategoryApi.getCategoryDetail(item.id)));
        rows = details.map((result, index) => {
          const fallback = targets[index];
          if (result.status === 'fulfilled') {
            return buildCategoryPreviewRecord(result.value as any, fallback);
          }
          return buildCategoryPreviewRecord({}, fallback);
        });
      }

      if (activeModule === 'ATTRIBUTE') {
        const categoryCodes = Array.from(new Set(
          scopeCategories
            .map((item) => item.code)
            .filter((value): value is string => Boolean(value)),
        )).slice(0, PREVIEW_CATEGORY_REQUEST_LIMIT);
        const listResults = await Promise.allSettled(
          categoryCodes.map((categoryCode) => metaAttributeApi.listAttributes({
            businessDomain: resolvedBusinessDomain,
            categoryCode,
            page: 0,
            size: PREVIEW_ATTRIBUTE_PAGE_SIZE,
          })),
        );
        const items = listResults.flatMap((result) => result.status === 'fulfilled' ? result.value.content : []).slice(0, PREVIEW_ROW_LIMIT);
        const details = await Promise.allSettled(items.map((item) => metaAttributeApi.getAttributeDetail(item.key, resolvedBusinessDomain, false)));
        rows = details.map((result, index) => {
          const listItem = items[index] as any;
          const categoryMeta = categoryMapByCode.get(listItem?.categoryCode || '');
          if (result.status === 'fulfilled') {
            return buildAttributePreviewRecord(result.value as any, listItem, categoryMeta);
          }
          return buildAttributePreviewRecord({}, listItem, categoryMeta);
        });
      }

      if (activeModule === 'ENUM_OPTION') {
        const categoryCodes = Array.from(new Set(
          scopeCategories
            .map((item) => item.code)
            .filter((value): value is string => Boolean(value)),
        )).slice(0, PREVIEW_CATEGORY_REQUEST_LIMIT);
        const listResults = await Promise.allSettled(
          categoryCodes.map((categoryCode) => metaAttributeApi.listAttributes({
            businessDomain: resolvedBusinessDomain,
            categoryCode,
            page: 0,
            size: PREVIEW_ATTRIBUTE_PAGE_SIZE,
          })),
        );
        const attributeItems = listResults.flatMap((result) => result.status === 'fulfilled' ? result.value.content : []);
        const enumCandidates = attributeItems
          .filter((item: any) => ['enum', 'multi-enum'].includes(String(item?.dataType)) || item?.hasLov)
          .slice(0, PREVIEW_ENUM_ATTRIBUTE_LIMIT);
        const enumRows: PreviewTableRow[] = [];

        for (const item of enumCandidates) {
          if (enumRows.length >= PREVIEW_ROW_LIMIT) {
            break;
          }
          try {
            const detail = await metaAttributeApi.getAttributeDetail(item.key, resolvedBusinessDomain, true);
            const options = Array.isArray((detail as any)?.lovValues) ? (detail as any).lovValues : [];
            const categoryMeta = categoryMapByCode.get(item.categoryCode || '');
            for (const option of options) {
              enumRows.push(buildEnumPreviewRecord(option, detail as any, item, categoryMeta));
              if (enumRows.length >= PREVIEW_ROW_LIMIT) {
                break;
              }
            }
          } catch {
            continue;
          }
        }

        rows = enumRows;
      }

      if (previewRequestIdRef.current !== requestId) {
        return;
      }

      setPreviewRows(rows);
      setPreviewLoading(false);
    } catch (error: any) {
      if (previewRequestIdRef.current !== requestId) {
        return;
      }
      setPreviewRows([]);
      setPreviewError(getErrorMessage(error, '加载预览数据失败'));
      setPreviewLoading(false);
    }
  }, [activeModule, currentStep, enabledColumns.length, open, resolveScopeCategories, resolvedBusinessDomain]);

  useEffect(() => {
    void loadPreviewRows();
  }, [loadPreviewRows]);

  useEffect(() => {
    if (!open || currentStep !== 1 || !exportRequest) {
      return;
    }

    if (planRequestSignatureRef.current === exportRequestSignature) {
      return;
    }

    void loadPlan();
  }, [currentStep, exportRequest, exportRequestSignature, loadPlan, open]);

  const mergeLogs = useCallback((incoming: WorkbookExportLogEventDto[] = []) => {
    if (!incoming.length) {
      return;
    }

    setRuntime((prev) => {
      const tracker = runtimeTrackerRef.current;
      const nextLogs = [...prev.logs];
      let changed = false;
      let nextCursor = prev.lastLogCursor ?? tracker.lastLogCursor;

      for (const item of incoming) {
        const key = item.cursor ?? String(item.sequence ?? `${item.timestamp ?? ''}-${item.message}`);
        if (tracker.seenLogKeys.has(key)) {
          continue;
        }
        tracker.seenLogKeys.add(key);
        nextLogs.push(item);
        changed = true;
        if (item.cursor) {
          tracker.lastLogCursor = item.cursor;
          nextCursor = item.cursor;
        }
      }

      if (!changed && nextCursor === prev.lastLogCursor) {
        return prev;
      }

      nextLogs.sort((left, right) => (left.sequence ?? 0) - (right.sequence ?? 0));
      return {
        ...prev,
        logs: nextLogs.slice(-500),
        lastLogCursor: nextCursor,
      };
    });
  }, []);

  const syncStatus = useCallback((snapshot: WorkbookExportJobStatusDto) => {
    setRuntime((prev) => ({
      ...prev,
      status: snapshot,
      lastLogCursor: snapshot.latestLogCursor ?? prev.lastLogCursor,
    }));

    if (snapshot.latestLogCursor) {
      runtimeTrackerRef.current.lastLogCursor = snapshot.latestLogCursor;
    }

    mergeLogs(snapshot.latestLogs ?? []);

    if (isTerminalStatus(snapshot.status)) {
      setExporting(false);
    }
  }, [mergeLogs]);

  const refreshStatus = useCallback(async (jobId: string) => {
    const snapshot = await workbookExportApi.getJobStatus(jobId);
    syncStatus(snapshot);
    return snapshot;
  }, [syncStatus]);

  const pullLogs = useCallback(async (jobId: string) => {
    const currentRuntime = runtimeStateRef.current;
    const hasLocalLogs = currentRuntime.logs.length > 0;
    const hasStatusLogs = (currentRuntime.status?.latestLogs?.length ?? 0) > 0;
    const cursor = !hasLocalLogs && !hasStatusLogs
      ? undefined
      : runtimeTrackerRef.current.lastLogCursor ?? undefined;

    const page = await workbookExportApi.listJobLogs(jobId, { cursor, limit: 100 });
    mergeLogs(page.items ?? []);
    if (page.nextCursor) {
      runtimeTrackerRef.current.lastLogCursor = page.nextCursor;
      setRuntime((prev) => ({ ...prev, lastLogCursor: page.nextCursor }));
    }
    return page;
  }, [mergeLogs]);

  const stopTracking = useCallback(() => {
    const tracker = runtimeTrackerRef.current;

    if (tracker.eventSource) {
      tracker.eventSource.close();
      tracker.eventSource = null;
    }
    if (tracker.pollTimer !== null) {
      window.clearInterval(tracker.pollTimer);
      tracker.pollTimer = null;
    }
    if (tracker.reconnectTimer !== null) {
      window.clearTimeout(tracker.reconnectTimer);
      tracker.reconnectTimer = null;
    }

    setRuntime((prev) => (prev.sseConnected ? { ...prev, sseConnected: false } : prev));
  }, []);

  const startTracking = useCallback((jobId: string) => {
    const tracker = runtimeTrackerRef.current;
    let disposed = false;
    const streamUrl = workbookExportApi.getJobStreamUrl(jobId);

    const scheduleReconnect = () => {
      if (disposed || tracker.reconnectTimer !== null) {
        return;
      }

      tracker.reconnectTimer = window.setTimeout(() => {
        tracker.reconnectTimer = null;
        if (disposed || tracker.eventSource) {
          return;
        }
        openStream();
      }, SSE_RECONNECT_DELAY);
    };

    const openStream = () => {
      if (disposed || tracker.eventSource) {
        return;
      }

      const stream = new EventSource(streamUrl, { withCredentials: true });
      tracker.eventSource = stream;

      const handleProgress = (event: Event) => {
        if (disposed) {
          return;
        }
        try {
          const snapshot = JSON.parse((event as MessageEvent<string>).data) as WorkbookExportJobStatusDto;
          syncStatus(snapshot);
        } catch {
          void refreshStatus(jobId);
        }
      };

      const handleLog = (event: Event) => {
        if (disposed) {
          return;
        }
        try {
          const logEvent = JSON.parse((event as MessageEvent<string>).data) as WorkbookExportLogEventDto;
          mergeLogs([logEvent]);
        } catch {
          void pullLogs(jobId);
        }
      };

      stream.onopen = () => {
        if (disposed) {
          return;
        }
        if (tracker.reconnectTimer !== null) {
          window.clearTimeout(tracker.reconnectTimer);
          tracker.reconnectTimer = null;
        }
        setRuntime((prev) => (prev.sseConnected ? prev : { ...prev, sseConnected: true }));
      };

      stream.onerror = () => {
        if (disposed) {
          return;
        }

        if (tracker.eventSource === stream) {
          stream.close();
          tracker.eventSource = null;
        }

        setRuntime((prev) => (prev.sseConnected ? { ...prev, sseConnected: false } : prev));

        void (async () => {
          try {
            const snapshot = await refreshStatus(jobId);
            await pullLogs(jobId);
            if (!disposed && !isTerminalStatus(snapshot.status)) {
              scheduleReconnect();
            }
          } catch {
            if (!disposed) {
              scheduleReconnect();
            }
          }
        })();
      };

      stream.addEventListener('progress', handleProgress);
      stream.addEventListener('log', handleLog);
      stream.addEventListener('completed', () => {
        void refreshStatus(jobId);
        void pullLogs(jobId);
      });
      stream.addEventListener('failed', () => {
        void refreshStatus(jobId);
        void pullLogs(jobId);
      });
      stream.addEventListener('canceled', () => {
        void refreshStatus(jobId);
        void pullLogs(jobId);
      });
    };

    openStream();
    void refreshStatus(jobId);
    void pullLogs(jobId);

    if (tracker.pollTimer === null) {
      tracker.pollTimer = window.setInterval(() => {
        void refreshStatus(jobId);
        void pullLogs(jobId);
      }, LOG_POLL_INTERVAL);
    }

    return () => {
      disposed = true;
      stopTracking();
    };
  }, [mergeLogs, pullLogs, refreshStatus, stopTracking, syncStatus]);

  useEffect(() => {
    if (!open || !runtime.jobId || isTerminalStatus(runtime.status?.status)) {
      return undefined;
    }

    return startTracking(runtime.jobId);
  }, [open, runtime.jobId, runtime.status?.status, startTracking]);

  useEffect(() => {
    const jobId = runtime.jobId;
    if (!jobId || runtime.status?.status !== 'COMPLETED' || resultLoadedJobIdRef.current === jobId) {
      return;
    }

    let cancelled = false;

    const loadResult = async () => {
      try {
        const result = await workbookExportApi.getJobResult(jobId);
        if (cancelled) {
          return;
        }
        resultLoadedJobIdRef.current = jobId;
        setRuntime((prev) => ({ ...prev, result }));
      } catch (error: any) {
        if (!cancelled) {
          message.error(getErrorMessage(error, '加载导出结果失败'));
        }
      }
    };

    void loadResult();

    return () => {
      cancelled = true;
    };
  }, [message, runtime.jobId, runtime.status?.status]);

  useEffect(() => {
    if (!runtime.jobId || !isTerminalStatus(runtime.status?.status)) {
      return;
    }
    stopTracking();
  }, [runtime.jobId, runtime.status?.status, stopTracking]);

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  const handleStartExport = useCallback(async () => {
    if (!exportRequest) {
      message.warning('请先完成导出范围与字段配置');
      return;
    }

    const planned = await loadPlan({ force: true });
    const requestToStart = planned?.normalizedRequest ?? exportRequest;
    if (!planned) {
      message.warning('预校验未在限定时间内完成，已直接按当前配置启动导出任务');
    }

    resetRuntime();
    setCurrentStep(2);
    setExporting(true);

    try {
      const response = await workbookExportApi.startJob(requestToStart);
      setRuntime({
        ...createEmptyRuntimeState(),
        jobId: response.jobId,
      });
      message.success('导出任务已创建');
    } catch (error: any) {
      setExporting(false);
      message.error(getErrorMessage(error, '启动导出任务失败'));
    }
  }, [exportRequest, loadPlan, message, resetRuntime]);

  const handleCancelJob = useCallback(async () => {
    if (!runtime.jobId || isTerminalStatus(runtime.status?.status)) {
      return;
    }

    try {
      const response = await workbookExportApi.cancelJob(runtime.jobId);
      syncStatus(response);
      message.success('导出任务已取消');
    } catch (error: any) {
      message.error(getErrorMessage(error, '取消导出任务失败'));
    }
  }, [message, runtime.jobId, runtime.status?.status, syncStatus]);

  const handleDownload = useCallback(async () => {
    if (!runtime.jobId || !runtime.result?.file) {
      message.warning('当前尚无可下载的导出文件');
      return;
    }

    setDownloadLoading(true);
    try {
      const blob = await workbookExportApi.downloadFile(runtime.jobId);
      triggerBlobDownload(blob, runtime.result.file.fileName);
      message.success('导出文件已开始下载');
      onSuccess?.();
    } catch (error: any) {
      message.error(getErrorMessage(error, '下载导出文件失败'));
    } finally {
      setDownloadLoading(false);
    }
  }, [message, onSuccess, runtime.jobId, runtime.result?.file]);

  const mappingIndexCellStyle = useMemo<CellStyle>(() => ({
    textAlign: 'center',
    color: token.colorTextSecondary,
    fontWeight: 600,
  }), [token.colorTextSecondary]);

  const mappingCenteredCellStyle = useMemo<CellStyle>(() => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }), []);

  const logColumns = useMemo<ColumnsType<WorkbookExportLogEventDto>>(() => {
    return [
      {
        title: '时间',
        dataIndex: 'timestamp',
        width: 170,
        render: (value) => <Text type="secondary">{formatDateTime(value)}</Text>,
      },
      {
        title: '级别',
        dataIndex: 'level',
        width: 88,
        render: (value) => {
          const color = value === 'ERROR' ? 'error' : value === 'WARN' ? 'warning' : 'default';
          return <Tag color={color}>{value || 'INFO'}</Tag>;
        },
      },
      {
        title: '阶段',
        dataIndex: 'stage',
        width: 160,
        render: (value) => STAGE_LABELS[value || ''] || value || '—',
      },
      {
        title: '模块',
        dataIndex: 'moduleKey',
        width: 110,
        render: (value) => value && WORKBOOK_EXPORT_MODULE_LABELS[value as WorkbookExportModuleKey]
          ? WORKBOOK_EXPORT_MODULE_LABELS[value as WorkbookExportModuleKey]
          : (value || '—'),
      },
      {
        title: '消息',
        dataIndex: 'message',
        render: (value) => value || '—',
      },
    ];
  }, []);

  const previewGridKey = useMemo(() => {
    return [activeModule, ...currentModuleConfig.columns.map((column) => `${column.id}:${column.headerText}:${column.enabled}`)].join('|');
  }, [activeModule, currentModuleConfig.columns]);

  const previewColumnLetterMap = useMemo(() => {
    const map = new Map<string, string>();
    enabledColumns.forEach((column, index) => {
      map.set(column.id, toExcelColumnLabel(index));
    });
    return map;
  }, [enabledColumns]);

  const previewPinnedTopRowData = useMemo<PreviewSheetRow[]>(() => {
    if (enabledColumns.length === 0) {
      return [];
    }

    const headerRow: PreviewSheetRow = {
      key: '__workbook_preview_header__',
      __sheetKind: 'header',
    };
    enabledColumns.forEach((column) => {
      headerRow[column.fieldKey] = column.headerText || column.defaultExportHeader || column.defaultHeader;
    });
    return [headerRow];
  }, [enabledColumns]);

  const previewGridRows = useMemo<PreviewTableRow[]>(() => {
    return previewRows.map((row) => {
      const nextRow: PreviewTableRow = { key: row.key };
      enabledColumns.forEach((column) => {
        nextRow[column.fieldKey] = formatPreviewValue(row[column.fieldKey]);
      });
      return nextRow;
    });
  }, [enabledColumns, previewRows]);

  const handleHeaderCellValueChanged = useCallback((event: CellValueChangedEvent<WorkbookExportFieldConfig>) => {
    if (!event.data || event.colDef.field !== 'headerText') {
      return;
    }

    const nextHeader = String(event.newValue ?? '').trim();
    const previousHeader = String(event.oldValue ?? '').trim();
    if (!nextHeader) {
      event.node.setDataValue('headerText', previousHeader || event.data.headerText || event.data.defaultExportHeader || event.data.defaultHeader);
      return;
    }

    if (nextHeader === previousHeader) {
      return;
    }

    updateModuleConfig(activeModule, (moduleConfig) => ({
      ...moduleConfig,
      columns: moduleConfig.columns.map((column) => column.id === event.data?.id ? { ...column, headerText: nextHeader } : column),
    }));
  }, [activeModule, updateModuleConfig]);

  const handleMappingRowDragEnd = useCallback((event: RowDragEndEvent<WorkbookExportFieldConfig>) => {
    const reorderedColumns: WorkbookExportFieldConfig[] = [];
    event.api.forEachNode((node) => {
      if (node.data) {
        reorderedColumns.push(node.data);
      }
    });

    if (reorderedColumns.length !== enabledColumns.length) {
      return;
    }

    const hiddenColumns = currentModuleConfig.columns.filter((column) => !column.enabled);

    updateModuleConfig(activeModule, (moduleConfig) => ({
      ...moduleConfig,
      columns: [...reorderedColumns, ...hiddenColumns],
    }));
  }, [activeModule, currentModuleConfig.columns, enabledColumns.length, updateModuleConfig]);

  const handleEnableColumn = useCallback((columnId: string) => {
    updateModuleConfig(activeModule, (moduleConfig) => {
      const targetColumn = moduleConfig.columns.find((column) => column.id === columnId);
      if (!targetColumn || targetColumn.enabled) {
        return moduleConfig;
      }

      return {
        ...moduleConfig,
        columns: moduleConfig.columns.map((column) => column.id === columnId ? { ...column, enabled: true } : column),
      };
    });
  }, [activeModule, updateModuleConfig]);

  const handleDisableColumn = useCallback((columnId: string) => {
    updateModuleConfig(activeModule, (moduleConfig) => ({
      ...moduleConfig,
      columns: moduleConfig.columns.map((column) => column.id === columnId ? { ...column, enabled: false } : column),
    }));
  }, [activeModule, updateModuleConfig]);

  const handleResetModuleColumns = useCallback(() => {
    updateModuleConfig(activeModule, (moduleConfig) => ({
      ...moduleConfig,
      sheetName: moduleConfig.defaultSheetName,
      columns: moduleConfig.columns.map((column) => ({
        ...column,
        headerText: column.defaultExportHeader || column.defaultHeader,
        enabled: column.defaultSelected,
      })),
    }));
  }, [activeModule, updateModuleConfig]);

  const mappingColDefs = useMemo<ColDef<WorkbookExportFieldConfig>[]>(() => ([
    {
      headerName: '列号',
      width: 64,
      minWidth: 64,
      maxWidth: 64,
      sortable: false,
      resizable: false,
      suppressMovable: true,
      suppressHeaderMenuButton: true,
      cellRenderer: (params: ICellRendererParams<WorkbookExportFieldConfig>) => {
        const rowData = params.data;
        if (!rowData) {
          return null;
        }
        const columnLabel = rowData.enabled ? (previewColumnLetterMap.get(rowData.id) ?? '-') : '-';
        return (
          <div
            ref={(element) => {
              if (element) {
                params.registerRowDragger?.(element, 4, `排序 ${rowData.headerText || rowData.defaultHeader}`);
              }
            }}
            className="workbook-export-drag-handle"
          >
            <HolderOutlined style={{ fontSize: 12 }} />
            <span>{columnLabel}</span>
          </div>
        );
      },
      cellStyle: mappingIndexCellStyle,
    },
    {
      headerName: '系统字段',
      field: 'defaultHeader',
      minWidth: 128,
      flex: 1,
      editable: false,
      suppressMovable: true,
      suppressHeaderMenuButton: true,
      cellRenderer: (params: ICellRendererParams<WorkbookExportFieldConfig>) => {
        if (!params.data) {
          return null;
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
            <span>{params.data.defaultHeader}</span>
            <span style={{ fontSize: 12, color: token.colorTextSecondary }}>{params.data.fieldKey}</span>
          </div>
        );
      },
    },
    {
      headerName: '导出表头',
      field: 'headerText',
      minWidth: 132,
      flex: 1.1,
      editable: (params) => Boolean(params.data?.allowCustomHeader),
      singleClickEdit: true,
      suppressMovable: true,
      suppressHeaderMenuButton: true,
    },
    {
      headerName: '操作',
      width: 72,
      minWidth: 72,
      maxWidth: 72,
      sortable: false,
      resizable: false,
      suppressMovable: true,
      suppressHeaderMenuButton: true,
      cellRenderer: (params: ICellRendererParams<WorkbookExportFieldConfig>) => {
        if (!params.data) {
          return null;
        }
        return (
          <Button
            type="text"
            size="small"
            danger
            onClick={() => handleDisableColumn(params.data!.id)}
          >
            移除
          </Button>
        );
      },
      cellStyle: mappingCenteredCellStyle,
    },
  ]), [handleDisableColumn, mappingCenteredCellStyle, mappingIndexCellStyle, previewColumnLetterMap, token.colorTextSecondary]);

  const previewColDefs = useMemo<ColDef<PreviewSheetRow>[]>(() => {
    const rowNumberColumn: ColDef<PreviewSheetRow> = {
      headerName: '',
      colId: '__rowNumber',
      width: 56,
      minWidth: 56,
      maxWidth: 56,
      pinned: 'left',
      lockPosition: 'left',
      sortable: false,
      resizable: false,
      editable: false,
      suppressMovable: true,
      suppressHeaderMenuButton: true,
      cellStyle: (params) => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        color: token.colorTextSecondary,
        background: params.node?.rowPinned ? token.colorFillAlter : token.colorBgContainer,
        fontWeight: params.node?.rowPinned ? 600 : 500,
        borderRight: `1px solid ${token.colorBorderSecondary}`,
      }),
      valueGetter: (params) => {
        if (params.node?.rowPinned) {
          return 1;
        }
        return (params.node?.rowIndex ?? 0) + 2;
      },
    };

    const dataColumns = enabledColumns.map((column, index) => ({
      headerName: toExcelColumnLabel(index),
      field: column.fieldKey,
      flex: 1,
      minWidth: 132,
      editable: false,
      resizable: true,
      sortable: false,
      suppressMovable: true,
      suppressHeaderMenuButton: true,
      cellStyle: (params: { node: { rowPinned?: string | null } }) => ({
        background: params.node.rowPinned ? token.colorFillAlter : token.colorBgContainer,
        color: token.colorText,
        fontWeight: params.node.rowPinned ? 600 : 400,
      }),
    }));

    return [rowNumberColumn, ...dataColumns];
  }, [enabledColumns, token.colorBgContainer, token.colorBorderSecondary, token.colorFillAlter, token.colorText, token.colorTextSecondary]);

  const canGoNext = useMemo(() => {
    if (currentStep === 0) {
      return !schemaLoading && !!schema && !!resolvedBusinessDomain && !hasMixedBusinessDomains && selectedNodeKeys.length > 0 && enabledModuleKeys.length > 0;
    }
    if (currentStep === 1) {
      return !!exportRequest && enabledColumns.length > 0;
    }
    return false;
  }, [currentStep, enabledColumns.length, enabledModuleKeys.length, exportRequest, hasMixedBusinessDomains, resolvedBusinessDomain, schema, schemaLoading, selectedNodeKeys.length]);

  const renderScopeStep = () => {
    if (schemaLoading) {
      return (
        <Flex align="center" justify="center" style={{ height: '100%' }}>
          <Spin indicator={<LoadingOutlined spin />} tip="正在加载导出 schema..." />
        </Flex>
      );
    }

    if (schemaError) {
      return (
        <Result
          status="error"
          title="加载导出配置失败"
          subTitle={schemaError}
          extra={<Button onClick={() => void loadSchema()}>重新加载</Button>}
        />
      );
    }

    return (
      <Flex gap={16} style={{ height: '100%', minHeight: 0 }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            borderRadius: token.borderRadiusLG,
            border: `1px solid ${token.colorBorderSecondary}`,
            padding: 12,
            overflow: 'auto',
          }}
        >
          <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
            <Text strong>分类范围</Text>
            <Text type="secondary">已选根节点 {selectedNodeKeys.length} 个</Text>
          </Flex>
          <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
            请在此选择导出的根节点；若开启“递归包含子节点”，导出预览和最终导出都会自动包含所选节点的全部子树。
          </Text>
          <Flex gap={8} style={{ marginBottom: 8 }}>
            <Button size="small" onClick={() => setSelectedNodeKeys(allRootSelectableKeys)}>
              全选
            </Button>
            <Button size="small" onClick={() => setSelectedNodeKeys([])}>
              清空
            </Button>
          </Flex>
          <Tree
            className="workbook-export-scope-tree"
            checkable
            checkedKeys={selectedNodeKeys}
            expandedKeys={expandedKeys}
            selectable={false}
            switcherIcon={() => null}
            onCheck={(keys) => {
              const nextKeys = Array.isArray(keys) ? keys : keys.checked;
              setSelectedNodeKeys(nextKeys.map((key) => String(key)).filter((key) => !key.startsWith('local_')));
            }}
            treeData={treeData}
          />
        </div>

        <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {hasMixedBusinessDomains ? (
            <Alert
              type="error"
              showIcon
              message="当前选中节点跨多个业务域"
              description="工作簿导出一次仅支持单个业务域，请调整勾选范围后再继续。"
            />
          ) : null}

          <Alert
            type="info"
            showIcon
            message={`当前业务域：${resolvedBusinessDomain || '未识别'}`}
            description="导出请求中的 businessDomain 将以所选分类节点的业务域为准。"
          />

          <div style={{ background: token.colorFillAlter, borderRadius: token.borderRadiusLG, padding: 12 }}>
            <Text strong style={{ display: 'block', marginBottom: 10 }}>导出数据块</Text>
            <Flex vertical gap={8}>
              {WORKBOOK_EXPORT_MODULE_ORDER.map((moduleKey) => {
                const moduleConfig = config.modules[moduleKey];
                return (
                  <Flex
                    key={moduleKey}
                    align="center"
                    justify="space-between"
                    style={{
                      padding: '8px 10px',
                      borderRadius: token.borderRadius,
                      border: `1px solid ${moduleConfig.enabled ? token.colorPrimaryBorder : token.colorBorderSecondary}`,
                      background: moduleConfig.enabled ? token.colorPrimaryBg : token.colorBgContainer,
                    }}
                  >
                    <Flex vertical gap={2}>
                      <Text strong>{WORKBOOK_EXPORT_MODULE_LABELS[moduleKey]}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{moduleConfig.columns.filter((column) => column.enabled).length} 个启用字段</Text>
                    </Flex>
                    <Switch
                      size="small"
                      checked={moduleConfig.enabled}
                      onChange={(checked) => {
                        updateModuleConfig(moduleKey, (currentModule) => ({
                          ...currentModule,
                          enabled: checked,
                        }));
                      }}
                    />
                  </Flex>
                );
              })}
            </Flex>
          </div>

          <div style={{ background: token.colorFillAlter, borderRadius: token.borderRadiusLG, padding: 12 }}>
            <Flex align="center" justify="space-between" style={{ marginBottom: 8 }}>
              <Text>递归包含子节点</Text>
              <Switch
                size="small"
                checked={config.includeChildren}
                onChange={(checked) => setConfig((prev) => ({ ...prev, includeChildren: checked }))}
              />
            </Flex>
            <Text type="secondary" style={{ fontSize: 12 }}>开启后将自动带出所选分类下全部属性与枚举值</Text>
          </div>

          <div style={{ background: token.colorFillAlter, borderRadius: token.borderRadiusLG, padding: 12 }}>
            <Text style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>导出文件名</Text>
            <Input
              value={config.fileName}
              placeholder="可选，留空由后端生成默认文件名"
              onChange={(event) => setConfig((prev) => ({ ...prev, fileName: event.target.value }))}
            />
          </div>
        </div>
      </Flex>
    );
  };

  const renderPreviewPanel = () => {
    if (!config.modules[activeModule].enabled) {
      return <Empty description="当前数据块未启用" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    if (enabledColumns.length === 0) {
      return <Empty description="当前数据块没有可导出的字段" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    if (previewLoading) {
      return (
        <Flex align="center" justify="center" style={{ flex: 1, minHeight: 0 }}>
          <Spin size="small" tip="正在加载预览数据..." />
        </Flex>
      );
    }

    if (previewRows.length === 0) {
      return <Empty description="当前范围下暂无可预览数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    return (
      <div className="workbook-export-preview-grid" style={{ flex: 1, minHeight: 0 }}>
        <AgGridReact<PreviewSheetRow>
          key={previewGridKey}
          ref={previewGridRef}
          theme={themeQuartz}
          rowData={previewGridRows}
          pinnedTopRowData={previewPinnedTopRowData}
          columnDefs={previewColDefs}
          defaultColDef={{
            sortable: false,
            filter: false,
            resizable: true,
            editable: false,
            suppressMovable: true,
            suppressHeaderMenuButton: true,
          }}
          headerHeight={32}
          rowHeight={30}
          suppressHorizontalScroll={false}
          suppressMovableColumns={true}
        />
      </div>
    );
  };

  const renderFieldStep = () => {
    if (!currentModuleConfig) {
      return <Empty description="当前没有可配置的导出模块" />;
    }

    return (
      <Splitter style={{ height: '100%' }}>
        <Splitter.Panel defaultSize="25%" min="20%" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', paddingRight: 12 }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: 12,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: token.borderRadiusLG,
                background: token.colorFillQuaternary,
              }}
            >
              <div>
                <Text strong style={{ fontSize: 13, display: 'block' }}>数据块</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  先切换当前工作表，再配置字段和预览
                </Text>
              </div>

              <Segmented<WorkbookExportModuleKey>
                block
                value={activeModule}
                onChange={(value) => setActiveModule(value)}
                options={activeModuleOptions}
              />

              <Flex gap={8} vertical>
                <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>添加字段</Text>
                <Select
                  placeholder={availableColumns.length ? '从可选字段中添加到当前工作表' : '当前无可添加字段'}
                  disabled={availableColumns.length === 0}
                  showSearch
                  optionFilterProp="label"
                  options={availableColumns.map((column) => ({
                    value: column.id,
                    label: `${column.defaultHeader} (${column.fieldKey})`,
                  }))}
                  onSelect={(value) => handleEnableColumn(String(value))}
                />
              </Flex>

              <Flex gap={8}>
                <Button icon={<ReloadOutlined />} loading={planLoading} onClick={() => void loadPlan({ force: true, showLoading: true })}>
                  重新预校验
                </Button>
                <Button onClick={handleResetModuleColumns}>
                  恢复默认字段
                </Button>
              </Flex>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 6,
                padding: '8px 10px',
                borderRadius: token.borderRadius,
                background: token.colorInfoBg,
                border: `1px solid ${token.colorInfoBorder}`,
                color: token.colorTextSecondary,
                fontSize: 12,
              }}
            >
              <InfoCircleOutlined style={{ marginTop: 2 }} />
              <span>左侧仅维护当前已选字段，可继续添加字段、编辑表头并拖拽排序；右侧为抽样预览，只加载少量范围数据避免大批量查询超时。</span>
            </div>

            {planResult?.warnings?.length ? (
              <Alert
                type="warning"
                showIcon
                message="预校验提示"
                description={
                  <Flex vertical gap={4}>
                    {planResult.warnings.map((warning) => (
                      <Text key={warning}>{warning}</Text>
                    ))}
                  </Flex>
                }
              />
            ) : null}

            <div className="workbook-export-mapping-grid" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <AgGridReact<WorkbookExportFieldConfig>
                rowData={enabledColumns}
                columnDefs={mappingColDefs}
                theme={themeQuartz}
                getRowId={(params) => params.data.id}
                defaultColDef={{
                  sortable: false,
                  resizable: false,
                  suppressHeaderMenuButton: true,
                }}
                overlayNoRowsTemplate={'<span style="color: #8c8c8c;">No Rows To Show</span>'}
                headerHeight={36}
                rowHeight={42}
                rowDragManaged={true}
                animateRows={true}
                stopEditingWhenCellsLoseFocus={true}
                suppressHorizontalScroll={false}
                onCellValueChanged={handleHeaderCellValueChanged}
                onRowDragEnd={handleMappingRowDragEnd}
              />
            </div>
          </div>
        </Splitter.Panel>

        <Splitter.Panel style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', paddingLeft: 12 }}>
            <Flex align="center" justify="space-between" wrap style={{ gap: 8 }}>
              <Flex align="center" gap={8}>
                <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {WORKBOOK_EXPORT_MODULE_LABELS[activeModule]}表预览前 {Math.min(PREVIEW_ROW_LIMIT, previewRows.length)} 条，共 {estimateRows[activeModule]} 条
                </Text>
              </Flex>
              <Text type="secondary" style={{ fontSize: 12 }}>启用字段 {enabledColumns.length} 个</Text>
            </Flex>

            {previewError ? (
              <Alert type="warning" showIcon message="预览加载失败" description={previewError} />
            ) : null}

            {renderPreviewPanel()}
          </div>
        </Splitter.Panel>
      </Splitter>
    );
  };

  const renderResultSummary = () => {
    if (!runtime.result) {
      return null;
    }

    return (
      <Descriptions column={2} size="small" colon={false}>
        <Descriptions.Item label="文件名">{runtime.result.file.fileName}</Descriptions.Item>
        <Descriptions.Item label="文件大小">{runtime.result.file.size} B</Descriptions.Item>
        <Descriptions.Item label="完成时间">{formatDateTime(runtime.result.completedAt)}</Descriptions.Item>
        <Descriptions.Item label="过期时间">{formatDateTime(runtime.result.file.expiresAt)}</Descriptions.Item>
      </Descriptions>
    );
  };

  const renderExecuteStep = () => {
    if (!runtime.status && !exporting) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
          <FileExcelOutlined style={{ fontSize: 48, color: token.colorPrimary }} />
          <Text strong style={{ fontSize: 15 }}>准备生成完整数据导出文件</Text>
          <div
            style={{
              width: 420,
              maxWidth: '100%',
              background: token.colorFillAlter,
              borderRadius: token.borderRadiusLG,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <Descriptions column={1} size="small" colon={false}>
              <Descriptions.Item label="业务域">{resolvedBusinessDomain || '—'}</Descriptions.Item>
              <Descriptions.Item label="分类节点数">{selectedNodeKeys.length}</Descriptions.Item>
              <Descriptions.Item label="启用模块">{enabledModuleKeys.map((moduleKey) => WORKBOOK_EXPORT_MODULE_LABELS[moduleKey]).join('、') || '—'}</Descriptions.Item>
            </Descriptions>
          </div>
          <Button type="primary" size="large" icon={<DownloadOutlined />} onClick={handleStartExport}>
            开始导出
          </Button>
        </div>
      );
    }

    const finished = isTerminalStatus(runtime.status?.status);
    const progressStatus = finished
      ? runtime.status?.status === 'COMPLETED'
        ? 'success'
        : 'exception'
      : 'active';

    return (
      <Flex vertical gap={16} style={{ height: '100%', minHeight: 0 }}>
        {runtime.status ? (
          <Alert
            type={runtime.status.status === 'COMPLETED' ? 'success' : runtime.status.status === 'FAILED' ? 'error' : runtime.status.status === 'CANCELED' ? 'warning' : 'info'}
            showIcon
            message={`${STATUS_LABELS[runtime.status.status] || runtime.status.status} · ${STAGE_LABELS[runtime.status.currentStage] || runtime.status.currentStage}`}
            description={`SSE ${runtime.sseConnected ? '已连接' : '未连接，当前使用轮询兜底'} · jobId: ${runtime.status.jobId}`}
          />
        ) : null}

        {runtime.status ? (
          <div style={{ background: token.colorFillAlter, borderRadius: token.borderRadiusLG, padding: 16 }}>
            <Flex align="center" justify="space-between" wrap gap={12}>
              <Flex vertical gap={4}>
                <Text strong style={{ fontSize: 14 }}>{STATUS_LABELS[runtime.status.status] || runtime.status.status}</Text>
                <Text type="secondary">{STAGE_LABELS[runtime.status.currentStage] || runtime.status.currentStage}</Text>
              </Flex>
              <Space wrap>
                {!finished ? (
                  <Button danger icon={<StopOutlined />} onClick={handleCancelJob}>取消导出</Button>
                ) : null}
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  loading={downloadLoading}
                  disabled={runtime.status.status !== 'COMPLETED' || !runtime.result}
                  onClick={handleDownload}
                >
                  下载文件
                </Button>
              </Space>
            </Flex>

            <div style={{ marginTop: 12 }}>
              <Progress percent={runtime.status.overallPercent ?? 0} status={progressStatus} />
            </div>

            <Flex wrap gap={8} style={{ marginTop: 8 }}>
              <Tag color="blue">阶段进度 {runtime.status.stagePercent ?? 0}%</Tag>
              {runtime.status.warnings?.length ? <Tag color="warning">警告 {runtime.status.warnings.length}</Tag> : null}
              <Tag color="default">创建时间 {formatDateTime(runtime.status.createdAt)}</Tag>
              <Tag color="default">更新时间 {formatDateTime(runtime.status.updatedAt)}</Tag>
            </Flex>
          </div>
        ) : null}

        {runtime.status ? (
          <Flex gap={12} wrap>
            {WORKBOOK_EXPORT_MODULE_ORDER.map((moduleKey) => {
              const progress = getModuleProgress(runtime.status, moduleKey);
              return (
                <div
                  key={moduleKey}
                  style={{
                    flex: '1 1 220px',
                    minWidth: 220,
                    background: token.colorFillAlter,
                    borderRadius: token.borderRadiusLG,
                    padding: 12,
                  }}
                >
                  <Text strong>{WORKBOOK_EXPORT_MODULE_LABELS[moduleKey]}</Text>
                  <Descriptions column={1} size="small" colon={false} style={{ marginTop: 8 }}>
                    <Descriptions.Item label="总数">{progress.total ?? 0}</Descriptions.Item>
                    <Descriptions.Item label="已处理">{progress.processed ?? 0}</Descriptions.Item>
                    <Descriptions.Item label="已导出">{progress.exported ?? 0}</Descriptions.Item>
                    <Descriptions.Item label="失败">{progress.failed ?? 0}</Descriptions.Item>
                  </Descriptions>
                </div>
              );
            })}
          </Flex>
        ) : null}

        {runtime.result ? (
          <div style={{ background: token.colorFillAlter, borderRadius: token.borderRadiusLG, padding: 16 }}>
            <Flex align="center" gap={8} style={{ marginBottom: 10 }}>
              {runtime.status?.status === 'COMPLETED' ? (
                <CheckCircleFilled style={{ color: token.colorSuccess }} />
              ) : (
                <CloseCircleFilled style={{ color: token.colorWarning }} />
              )}
              <Text strong>导出结果</Text>
            </Flex>
            {renderResultSummary()}
          </div>
        ) : null}

        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: token.colorBgContainer, borderRadius: token.borderRadiusLG }}>
          <Table<WorkbookExportLogEventDto>
            rowKey={(record) => record.cursor ?? String(record.sequence ?? `${record.timestamp}-${record.message}`)}
            dataSource={runtime.logs}
            columns={logColumns}
            size="small"
            pagination={false}
            scroll={{ y: 260 }}
            locale={{ emptyText: '暂无任务日志' }}
          />
        </div>
      </Flex>
    );
  };

  const renderContent = () => {
    switch (currentStep) {
      case 0:
        return renderScopeStep();
      case 1:
        return renderFieldStep();
      case 2:
        return renderExecuteStep();
      default:
        return null;
    }
  };

  const renderFooter = () => {
    const terminal = isTerminalStatus(runtime.status?.status);

    return (
      <Flex justify="space-between" align="center">
        <Text type="secondary" style={{ fontSize: 12 }}>步骤 {currentStep + 1} / {WORKBOOK_EXPORT_STEPS.length}</Text>
        <Space>
          {currentStep > 0 && currentStep < 2 ? (
            <Button onClick={() => setCurrentStep((step) => Math.max(step - 1, 0) as WorkbookExportStep)}>
              上一步
            </Button>
          ) : null}
          <Button onClick={onCancel} disabled={exporting && !terminal}>关闭</Button>
          {currentStep < 2 ? (
            <Button
              type="primary"
              disabled={!canGoNext}
              onClick={() => setCurrentStep((step) => Math.min(step + 1, 2) as WorkbookExportStep)}
            >
              下一步
            </Button>
          ) : null}
        </Space>
      </Flex>
    );
  };

  return (
    <DraggableModal
      open={open}
      title="导出完整数据"
      width="80%"
      footer={renderFooter()}
      onCancel={onCancel}
      destroyOnClose
      maskClosable={false}
      keyboard={false}
      styles={{
        body: {
          height: 'calc(100vh - 240px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: '16px 24px',
        },
      }}
    >
      <Steps
        current={currentStep}
        size="small"
        items={WORKBOOK_EXPORT_STEPS.map((step, index) => ({
          title: step.title,
          description: step.description,
          status: index < currentStep ? 'finish' : index === currentStep ? 'process' : 'wait',
        }))}
      />

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {renderContent()}
      </div>

      <style jsx global>{`
        .workbook-export-mapping-grid .ag-root-wrapper,
        .workbook-export-preview-grid .ag-root-wrapper {
          border: 1px solid ${token.colorBorderSecondary};
          border-radius: ${token.borderRadiusLG}px;
          overflow: hidden;
          background: ${token.colorBgContainer};
        }

        .workbook-export-mapping-grid .ag-header,
        .workbook-export-preview-grid .ag-header {
          background: ${token.colorFillAlter};
          border-bottom: 1px solid ${token.colorBorderSecondary};
        }

        .workbook-export-mapping-grid .ag-header-cell,
        .workbook-export-preview-grid .ag-header-cell {
          font-weight: 600;
        }

        .workbook-export-mapping-grid .ag-header-cell[col-id="0"],
        .workbook-export-mapping-grid .ag-header-cell[col-id="3"] {
          text-align: center;
        }

        .workbook-export-mapping-grid .ag-header-cell[col-id="0"] .ag-header-cell-label,
        .workbook-export-mapping-grid .ag-header-cell[col-id="3"] .ag-header-cell-label {
          justify-content: center;
        }

        .workbook-export-mapping-grid .ag-header-cell,
        .workbook-export-mapping-grid .ag-cell {
          border-right: 0;
          box-shadow: none;
        }

        .workbook-export-preview-grid .ag-header-cell,
        .workbook-export-preview-grid .ag-cell {
          border-right: 1px solid ${token.colorBorderSecondary};
        }

        .workbook-export-mapping-grid .ag-row,
        .workbook-export-preview-grid .ag-row,
        .workbook-export-preview-grid .ag-row-pinned {
          border-bottom: 1px solid ${token.colorBorderSecondary};
        }

        .workbook-export-preview-grid .ag-header-cell-label {
          justify-content: center;
        }

        .workbook-export-preview-grid .ag-pinned-left-cols-container .ag-cell-value {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
        }

        .workbook-export-preview-grid .ag-row-pinned {
          background: ${token.colorFillAlter};
        }

        .workbook-export-drag-handle {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
          color: ${token.colorTextSecondary};
          font-weight: 600;
          cursor: grab;
          user-select: none;
        }

        .workbook-export-drag-handle:active {
          cursor: grabbing;
        }

        .workbook-export-mapping-grid .ag-cell,
        .workbook-export-preview-grid .ag-cell {
          display: flex;
          align-items: center;
        }

        .workbook-export-mapping-grid .ag-cell[col-id="0"],
        .workbook-export-mapping-grid .ag-cell[col-id="3"] {
          justify-content: center;
        }

        .workbook-export-mapping-grid .ag-body-horizontal-scroll {
          display: block;
        }

        .workbook-export-scope-tree .ant-tree-switcher {
          width: 0;
          min-width: 0;
          margin-inline-end: 0;
          overflow: hidden;
          visibility: hidden;
        }
      `}</style>
    </DraggableModal>
  );
};

export default WorkbookExportModal;