'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Descriptions,
  Empty,
  Flex,
  Progress,
  Result,
  Select,
  Space,
  Steps,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  DeleteOutlined,
  FileExcelOutlined,
  ImportOutlined,
  InfoCircleFilled,
  PlayCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  UploadOutlined,
  WarningFilled,
} from '@ant-design/icons';
import DraggableModal from '@/components/DraggableModal';
import { workbookImportApi } from '@/services/workbookImport';
import type {
  WorkbookImportDryRunResponseDto,
  WorkbookImportEntityProgressDto,
  WorkbookImportJobStatusDto,
  WorkbookImportLogEventDto,
  WorkbookImportResolvedAction,
} from '@/services/workbookImport';
import type { WorkbookImportPreviewRow } from './workbookImportUi';
import {
  CODE_MODE_OPTIONS,
  DEFAULT_WORKBOOK_IMPORT_FORM,
  DUPLICATE_POLICY_OPTIONS,
  IMPORT_STEPS,
  mapDryRunPreviewRows,
  type ImportStep,
  type StepStatus,
} from './workbookImportUi';

const { Text, Title } = Typography;

const MODAL_BODY_HEIGHT = 'calc(100vh - 260px)';
const LOG_POLL_INTERVAL = 3000;

interface WorkbookImportModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess?: () => void;
  defaultBusinessDomain?: string;
}

const STEP_ICONS = [
  <FileExcelOutlined key="upload" />,
  <SettingOutlined key="config" />,
  <SafetyCertificateOutlined key="dryrun" />,
  <ImportOutlined key="exec" />,
];

const ACTION_TAG_COLORS: Record<WorkbookImportResolvedAction, string> = {
  CREATE: 'success',
  UPDATE: 'processing',
  SKIP: 'default',
  CONFLICT: 'error',
};

const ENTITY_LABELS: Record<WorkbookImportPreviewRow['entityType'], string> = {
  CATEGORY: '分类',
  ATTRIBUTE: '属性',
  ENUM_OPTION: '枚举值',
};

const STAGE_LABELS: Record<string, string> = {
  PREPARING: '准备阶段',
  CATEGORIES: '分类导入',
  ATTRIBUTES: '属性导入',
  ENUM_OPTIONS: '枚举值导入',
  FINALIZING: '收尾阶段',
};

const STATUS_LABELS: Record<string, string> = {
  QUEUED: '已入队',
  PREPARING: '准备中',
  IMPORTING_CATEGORIES: '正在导入分类',
  IMPORTING_ATTRIBUTES: '正在导入属性',
  IMPORTING_ENUM_OPTIONS: '正在导入枚举值',
  FINALIZING: '正在收尾',
  COMPLETED: '已完成',
  FAILED: '失败',
};

const levelIcon = (level: 'ERROR' | 'WARNING' | null, token: ReturnType<typeof theme.useToken>['token']) => {
  if (level === 'ERROR') {
    return <CloseCircleFilled style={{ color: token.colorError }} />;
  }
  if (level === 'WARNING') {
    return <WarningFilled style={{ color: token.colorWarning }} />;
  }
  return <CheckCircleFilled style={{ color: token.colorSuccess }} />;
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', { hour12: false });
};

const sumProgressField = (
  progress: WorkbookImportJobStatusDto['progress'] | undefined,
  field: keyof WorkbookImportEntityProgressDto,
): number => {
  if (!progress) {
    return 0;
  }

  return [progress.categories, progress.attributes, progress.enumOptions].reduce((total, item) => {
    return total + (item?.[field] ?? 0);
  }, 0);
};

const isTerminalStatus = (status: string | null | undefined): boolean => {
  return status === 'COMPLETED' || status === 'FAILED';
};

