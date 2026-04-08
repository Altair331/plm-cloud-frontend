'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  App,
  Button,
  Checkbox,
  Empty,
  Flex,
  Result,
  Segmented,
  Select,
  Space,
  Splitter,
  Steps,
  Switch,
  Tree,
  Typography,
  theme,
} from 'antd';
import {
  CheckCircleFilled,
  DeleteOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  HolderOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { AgGridReact } from 'ag-grid-react';
import {
  type CellStyle,
  type CellValueChangedEvent,
  type ColDef,
  type ICellRendererParams,
  ModuleRegistry,
  AllCommunityModule,
  type RowDragEndEvent,
  themeQuartz,
} from 'ag-grid-community';
import DraggableModal from '@/components/DraggableModal';
import type { ExportColumnMapping, ExportPreviewRow } from './types';
import {
  type WorkbookExportConfig,
  type WorkbookExportModuleKey,
  type WorkbookExportProfile,
  type WorkbookExportStep,
  WORKBOOK_BUILT_IN_PROFILES,
  WORKBOOK_EXPORT_MODULES,
  WORKBOOK_EXPORT_STEPS,
  WORKBOOK_MOCK_TREE_DATA,
  cloneWorkbookExportConfig,
  getInitialWorkbookSelection,
  getWorkbookModuleFields,
  getWorkbookModuleRows,
  resolveWorkbookScopeData,
} from './workbookTypes';

ModuleRegistry.registerModules([AllCommunityModule]);

const { Text } = Typography;

const PROFILES_STORAGE_KEY = 'plm_workbook_export_profiles';

interface WorkbookExportModalProps {
  open: boolean;
  checkedKeys: React.Key[];
  onCancel: () => void;
  onSuccess?: () => void;
}

interface PreviewSheetRow extends ExportPreviewRow {
  __sheetKind?: 'header';
}

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

const loadProfiles = (): WorkbookExportProfile[] => {
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WorkbookExportProfile[];
      return [...WORKBOOK_BUILT_IN_PROFILES, ...parsed.filter((profile) => !profile.isBuiltIn)];
    }
  } catch {
    // ignore local storage errors in mock mode
  }

  return [...WORKBOOK_BUILT_IN_PROFILES];
};

const saveCustomProfiles = (profiles: WorkbookExportProfile[]) => {
  const customProfiles = profiles.filter((profile) => !profile.isBuiltIn);
  localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(customProfiles));
};

const getDefaultConfig = (): WorkbookExportConfig => cloneWorkbookExportConfig(WORKBOOK_BUILT_IN_PROFILES[0].config);

const normalizeCheckedKeys = (keys: React.Key[]): Array<string | number> => {
  return keys.map((key) => (typeof key === 'number' ? key : String(key)));
};