const WorkbookImportModal: React.FC<WorkbookImportModalProps> = ({
  open,
  onCancel,
  onSuccess,
  defaultBusinessDomain,
}) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();

  const [currentStep, setCurrentStep] = useState<ImportStep>(0);
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(['process', 'wait', 'wait', 'wait']);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [formState, setFormState] = useState(DEFAULT_WORKBOOK_IMPORT_FORM);
  const [dryRunning, setDryRunning] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<WorkbookImportDryRunResponseDto | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<WorkbookImportJobStatusDto | null>(null);
  const [jobLogs, setJobLogs] = useState<WorkbookImportLogEventDto[]>([]);
  const [lastLogCursor, setLastLogCursor] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const lastLogCursorRef = useRef<string | null>(null);
  const seenLogKeysRef = useRef<Set<string>>(new Set());

  const previewRows = useMemo(() => mapDryRunPreviewRows(dryRunResult), [dryRunResult]);

  const markStep = useCallback((step: number, status: StepStatus) => {
    setStepStatuses((prev) => {
      const next = [...prev];
      next[step] = status;
      return next;
    });
  }, []);

  const stopRuntimeTracking = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    setSseConnected(false);
  }, []);

  const clearRuntimeState = useCallback(() => {
    stopRuntimeTracking();
    setJobId(null);
    setJobStatus(null);
    setJobLogs([]);
    setLastLogCursor(null);
    lastLogCursorRef.current = null;
    seenLogKeysRef.current.clear();
    setImporting(false);
  }, [stopRuntimeTracking]);

  const resetAll = useCallback(() => {
    clearRuntimeState();
    setCurrentStep(0);
    setStepStatuses(['process', 'wait', 'wait', 'wait']);
    setUploadedFile(null);
    setFormState(DEFAULT_WORKBOOK_IMPORT_FORM);
    setDryRunning(false);
    setDryRunResult(null);
  }, [clearRuntimeState]);

  const handleCancel = useCallback(() => {
    resetAll();
    onCancel();
  }, [onCancel, resetAll]);

  const mergeLogs = useCallback((incoming: WorkbookImportLogEventDto[] = []) => {
    if (!incoming.length) {
      return;
    }

    setJobLogs((prev) => {
      const next = [...prev];

      for (const item of incoming) {
        const key = item.cursor ?? String(item.sequence ?? `${item.timestamp ?? ''}-${item.message}`);
        if (seenLogKeysRef.current.has(key)) {
          continue;
        }
        seenLogKeysRef.current.add(key);
        next.push(item);
      }

      next.sort((left, right) => (left.sequence ?? 0) - (right.sequence ?? 0));
      return next.slice(-300);
    });
  }, []);

  const finalizeJobIfNeeded = useCallback((snapshot: WorkbookImportJobStatusDto) => {
    if (!isTerminalStatus(snapshot.status)) {
      setImporting(true);
      return;
    }

    setImporting(false);
    markStep(3, snapshot.status === 'FAILED' ? 'error' : 'finish');
    stopRuntimeTracking();
  }, [markStep, stopRuntimeTracking]);

  const syncJobSnapshot = useCallback((snapshot: WorkbookImportJobStatusDto) => {
    setJobStatus(snapshot);
    mergeLogs(snapshot.latestLogs ?? []);
    if (snapshot.latestLogCursor) {
      lastLogCursorRef.current = snapshot.latestLogCursor;
      setLastLogCursor(snapshot.latestLogCursor);
    }
    finalizeJobIfNeeded(snapshot);
  }, [finalizeJobIfNeeded, mergeLogs]);

  const refreshJobSnapshot = useCallback(async (activeJobId: string) => {
    const snapshot = await workbookImportApi.getJobStatus(activeJobId);
    syncJobSnapshot(snapshot);
  }, [syncJobSnapshot]);

  const pullJobLogs = useCallback(async (activeJobId: string) => {
    const page = await workbookImportApi.listJobLogs(activeJobId, {
      cursor: lastLogCursorRef.current ?? undefined,
      limit: 100,
    });

    mergeLogs(page.items ?? []);
    if (page.nextCursor) {
      lastLogCursorRef.current = page.nextCursor;
      setLastLogCursor(page.nextCursor);
    }
  }, [mergeLogs]);

  const invalidateDryRun = useCallback(() => {
    setDryRunResult(null);
    markStep(2, 'wait');
    markStep(3, 'wait');
    clearRuntimeState();
  }, [clearRuntimeState, markStep]);

  const handleFileUpload = useCallback((file: File) => {
    setUploadedFile(file);
    invalidateDryRun();
    message.success(`已选择工作簿：${file.name}`);
    return false;
  }, [invalidateDryRun, message]);

  const handleRemoveFile = useCallback(() => {
    setUploadedFile(null);
    invalidateDryRun();
  }, [invalidateDryRun]);

  const updateCodingOption = useCallback((field: 'categoryCodeMode' | 'attributeCodeMode' | 'enumOptionCodeMode', value: string) => {
    invalidateDryRun();
    setFormState((prev) => ({
      ...prev,
      options: {
        ...prev.options,
        codingOptions: {
          ...prev.options.codingOptions,
          [field]: value,
        },
      },
    }));
  }, [invalidateDryRun]);

  const updateDuplicateOption = useCallback((field: 'categoryDuplicatePolicy' | 'attributeDuplicatePolicy' | 'enumOptionDuplicatePolicy', value: string) => {
    invalidateDryRun();
    setFormState((prev) => ({
      ...prev,
      options: {
        ...prev.options,
        duplicateOptions: {
          ...prev.options.duplicateOptions,
          [field]: value,
        },
      },
    }));
  }, [invalidateDryRun]);

  const goNext = useCallback(() => {
    const next = (currentStep + 1) as ImportStep;
    if (next > 3) {
      return;
    }

    markStep(currentStep, 'finish');
    markStep(next, 'process');
    setCurrentStep(next);
  }, [currentStep, markStep]);

  const goPrev = useCallback(() => {
    const prev = (currentStep - 1) as ImportStep;
    if (prev < 0) {
      return;
    }

    markStep(currentStep, 'wait');
    markStep(prev, 'process');
    setCurrentStep(prev);
  }, [currentStep, markStep]);

  const runDryRun = useCallback(async () => {
    if (!uploadedFile) {
      message.warning('请先选择工作簿文件');
      return;
    }

    setDryRunning(true);
    clearRuntimeState();
    setDryRunResult(null);

    try {
      const response = await workbookImportApi.dryRun(uploadedFile, formState.options, formState.operator || 'admin');
      setDryRunResult(response);
      markStep(2, response.summary.canImport ? 'process' : 'error');
      message.success('预检完成');
    } catch (error: any) {
      setDryRunResult(null);
      markStep(2, 'error');
      message.error(error?.message || error?.error || '预检失败');
    } finally {
      setDryRunning(false);
    }
  }, [clearRuntimeState, formState.operator, formState.options, markStep, message, uploadedFile]);

  const handleConfirmImport = useCallback(async () => {
    if (!dryRunResult?.importSessionId || !dryRunResult.summary.canImport) {
      message.warning('当前预检结果不允许正式导入');
      return;
    }

    clearRuntimeState();
    markStep(2, 'finish');
    markStep(3, 'process');
    setCurrentStep(3);
    setImporting(true);

    try {
      const response = await workbookImportApi.startImport({
        importSessionId: dryRunResult.importSessionId,
        operator: formState.operator || 'admin',
        atomic: formState.atomic,
      });

      setJobId(response.jobId);
      message.success('导入任务已启动');
    } catch (error: any) {
      setImporting(false);
      setCurrentStep(2);
      markStep(2, 'process');
      markStep(3, 'wait');
      message.error(error?.message || error?.error || '启动导入任务失败');
    }
  }, [clearRuntimeState, dryRunResult, formState.atomic, formState.operator, markStep, message]);

  useEffect(() => {
    lastLogCursorRef.current = lastLogCursor;
  }, [lastLogCursor]);

  useEffect(() => {
    if (!jobId || !open) {
      return undefined;
    }

    let disposed = false;
    const stream = new EventSource(workbookImportApi.getJobStreamUrl(jobId));
    eventSourceRef.current = stream;

    const handleProgress = (event: Event) => {
      if (disposed) {
        return;
      }

      try {
        const snapshot = JSON.parse((event as MessageEvent<string>).data) as WorkbookImportJobStatusDto;
        syncJobSnapshot(snapshot);
      } catch {
        void refreshJobSnapshot(jobId);
      }
    };

    const handleLog = (event: Event) => {
      if (disposed) {
        return;
      }

      try {
        const logEvent = JSON.parse((event as MessageEvent<string>).data) as WorkbookImportLogEventDto;
        mergeLogs([logEvent]);
      } catch {
        void pullJobLogs(jobId);
      }
    };

    stream.onopen = () => {
      if (!disposed) {
        setSseConnected(true);
      }
    };
    stream.onerror = () => {
      if (!disposed) {
        setSseConnected(false);
        void refreshJobSnapshot(jobId);
        void pullJobLogs(jobId);
      }
    };

    stream.addEventListener('progress', handleProgress);
    stream.addEventListener('log', handleLog);
    stream.addEventListener('completed', () => {
      void refreshJobSnapshot(jobId);
      void pullJobLogs(jobId);
    });
    stream.addEventListener('failed', () => {
      void refreshJobSnapshot(jobId);
      void pullJobLogs(jobId);
    });
    stream.addEventListener('stage-changed', () => {
      void refreshJobSnapshot(jobId);
    });

    void refreshJobSnapshot(jobId);
    void pullJobLogs(jobId);

    pollTimerRef.current = window.setInterval(() => {
      void refreshJobSnapshot(jobId);
      void pullJobLogs(jobId);
    }, LOG_POLL_INTERVAL);

    return () => {
      disposed = true;
      stopRuntimeTracking();
    };
  }, [jobId, mergeLogs, open, pullJobLogs, refreshJobSnapshot, stopRuntimeTracking, syncJobSnapshot]);

  useEffect(() => {
    if (!open) {
      resetAll();
    }
  }, [open, resetAll]);

  useEffect(() => {
    return () => {
      stopRuntimeTracking();
    };
  }, [stopRuntimeTracking]);

  const previewColumns: ColumnsType<WorkbookImportPreviewRow> = useMemo(() => {
    return [
      {
        title: '行',
        dataIndex: 'rowNumber',
        width: 84,
        align: 'center',
        render: (_, record) => {
          if (!record.rowNumber) {
            return <Text type="secondary">—</Text>;
          }

          return (
            <Tooltip title={record.issueMessages.length ? record.issueMessages.join('\n') : '该行无问题'}>
              <Space size={4}>
                {levelIcon(record.issueLevel, token)}
                <Text>{record.rowNumber}</Text>
              </Space>
            </Tooltip>
          );
        },
      },
      {
        title: '实体',
        dataIndex: 'entityType',
        width: 88,
        render: (value: WorkbookImportPreviewRow['entityType']) => (
          <Tag style={{ marginInlineEnd: 0 }}>{ENTITY_LABELS[value]}</Tag>
        ),
      },
      {
        title: '名称',
        dataIndex: 'name',
        width: 220,
        ellipsis: true,
        render: (value: string, record) => (
          <Flex vertical gap={2}>
            <Text strong>{value}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {record.businessDomain || record.sheetName || '—'}
            </Text>
          </Flex>
        ),
      },
      {
        title: 'Excel 引用编码',
        dataIndex: 'excelReferenceCode',
        width: 170,
        ellipsis: true,
        render: (value: string | null) => value ? <Text code>{value}</Text> : <Text type="secondary">—</Text>,
      },
      {
        title: '原始编码',
        dataIndex: 'sourceCode',
        width: 170,
        ellipsis: true,
        render: (value: string | null) => value ? <Text code>{value}</Text> : <Text type="secondary">—</Text>,
      },
      {
        title: '预览最终编码',
        dataIndex: 'finalCode',
        width: 180,
        ellipsis: true,
        render: (value: string | null) => value ? <Text code>{value}</Text> : <Text type="secondary">—</Text>,
      },
      {
        title: '关联信息',
        dataIndex: 'relation',
        width: 180,
        ellipsis: true,
        render: (value: string | null, record) => (
          <Flex vertical gap={2}>
            <Text type={value ? undefined : 'secondary'}>{value || '—'}</Text>
            {record.extra ? <Text type="secondary" style={{ fontSize: 11 }}>{record.extra}</Text> : null}
          </Flex>
        ),
      },
      {
        title: '动作',
        dataIndex: 'action',
        width: 110,
        align: 'center',
        render: (value: WorkbookImportResolvedAction | null) => {
          if (!value) {
            return <Text type="secondary">—</Text>;
          }
          return <Tag color={ACTION_TAG_COLORS[value]}>{value}</Tag>;
        },
      },
      {
        title: '问题',
        dataIndex: 'issueCount',
        width: 90,
        align: 'center',
        render: (value: number, record) => {
          if (!value) {
            return <Tag color="success">0</Tag>;
          }

          return (
            <Tooltip title={record.issueMessages.join('\n')}>
              <Tag color={record.issueLevel === 'ERROR' ? 'error' : 'warning'}>{value}</Tag>
            </Tooltip>
          );
        },
      },
    ];
  }, [token]);

  const logColumns: ColumnsType<WorkbookImportLogEventDto> = useMemo(() => {
    return [
      {
        title: '时间',
        dataIndex: 'timestamp',
        width: 160,
        render: (value: string | null) => <Text style={{ fontSize: 12 }}>{formatDateTime(value)}</Text>,
      },
      {
        title: '级别',
        dataIndex: 'level',
        width: 82,
        align: 'center',
        render: (value: string | null) => {
          if (!value) {
            return <Text type="secondary">—</Text>;
          }
          const color = value === 'ERROR' ? 'error' : value === 'WARN' || value === 'WARNING' ? 'warning' : 'default';
          return <Tag color={color}>{value}</Tag>;
        },
      },
      {
        title: '阶段',
        dataIndex: 'stage',
        width: 120,
        render: (value: string | null) => <Text>{value ? (STAGE_LABELS[value] || value) : '—'}</Text>,
      },
      {
        title: '定位',
        dataIndex: 'rowNumber',
        width: 130,
        render: (_: number | null, record) => {
          if (!record.sheetName && !record.rowNumber) {
            return <Text type="secondary">—</Text>;
          }

          return (
            <Text style={{ fontSize: 12 }}>
              {[record.sheetName, record.rowNumber ? `第 ${record.rowNumber} 行` : null].filter(Boolean).join(' / ')}
            </Text>
          );
        },
      },
      {
        title: '消息',
        dataIndex: 'message',
        ellipsis: true,
        render: (value: string, record) => {
          const detailText = record.details && Object.keys(record.details).length
            ? JSON.stringify(record.details)
            : '';
          const content = detailText ? `${value}\n${detailText}` : value;
          return (
            <Tooltip title={content}>
              <Flex vertical gap={2}>
                <Text>{value}</Text>
                {record.code ? <Text type="secondary" style={{ fontSize: 11 }}>{record.code}</Text> : null}
              </Flex>
            </Tooltip>
          );
        },
      },
    ];
  }, []);

  const canGoNext = useMemo(() => {
    switch (currentStep) {
      case 0:
        return !!uploadedFile;
      case 1:
        return true;
      case 2:
        return !!dryRunResult?.summary.canImport;
      default:
        return false;
    }
  }, [currentStep, dryRunResult?.summary.canImport, uploadedFile]);

  const aggregateProgress = useMemo(() => {
    return {
      total: sumProgressField(jobStatus?.progress, 'total'),
      processed: sumProgressField(jobStatus?.progress, 'processed'),
      created: sumProgressField(jobStatus?.progress, 'created'),
      updated: sumProgressField(jobStatus?.progress, 'updated'),
      skipped: sumProgressField(jobStatus?.progress, 'skipped'),
      failed: sumProgressField(jobStatus?.progress, 'failed'),
    };
  }, [jobStatus?.progress]);

  const executionFinished = isTerminalStatus(jobStatus?.status);
  const importSucceeded = jobStatus?.status === 'COMPLETED';

  const renderChangeCard = (title: string, counters: WorkbookImportDryRunResponseDto['changeSummary']['categories']) => (
    <Flex
      vertical
      gap={4}
      style={{
        flex: 1,
        minWidth: 180,
        padding: '12px 14px',
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
      }}
    >
      <Text strong>{title}</Text>
      <Text style={{ fontSize: 12 }}>新增 {counters.create}</Text>
      <Text style={{ fontSize: 12 }}>更新 {counters.update}</Text>
      <Text style={{ fontSize: 12 }}>跳过 {counters.skip}</Text>
      <Text style={{ fontSize: 12 }}>冲突 {counters.conflict}</Text>
    </Flex>
  );

  const renderProgressCard = (title: string, progress?: WorkbookImportEntityProgressDto) => {
    const item = progress ?? { total: 0, processed: 0, created: 0, updated: 0, skipped: 0, failed: 0 };
    return (
      <Flex
        vertical
        gap={4}
        style={{
          flex: 1,
          minWidth: 180,
          padding: '12px 14px',
          borderRadius: token.borderRadiusLG,
          border: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer,
        }}
      >
        <Text strong>{title}</Text>
        <Text style={{ fontSize: 12 }}>总数 {item.total}</Text>
        <Text style={{ fontSize: 12 }}>已处理 {item.processed}</Text>
        <Text style={{ fontSize: 12 }}>创建 {item.created}</Text>
        <Text style={{ fontSize: 12 }}>更新 {item.updated}</Text>
        <Text style={{ fontSize: 12 }}>跳过 {item.skipped}</Text>
        <Text style={{ fontSize: 12, color: item.failed > 0 ? token.colorError : token.colorText }}>{`失败 ${item.failed}`}</Text>
      </Flex>
    );
  };

  const renderStep0 = () => (
    <Flex vertical gap={16} style={{ height: '100%', minHeight: 0 }}>
      {!uploadedFile ? (
        <Upload.Dragger
          accept=".xlsx,.xls"
          beforeUpload={handleFileUpload}
          showUploadList={false}
          style={{ padding: '32px 0' }}
        >
          <Flex vertical align="center" gap={8}>
            <UploadOutlined style={{ fontSize: 36, color: token.colorPrimary }} />
            <Text strong>点击或拖拽工作簿到此处上传</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              仅支持 Excel 工作簿，且必须包含 分类层级 / 属性定义 / 枚举值定义 三个 Sheet
            </Text>
          </Flex>
        </Upload.Dragger>
      ) : (
        <Flex
          align="center"
          justify="space-between"
          style={{
            padding: '12px 16px',
            background: token.colorFillAlter,
            borderRadius: token.borderRadiusLG,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Flex align="center" gap={10}>
            <FileExcelOutlined style={{ fontSize: 20, color: '#217346' }} />
            <Flex vertical gap={0}>
              <Text strong style={{ fontSize: 13 }}>{uploadedFile.name}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {(uploadedFile.size / 1024).toFixed(1)} KB
              </Text>
            </Flex>
          </Flex>
          <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={handleRemoveFile}>
            移除
          </Button>
        </Flex>
      )}

      <Alert
        type="info"
        showIcon
        icon={<InfoCircleFilled />}
        message="工作簿导入说明"
        description="导入流程会先执行 dry-run 预检，再基于 importSessionId 启动正式任务。自动编码模式下，预检展示的最终编码仅用于预览，不应被前端缓存为最终主键。"
        style={{ borderRadius: token.borderRadiusLG }}
      />

      {defaultBusinessDomain ? (
        <Alert
          type="warning"
          showIcon
          icon={<WarningFilled />}
          message={`当前分类树业务域：${defaultBusinessDomain}`}
          description="工作簿实际导入仍以 Excel 中的数据为准，请确认模板中的业务域与当前操作上下文一致。"
          style={{ borderRadius: token.borderRadiusLG }}
        />
      ) : null}

      <Flex
        vertical
        align="center"
        justify="center"
        style={{
          flex: 1,
          minHeight: 0,
          borderRadius: token.borderRadiusLG,
          border: `1px dashed ${token.colorBorder}`,
          background: token.colorBgContainer,
        }}
      >
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={uploadedFile ? '文件已选择，继续下一步配置导入策略' : '请先上传工作簿'}
        />
      </Flex>
    </Flex>
  );

  const renderStep1 = () => (
    <Flex vertical gap={16}>
      <Title level={5} style={{ margin: 0 }}>编码模式</Title>
      <Flex vertical gap={12}>
        <Flex align="center" justify="space-between" style={{ gap: 16 }}>
          <Text strong style={{ minWidth: 88 }}>分类编码</Text>
          <Select
            value={formState.options.codingOptions.categoryCodeMode}
            options={CODE_MODE_OPTIONS}
            onChange={(value) => updateCodingOption('categoryCodeMode', value)}
            style={{ width: 220 }}
          />
        </Flex>
        <Flex align="center" justify="space-between" style={{ gap: 16 }}>
          <Text strong style={{ minWidth: 88 }}>属性编码</Text>
          <Select
            value={formState.options.codingOptions.attributeCodeMode}
            options={CODE_MODE_OPTIONS}
            onChange={(value) => updateCodingOption('attributeCodeMode', value)}
            style={{ width: 220 }}
          />
        </Flex>
        <Flex align="center" justify="space-between" style={{ gap: 16 }}>
          <Text strong style={{ minWidth: 88 }}>枚举值编码</Text>
          <Select
            value={formState.options.codingOptions.enumOptionCodeMode}
            options={CODE_MODE_OPTIONS}
            onChange={(value) => updateCodingOption('enumOptionCodeMode', value)}
            style={{ width: 220 }}
          />
        </Flex>
      </Flex>

      <Title level={5} style={{ margin: 0 }}>重复数据处理</Title>
      <Flex vertical gap={12}>
        <Flex align="center" justify="space-between" style={{ gap: 16 }}>
          <Text strong style={{ minWidth: 88 }}>分类重复</Text>
          <Select
            value={formState.options.duplicateOptions.categoryDuplicatePolicy}
            options={DUPLICATE_POLICY_OPTIONS}
            onChange={(value) => updateDuplicateOption('categoryDuplicatePolicy', value)}
            style={{ width: 220 }}
          />
        </Flex>
        <Flex align="center" justify="space-between" style={{ gap: 16 }}>
          <Text strong style={{ minWidth: 88 }}>属性重复</Text>
          <Select
            value={formState.options.duplicateOptions.attributeDuplicatePolicy}
            options={DUPLICATE_POLICY_OPTIONS}
            onChange={(value) => updateDuplicateOption('attributeDuplicatePolicy', value)}
            style={{ width: 220 }}
          />
        </Flex>
        <Flex align="center" justify="space-between" style={{ gap: 16 }}>
          <Text strong style={{ minWidth: 88 }}>枚举值重复</Text>
          <Select
            value={formState.options.duplicateOptions.enumOptionDuplicatePolicy}
            options={DUPLICATE_POLICY_OPTIONS}
            onChange={(value) => updateDuplicateOption('enumOptionDuplicatePolicy', value)}
            style={{ width: 220 }}
          />
        </Flex>
      </Flex>

      <Flex
        align="center"
        justify="space-between"
        style={{
          padding: '12px 16px',
          background: token.colorFillAlter,
          borderRadius: token.borderRadiusLG,
          border: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Flex vertical gap={2}>
          <Text strong style={{ fontSize: 13 }}>原子执行</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>开启后任一关键错误可能导致整个任务失败并回滚</Text>
        </Flex>
        <Switch
          checked={formState.atomic}
          onChange={(value) => {
            invalidateDryRun();
            setFormState((prev) => ({ ...prev, atomic: value }));
          }}
        />
      </Flex>

      <Alert
        type="info"
        showIcon
        icon={<InfoCircleFilled />}
        message="提交格式要求"
        description="dry-run 会以 multipart/form-data 提交，其中 options 作为单独的 JSON part 上传，不能拆成普通表单字段。"
        style={{ borderRadius: token.borderRadiusLG }}
      />
    </Flex>
  );

  const renderStep2 = () => (
    <Flex vertical gap={16} style={{ height: '100%', minHeight: 0 }}>
      {!dryRunResult && !dryRunning ? (
        <Flex vertical align="center" gap={16} style={{ padding: '40px 0' }}>
          <SafetyCertificateOutlined style={{ fontSize: 40, color: token.colorTextQuaternary }} />
          <Text type="secondary">点击开始预检，系统将解析工作簿并返回标准化预览、变更汇总与问题列表</Text>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={runDryRun}>
            开始预检
          </Button>
        </Flex>
      ) : null}

      {dryRunning ? (
        <Flex vertical align="center" gap={12} style={{ padding: '40px 0' }}>
          <Progress type="circle" percent={75} status="active" size={64} />
          <Text>正在执行 dry-run 预检...</Text>
        </Flex>
      ) : null}

      {dryRunResult ? (
        <Flex vertical gap={16} style={{ flex: 1, minHeight: 0 }}>
          <Descriptions
            size="small"
            bordered
            column={3}
            style={{ borderRadius: token.borderRadiusLG, overflow: 'hidden' }}
          >
            <Descriptions.Item label="分类行数">{dryRunResult.summary.categoryRowCount}</Descriptions.Item>
            <Descriptions.Item label="属性行数">{dryRunResult.summary.attributeRowCount}</Descriptions.Item>
            <Descriptions.Item label="枚举值行数">{dryRunResult.summary.enumRowCount}</Descriptions.Item>
            <Descriptions.Item label="错误数">
              <Text strong style={{ color: token.colorError }}>{dryRunResult.summary.errorCount}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="警告数">
              <Text strong style={{ color: token.colorWarning }}>{dryRunResult.summary.warningCount}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="可正式导入">
              {dryRunResult.summary.canImport ? <Tag color="success">允许</Tag> : <Tag color="error">不允许</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="识别模板">{dryRunResult.template.recognized ? '是' : '否'}</Descriptions.Item>
            <Descriptions.Item label="Sheet 列表" span={2}>
              <Space wrap>
                {dryRunResult.template.sheetNames.map((sheetName) => (
                  <Tag key={sheetName}>{sheetName}</Tag>
                ))}
              </Space>
            </Descriptions.Item>
          </Descriptions>

          <Flex wrap="wrap" gap={12}>
            {renderChangeCard('分类变更', dryRunResult.changeSummary.categories)}
            {renderChangeCard('属性变更', dryRunResult.changeSummary.attributes)}
            {renderChangeCard('枚举值变更', dryRunResult.changeSummary.enumOptions)}
          </Flex>

          <Alert
            type={dryRunResult.summary.canImport ? (dryRunResult.summary.warningCount > 0 ? 'warning' : 'success') : 'error'}
            showIcon
            message={dryRunResult.summary.canImport ? '预检通过，可启动正式导入' : '预检未通过，需先修正工作簿问题'}
            description={`会话 ID：${dryRunResult.importSessionId}`}
            style={{ borderRadius: token.borderRadiusLG }}
          />

          {dryRunResult.issues.length > 0 ? (
            <Flex vertical gap={6}>
              <Text strong style={{ fontSize: 13 }}>全局问题</Text>
              {dryRunResult.issues.map((issue, index) => (
                <Flex
                  key={`${issue.errorCode ?? issue.message}-${index}`}
                  align="center"
                  gap={8}
                  style={{
                    padding: '6px 12px',
                    background: issue.level === 'ERROR' ? token.colorErrorBg : token.colorWarningBg,
                    borderRadius: token.borderRadiusLG,
                    border: `1px solid ${issue.level === 'ERROR' ? token.colorErrorBorder : token.colorWarningBorder}`,
                  }}
                >
                  {issue.level === 'ERROR'
                    ? <CloseCircleFilled style={{ color: token.colorError }} />
                    : <WarningFilled style={{ color: token.colorWarning }} />}
                  <Text style={{ fontSize: 12 }}>
                    {issue.sheetName ? `${issue.sheetName} ` : ''}
                    {issue.rowNumber ? `第 ${issue.rowNumber} 行 ` : ''}
                    {issue.message}
                  </Text>
                </Flex>
              ))}
            </Flex>
          ) : null}

          <Flex vertical gap={6} style={{ flex: 1, minHeight: 0 }}>
            <Flex align="center" justify="space-between">
              <Text strong style={{ fontSize: 13 }}>预览明细</Text>
              <Button size="small" icon={<ReloadOutlined />} onClick={runDryRun}>
                重新预检
              </Button>
            </Flex>
            <div
              className="category-import-preview-scroll"
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
            >
              <Table<WorkbookImportPreviewRow>
                dataSource={previewRows}
                columns={previewColumns}
                rowKey="key"
                size="small"
                pagination={false}
                tableLayout="fixed"
                sticky={false}
                style={{ borderRadius: token.borderRadiusLG, overflow: 'hidden' }}
                locale={{ emptyText: '当前会话没有可展示的预览数据' }}
              />
            </div>
          </Flex>
        </Flex>
      ) : null}
    </Flex>
  );

  const renderExecutionResult = () => {
    if (!jobStatus || !executionFinished) {
      return null;
    }

    const resultStatus = jobStatus.status === 'FAILED'
      ? 'error'
      : aggregateProgress.failed > 0
        ? 'warning'
        : 'success';

    return (
      <Result
        status={resultStatus}
        title={jobStatus.status === 'FAILED' ? '导入失败' : aggregateProgress.failed > 0 ? '导入完成（部分失败）' : '导入完成'}
        subTitle={
          <Flex vertical align="center" gap={4}>
            <Text>
              总计 <Text strong>{aggregateProgress.total}</Text> 条，
              已处理 <Text strong>{aggregateProgress.processed}</Text> 条，
              创建 <Text strong style={{ color: token.colorSuccess }}>{aggregateProgress.created}</Text> 条，
              更新 <Text strong>{aggregateProgress.updated}</Text> 条，
              跳过 <Text strong>{aggregateProgress.skipped}</Text> 条，
              失败 <Text strong style={{ color: token.colorError }}>{aggregateProgress.failed}</Text> 条
            </Text>
          </Flex>
        }
        style={{ padding: '8px 0 0' }}
      />
    );
  };

  const renderStep3 = () => (
    <Flex vertical gap={16} style={{ height: '100%', minHeight: 0 }}>
      {importing && !jobStatus ? (
        <Flex vertical align="center" gap={16} style={{ padding: '40px 0' }}>
          <ImportOutlined style={{ fontSize: 40, color: token.colorTextQuaternary }} />
          <Text type="secondary">正在创建导入任务...</Text>
        </Flex>
      ) : null}

      {jobStatus ? (
        <Flex vertical gap={16} style={{ flex: 1, minHeight: 0 }}>
          <Alert
            type={executionFinished ? (importSucceeded ? 'success' : 'error') : 'info'}
            showIcon
            message={`${STATUS_LABELS[jobStatus.status] || jobStatus.status} · ${STAGE_LABELS[jobStatus.currentStage] || jobStatus.currentStage}`}
            description={`SSE ${sseConnected ? '已连接' : '未连接，当前依赖轮询补齐状态与日志'} · jobId: ${jobStatus.jobId}`}
            style={{ borderRadius: token.borderRadiusLG }}
          />

          <Descriptions
            size="small"
            bordered
            column={3}
            style={{ borderRadius: token.borderRadiusLG, overflow: 'hidden' }}
          >
            <Descriptions.Item label="整体进度">
              <Text strong>{jobStatus.overallPercent}%</Text>
            </Descriptions.Item>
            <Descriptions.Item label="阶段进度">
              <Text strong>{jobStatus.stagePercent}%</Text>
            </Descriptions.Item>
            <Descriptions.Item label="最新日志游标">{jobStatus.latestLogCursor || lastLogCursor || '—'}</Descriptions.Item>
            <Descriptions.Item label="开始时间">{formatDateTime(jobStatus.startedAt)}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{formatDateTime(jobStatus.updatedAt)}</Descriptions.Item>
            <Descriptions.Item label="已接收日志">{jobLogs.length}</Descriptions.Item>
          </Descriptions>

          <Progress percent={jobStatus.overallPercent} status={executionFinished ? (importSucceeded ? 'success' : 'exception') : 'active'} />

          <Flex wrap="wrap" gap={12}>
            {renderProgressCard('分类进度', jobStatus.progress.categories)}
            {renderProgressCard('属性进度', jobStatus.progress.attributes)}
            {renderProgressCard('枚举值进度', jobStatus.progress.enumOptions)}
          </Flex>

          {renderExecutionResult()}

          <Flex vertical gap={6} style={{ flex: 1, minHeight: 0 }}>
            <Text strong style={{ fontSize: 13 }}>执行日志</Text>
            <div
              className="category-import-preview-scroll"
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
            >
              <Table<WorkbookImportLogEventDto>
                dataSource={jobLogs}
                columns={logColumns}
                rowKey={(record) => record.cursor ?? String(record.sequence ?? `${record.timestamp ?? ''}-${record.message}`)}
                size="small"
                pagination={false}
                tableLayout="fixed"
                sticky={false}
                style={{ borderRadius: token.borderRadiusLG, overflow: 'hidden' }}
                locale={{ emptyText: '当前还没有导入日志' }}
              />
            </div>
          </Flex>
        </Flex>
      ) : null}
    </Flex>
  );

  const renderFooter = () => (
    <Flex align="center" style={{ width: '100%' }}>
      {currentStep > 0 && currentStep < 3 && !dryRunning ? (
        <Button icon={<ArrowLeftOutlined />} onClick={goPrev}>
          上一步
        </Button>
      ) : null}

      <Flex gap={8} justify="flex-end" style={{ marginLeft: 'auto' }}>
        {currentStep === 3 ? (
          <Button
            type="primary"
            disabled={!executionFinished}
            onClick={() => {
              if (!executionFinished) {
                return;
              }

              if (importSucceeded) {
                onSuccess?.();
              }
              handleCancel();
            }}
          >
            {importSucceeded ? '完成' : '关闭'}
          </Button>
        ) : (
          <>
            <Button onClick={handleCancel} disabled={dryRunning || importing}>
              取消
            </Button>
            <Button
              type="primary"
              icon={currentStep === 2 ? <ImportOutlined /> : <ArrowRightOutlined />}
              onClick={currentStep === 2 ? handleConfirmImport : goNext}
              disabled={!canGoNext || dryRunning}
            >
              {currentStep === 2 ? '确认导入' : '下一步'}
            </Button>
          </>
        )}
      </Flex>
    </Flex>
  );

  return (
    <DraggableModal
      open={open}
      title="导入元数据工作簿"
      width="80%"
      footer={renderFooter()}
      onCancel={handleCancel}
      maskClosable={false}
      keyboard={false}
      closable={!importing}
      styles={{
        body: {
          height: MODAL_BODY_HEIGHT,
          minHeight: MODAL_BODY_HEIGHT,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Steps
        current={currentStep}
        size="small"
        style={{ marginBottom: 20 }}
        items={IMPORT_STEPS.map((step, index) => ({
          title: step.title,
          status: stepStatuses[index],
          icon: STEP_ICONS[index],
        }))}
      />

      <div style={{ flex: 1, minHeight: 0, overflow: currentStep === 0 || currentStep === 2 || currentStep === 3 ? 'hidden' : 'auto' }}>
        {currentStep === 0 && renderStep0()}
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </div>

      <style jsx global>{`
        .category-import-preview-scroll {
          scrollbar-width: thin;
          scrollbar-color: ${token.colorBorder} transparent;
        }

        .category-import-preview-scroll::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }

        .category-import-preview-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .category-import-preview-scroll::-webkit-scrollbar-thumb {
          background: ${token.colorBorder};
          border: 3px solid transparent;
          border-radius: 999px;
          background-clip: padding-box;
        }

        .category-import-preview-scroll::-webkit-scrollbar-thumb:hover {
          background: ${token.colorTextQuaternary};
          border: 3px solid transparent;
          background-clip: padding-box;
        }
      `}</style>
    </DraggableModal>
  );
};

export default WorkbookImportModal;