const WorkbookExportModal: React.FC<WorkbookExportModalProps> = ({
  open,
  checkedKeys,
  onCancel,
  onSuccess,
}) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const previewGridRef = useRef<AgGridReact>(null);

  const [currentStep, setCurrentStep] = useState<WorkbookExportStep>(0);
  const [profiles, setProfiles] = useState<WorkbookExportProfile[]>(loadProfiles);
  const [activeProfileId, setActiveProfileId] = useState<string>('workbook_profile_standard');
  const [config, setConfig] = useState<WorkbookExportConfig>(getDefaultConfig);
  const [selectedNodeKeys, setSelectedNodeKeys] = useState<string[]>(() => getInitialWorkbookSelection(normalizeCheckedKeys(checkedKeys)));
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>(['cat_001']);
  const [activeModule, setActiveModule] = useState<WorkbookExportModuleKey>('category');
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setProfiles(loadProfiles());
    setCurrentStep(0);
    setActiveProfileId('workbook_profile_standard');
    setConfig(getDefaultConfig());
    setSelectedNodeKeys(getInitialWorkbookSelection(normalizeCheckedKeys(checkedKeys)));
    setExpandedKeys(['cat_001']);
    setActiveModule('category');
    setGenerated(false);
  }, [open, checkedKeys]);

  const scopeData = useMemo(() => {
    return resolveWorkbookScopeData(selectedNodeKeys, config.includeChildren);
  }, [selectedNodeKeys, config.includeChildren]);

  const moduleCounts = useMemo(() => ({
    category: scopeData.categories.length,
    attribute: scopeData.attributes.length,
    enumOption: scopeData.enumOptions.length,
  }), [scopeData.attributes.length, scopeData.categories.length, scopeData.enumOptions.length]);

  const enabledModuleKeys = useMemo(() => {
    return WORKBOOK_EXPORT_MODULES
      .filter((module) => config.modules[module.key].enabled)
      .map((module) => module.key);
  }, [config.modules]);

  useEffect(() => {
    if (enabledModuleKeys.length === 0) {
      return;
    }

    if (!enabledModuleKeys.includes(activeModule)) {
      setActiveModule(enabledModuleKeys[0]);
    }
  }, [activeModule, enabledModuleKeys]);

  const currentModuleConfig = config.modules[activeModule];

  const enabledColumns = useMemo(() => {
    return currentModuleConfig.columns.filter((column) => column.enabled);
  }, [currentModuleConfig.columns]);

  const activeModuleMeta = useMemo(() => {
    return WORKBOOK_EXPORT_MODULES.find((module) => module.key === activeModule) || WORKBOOK_EXPORT_MODULES[0];
  }, [activeModule]);

  const segmentedOptions = useMemo(() => {
    return WORKBOOK_EXPORT_MODULES.map((module) => ({
      value: module.key,
      label: `${module.label} ${moduleCounts[module.key]}`,
      disabled: !config.modules[module.key].enabled,
    }));
  }, [config.modules, moduleCounts]);

  const previewRows = useMemo(() => {
    return getWorkbookModuleRows(activeModule, scopeData, currentModuleConfig.columns, config.pathSeparator).slice(0, 10);
  }, [activeModule, config.pathSeparator, currentModuleConfig.columns, scopeData]);

  const previewGridKey = useMemo(() => {
    return [activeModule, ...currentModuleConfig.columns.map((column) => `${column.id}:${column.targetHeader}`)].join('|');
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
      headerRow[column.targetHeader] = column.targetHeader;
    });
    return [headerRow];
  }, [enabledColumns]);

  const availableFields = useMemo(() => {
    const mappedFields = new Set(currentModuleConfig.columns.map((column) => column.sourceField));
    return getWorkbookModuleFields(activeModule).filter((field) => !mappedFields.has(field.field));
  }, [activeModule, currentModuleConfig.columns]);

  const previewColDefs = useMemo<ColDef[]>(() => {
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
      field: column.targetHeader,
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

  const mappingIndexCellStyle: CellStyle = useMemo(() => ({
    textAlign: 'center',
    color: token.colorTextSecondary,
    fontWeight: 600,
  }), [token.colorTextSecondary]);

  const mappingCenteredCellStyle: CellStyle = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }), []);

  const updateModuleConfig = useCallback((moduleKey: WorkbookExportModuleKey, updater: (current: WorkbookExportConfig['modules'][WorkbookExportModuleKey]) => WorkbookExportConfig['modules'][WorkbookExportModuleKey]) => {
    setConfig((prev) => ({
      ...prev,
      modules: {
        ...prev.modules,
        [moduleKey]: updater(prev.modules[moduleKey]),
      },
    }));
  }, []);

  const handleProfileChange = useCallback((profileId: string) => {
    setActiveProfileId(profileId);
    const matchedProfile = profiles.find((profile) => profile.id === profileId);
    if (!matchedProfile) {
      return;
    }
    const nextConfig = cloneWorkbookExportConfig(matchedProfile.config);
    setConfig(nextConfig);
    const nextActiveModule = WORKBOOK_EXPORT_MODULES.find((module) => nextConfig.modules[module.key].enabled)?.key || 'category';
    setActiveModule(nextActiveModule);
  }, [profiles]);

  const handleSaveAsProfile = useCallback(() => {
    const name = `工作簿导出方案 ${profiles.filter((profile) => !profile.isBuiltIn).length + 1}`;
    const newProfile: WorkbookExportProfile = {
      id: `workbook_profile_custom_${Date.now()}`,
      name,
      isBuiltIn: false,
      config: cloneWorkbookExportConfig(config),
    };
    const nextProfiles = [...profiles, newProfile];
    setProfiles(nextProfiles);
    setActiveProfileId(newProfile.id);
    saveCustomProfiles(nextProfiles);
    message.success(`方案“${name}”已保存`);
  }, [config, message, profiles]);

  const handleAddField = useCallback((field: string) => {
    const sourceField = getWorkbookModuleFields(activeModule).find((item) => item.field === field);
    if (!sourceField) {
      return;
    }
    updateModuleConfig(activeModule, (current) => ({
      ...current,
      columns: [
        ...current.columns,
        {
          id: `col_${field}_${Date.now()}`,
          sourceField: sourceField.field,
          sourceLabel: sourceField.label,
          targetHeader: sourceField.label,
          enabled: true,
        },
      ],
    }));
  }, [activeModule, updateModuleConfig]);

  const handleRemoveColumn = useCallback((columnId: string) => {
    updateModuleConfig(activeModule, (current) => ({
      ...current,
      columns: current.columns.filter((column) => column.id !== columnId),
    }));
  }, [activeModule, updateModuleConfig]);

  const handleRenameColumnHeader = useCallback((columnId: string, header: string) => {
    updateModuleConfig(activeModule, (current) => ({
      ...current,
      columns: current.columns.map((column) => column.id === columnId ? { ...column, targetHeader: header } : column),
    }));
  }, [activeModule, updateModuleConfig]);

  const handleMappingCellValueChanged = useCallback((event: CellValueChangedEvent<ExportColumnMapping>) => {
    if (!event.data || event.colDef.field !== 'targetHeader') {
      return;
    }

    const nextHeader = String(event.newValue ?? '').trim();
    const previousHeader = String(event.oldValue ?? '').trim();

    if (!nextHeader) {
      event.node.setDataValue('targetHeader', previousHeader || event.data.targetHeader);
      return;
    }

    if (nextHeader === previousHeader) {
      return;
    }

    handleRenameColumnHeader(event.data.id, nextHeader);
  }, [handleRenameColumnHeader]);

  const handleMappingRowDragEnd = useCallback((event: RowDragEndEvent<ExportColumnMapping>) => {
    const reorderedColumns: ExportColumnMapping[] = [];
    event.api.forEachNode((node) => {
      if (node.data) {
        reorderedColumns.push(node.data);
      }
    });

    if (reorderedColumns.length !== currentModuleConfig.columns.length) {
      return;
    }

    updateModuleConfig(activeModule, (current) => ({
      ...current,
      columns: reorderedColumns,
    }));
  }, [activeModule, currentModuleConfig.columns.length, updateModuleConfig]);

  const mappingColDefs = useMemo<ColDef<ExportColumnMapping>[]>(() => ([
    {
      headerName: '列号',
      width: 72,
      minWidth: 72,
      maxWidth: 72,
      sortable: false,
      resizable: false,
      suppressMovable: true,
      suppressHeaderMenuButton: true,
      cellRenderer: (params: ICellRendererParams<ExportColumnMapping>) => {
        const rowData = params.data;
        if (!rowData) {
          return null;
        }
        const columnLabel = rowData.enabled ? (previewColumnLetterMap.get(rowData.id) ?? '-') : '-';
        return (
          <div
            ref={(element) => {
              if (element) {
                params.registerRowDragger?.(element, 4, `排序 ${rowData.targetHeader}`);
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
      field: 'sourceLabel',
      minWidth: 140,
      flex: 1,
      editable: false,
      suppressMovable: true,
      suppressHeaderMenuButton: true,
    },
    {
      headerName: '导出表头',
      field: 'targetHeader',
      minWidth: 180,
      flex: 1.4,
      editable: true,
      singleClickEdit: true,
      suppressMovable: true,
      suppressHeaderMenuButton: true,
    },
    {
      headerName: '操作',
      minWidth: 72,
      width: 72,
      maxWidth: 72,
      pinned: 'right',
      lockPosition: 'right',
      sortable: false,
      resizable: false,
      suppressMovable: true,
      suppressHeaderMenuButton: true,
      cellStyle: mappingCenteredCellStyle,
      cellRenderer: (params: { data?: ExportColumnMapping }) => {
        if (!params.data) {
          return null;
        }
        return (
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleRemoveColumn(params.data!.id)}
          />
        );
      },
    },
  ]), [handleRemoveColumn, mappingCenteredCellStyle, mappingIndexCellStyle, previewColumnLetterMap]);

  const canGoNext = useMemo(() => {
    if (currentStep === 0) {
      return selectedNodeKeys.length > 0 && enabledModuleKeys.length > 0;
    }
    if (currentStep === 1) {
      return enabledModuleKeys.length > 0 && enabledColumns.length > 0;
    }
    return false;
  }, [currentStep, enabledColumns.length, enabledModuleKeys.length, selectedNodeKeys.length]);

  const handleGenerate = useCallback(() => {
    const enabledModules = WORKBOOK_EXPORT_MODULES.filter((module) => config.modules[module.key].enabled);
    const payload = {
      mode: 'mock-workbook-export',
      targetFormat: config.fileFormat,
      generatedAt: new Date().toISOString(),
      includeChildren: config.includeChildren,
      selectedNodeKeys,
      modules: enabledModules.map((module) => ({
        key: module.key,
        label: module.label,
        totalRows: getWorkbookModuleRows(
          module.key,
          scopeData,
          config.modules[module.key].columns,
          config.pathSeparator,
        ).length,
        columns: config.modules[module.key].columns,
        previewRows: getWorkbookModuleRows(
          module.key,
          scopeData,
          config.modules[module.key].columns,
          config.pathSeparator,
        ),
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `workbook-export-mock-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    setGenerated(true);
    onSuccess?.();
  }, [config.fileFormat, config.includeChildren, config.modules, config.pathSeparator, onSuccess, scopeData, selectedNodeKeys]);

  const renderScopeStep = () => (
    <div style={{ display: 'flex', gap: 16, height: '100%' }}>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusLG,
          padding: 12,
          overflow: 'auto',
        }}
      >
        <div style={{ marginBottom: 8 }}>
          <Text strong style={{ fontSize: 13 }}>分类节点</Text>
          <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
            已选 {selectedNodeKeys.length} 个节点
            {config.includeChildren && scopeData.categories.length > selectedNodeKeys.length ? `，递归后共 ${scopeData.categories.length} 条分类` : ''}
          </Text>
        </div>
        <Tree
          checkable
          checkedKeys={selectedNodeKeys}
          expandedKeys={expandedKeys}
          onExpand={setExpandedKeys}
          onCheck={(keys) => {
            const nextKeys = Array.isArray(keys) ? keys : keys.checked;
            setSelectedNodeKeys(nextKeys.map(String));
          }}
          treeData={WORKBOOK_MOCK_TREE_DATA}
          style={{ fontSize: 13 }}
        />
      </div>

      <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: token.colorFillAlter, borderRadius: token.borderRadiusLG, padding: 12 }}>
          <Text strong style={{ display: 'block', marginBottom: 10 }}>导出数据块</Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {WORKBOOK_EXPORT_MODULES.map((module) => (
              <label
                key={module.key}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  padding: '8px 10px',
                  borderRadius: token.borderRadius,
                  background: config.modules[module.key].enabled ? token.colorBgContainer : token.colorBgContainerDisabled,
                  border: `1px solid ${config.modules[module.key].enabled ? token.colorPrimaryBorder : token.colorBorderSecondary}`,
                  cursor: 'pointer',
                }}
              >
                <Checkbox
                  checked={config.modules[module.key].enabled}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    setConfig((prev) => ({
                      ...prev,
                      modules: {
                        ...prev.modules,
                        [module.key]: {
                          ...prev.modules[module.key],
                          enabled,
                        },
                      },
                    }));
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <Flex align="center" justify="space-between" style={{ gap: 8 }}>
                    <Text strong style={{ fontSize: 13 }}>{module.label}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{moduleCounts[module.key]} 条</Text>
                  </Flex>
                  <Text type="secondary" style={{ fontSize: 12 }}>{module.description}</Text>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div style={{ background: token.colorFillAlter, borderRadius: token.borderRadiusLG, padding: 12 }}>
          <Flex align="center" justify="space-between" style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 13 }}>递归导出</Text>
            <Switch
              size="small"
              checked={config.includeChildren}
              onChange={(value) => setConfig((prev) => ({ ...prev, includeChildren: value }))}
            />
          </Flex>
          <Text type="secondary" style={{ fontSize: 12 }}>开启后将自动带出所选分类下全部属性与枚举值</Text>
        </div>

        <div style={{ background: token.colorFillAlter, borderRadius: token.borderRadiusLG, padding: 12 }}>
          <Text style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>路径分隔符</Text>
          <Select
            size="small"
            style={{ width: '100%' }}
            value={config.pathSeparator}
            options={[
              { value: ' > ', label: '> （大于号）' },
              { value: ' / ', label: '/ （斜杠）' },
              { value: ' - ', label: '- （短横线）' },
              { value: '.', label: '. （点号）' },
            ]}
            onChange={(value) => setConfig((prev) => ({ ...prev, pathSeparator: value }))}
          />
        </div>

        <div style={{ background: token.colorFillAlter, borderRadius: token.borderRadiusLG, padding: 12 }}>
          <Text style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>目标格式</Text>
          <Select
            size="small"
            style={{ width: '100%' }}
            value={config.fileFormat}
            options={[
              { value: 'xlsx', label: 'Excel (.xlsx)' },
              { value: 'csv', label: 'CSV (.csv)' },
            ]}
            onChange={(value) => setConfig((prev) => ({ ...prev, fileFormat: value }))}
          />
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
            当前阶段仅生成 mock 工作簿文件，用于验证前端导出页面与配置结构。
          </Text>
        </div>
      </div>
    </div>
  );

  const renderPreviewPanel = () => {
    if (!config.modules[activeModule].enabled) {
      return <Empty description="当前数据块未启用" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    if (enabledColumns.length === 0) {
      return <Empty description="当前数据块没有可导出的字段" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    if (previewRows.length === 0) {
      return <Empty description="当前范围下暂无可预览数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    return (
      <div className="workbook-export-preview-grid" style={{ flex: 1, minHeight: 0 }}>
        <AgGridReact
          key={previewGridKey}
          ref={previewGridRef}
          theme={themeQuartz}
          rowData={previewRows}
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

  const renderMappingPreviewStep = () => (
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
              options={segmentedOptions}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Flex align="center" justify="space-between" gap={8}>
                <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>方案</Text>
                <Button size="small" onClick={handleSaveAsProfile}>另存</Button>
              </Flex>
              <Select
                size="small"
                style={{ width: '100%' }}
                value={activeProfileId}
                onChange={handleProfileChange}
                options={profiles.map((profile) => ({
                  value: profile.id,
                  label: profile.name,
                }))}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Flex align="center" justify="space-between" gap={8}>
                <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>字段</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>已启用 {enabledColumns.length} 个</Text>
              </Flex>
              {availableFields.length > 0 ? (
                <Select
                  size="small"
                  placeholder="添加字段..."
                  style={{ width: '100%' }}
                  value={null}
                  onChange={handleAddField}
                  options={availableFields.map((field) => ({ value: field.field, label: field.label }))}
                />
              ) : (
                <div
                  style={{
                    minHeight: 32,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 11px',
                    borderRadius: token.borderRadius,
                    border: `1px dashed ${token.colorBorderSecondary}`,
                    background: token.colorBgContainer,
                  }}
                >
                  <Text type="secondary" style={{ fontSize: 12 }}>已包含全部可选字段</Text>
                </div>
              )}
            </div>
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
            <span>单击“导出表头”列即可编辑，右侧预览将按当前数据块实时更新</span>
          </div>

          <div className="workbook-export-mapping-grid" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <AgGridReact<ExportColumnMapping>
              rowData={currentModuleConfig.columns}
              columnDefs={mappingColDefs}
              theme={themeQuartz}
              getRowId={(params) => params.data.id}
              defaultColDef={{
                sortable: false,
                resizable: false,
                suppressHeaderMenuButton: true,
              }}
              headerHeight={36}
              rowHeight={42}
              rowDragManaged={true}
              animateRows={true}
              stopEditingWhenCellsLoseFocus={true}
              suppressHorizontalScroll={true}
              onCellValueChanged={handleMappingCellValueChanged}
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
                {WORKBOOK_EXPORT_MODULES.find((module) => module.key === activeModule)?.label} 预览前 {Math.min(10, moduleCounts[activeModule])} 条，共 {moduleCounts[activeModule]} 条
              </Text>
            </Flex>
            <Text type="secondary" style={{ fontSize: 12 }}>启用字段 {enabledColumns.length} 个</Text>
          </Flex>
          {renderPreviewPanel()}
        </div>
      </Splitter.Panel>
    </Splitter>
  );

  const renderGenerateStep = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
      {generated ? (
        <Result
          icon={<CheckCircleFilled style={{ color: token.colorSuccess }} />}
          title="mock 工作簿文件已生成"
          subTitle={`已整理 ${enabledModuleKeys.length} 个数据块，分类 ${moduleCounts.category} 条，属性 ${moduleCounts.attribute} 条，枚举值 ${moduleCounts.enumOption} 条`}
          extra={<Button type="primary" onClick={onCancel}>关闭</Button>}
        />
      ) : (
        <>
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
            <Flex justify="space-between"><Text type="secondary">目标格式</Text><Text>{config.fileFormat === 'xlsx' ? 'Excel (.xlsx)' : 'CSV (.csv)'}</Text></Flex>
            <Flex justify="space-between"><Text type="secondary">导出范围</Text><Text>{scopeData.categories.length} 条分类</Text></Flex>
            {enabledModuleKeys.map((moduleKey) => {
              const module = WORKBOOK_EXPORT_MODULES.find((item) => item.key === moduleKey);
              return (
                <Flex key={moduleKey} justify="space-between">
                  <Text type="secondary">{module?.label} Sheet</Text>
                  <Text>{moduleCounts[moduleKey]} 条</Text>
                </Flex>
              );
            })}
            <Text type="secondary" style={{ fontSize: 12 }}>
              当前下载内容为 mock 工作簿 JSON，用于前端页面联调与字段配置确认。
            </Text>
          </div>
          <Button type="primary" size="large" icon={<DownloadOutlined />} onClick={handleGenerate}>
            生成 mock 工作簿
          </Button>
        </>
      )}
    </div>
  );

  const stepRenderers = [renderScopeStep, renderMappingPreviewStep, renderGenerateStep];

  return (
    <DraggableModal
      open={open}
      title="导出完整数据"
      width="80%"
      footer={null}
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
        {stepRenderers[currentStep]()}
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

        .workbook-export-mapping-grid .ag-header-cell,
        .workbook-export-mapping-grid .ag-cell {
          border-right: 0;
          box-shadow: none;
        }

        .workbook-export-preview-grid .ag-header-cell,
        .workbook-export-preview-grid .ag-cell {
          border-right: 1px solid ${token.colorBorderSecondary};
        }

        .workbook-export-mapping-grid .ag-pinned-right-header,
        .workbook-export-mapping-grid .ag-pinned-right-cols-container {
          border-left: 0;
          margin-left: 0;
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

        .workbook-export-mapping-grid .ag-body-horizontal-scroll {
          display: none;
        }
      `}</style>

      {currentStep < 2 ? (
        <Flex justify="space-between" align="center">
          <Text type="secondary" style={{ fontSize: 12 }}>步骤 {currentStep + 1} / {WORKBOOK_EXPORT_STEPS.length}</Text>
          <Space>
            {currentStep > 0 ? (
              <Button onClick={() => setCurrentStep((step) => Math.max(step - 1, 0) as WorkbookExportStep)}>
                上一步
              </Button>
            ) : null}
            <Button
              type="primary"
              disabled={!canGoNext}
              onClick={() => setCurrentStep((step) => Math.min(step + 1, 2) as WorkbookExportStep)}
            >
              {currentStep === 1 ? '下一步：生成文件' : '下一步'}
            </Button>
          </Space>
        </Flex>
      ) : null}
    </DraggableModal>
  );
};

export default WorkbookExportModal;