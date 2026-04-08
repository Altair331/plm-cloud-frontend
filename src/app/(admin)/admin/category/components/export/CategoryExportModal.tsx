'use client';

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  Steps,
  Tree,
  Switch,
  Select,
  Button,
  Space,
  Typography,
  Input,
  Checkbox,
  Tag,
  Result,
  Tooltip,
  Flex,
  Splitter,
  theme,
  App,
} from 'antd';
import {
  DeleteOutlined,
  HolderOutlined,
  PlusOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  CheckCircleFilled,
  InfoCircleOutlined,
  SettingOutlined,
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

ModuleRegistry.registerModules([AllCommunityModule]);
import DraggableModal from '@/components/DraggableModal';
import {
  type ExportStep,
  type ExportProfile,
  type ExportConfig,
  type ExportColumnMapping,
  type TransformRule,
  type ExportPreviewRow,
  type MockCategoryNode,
  EXPORT_STEPS,
  SYSTEM_FIELDS,
  PATH_SEPARATOR_OPTIONS,
  DATE_FORMAT_OPTIONS,
  BUILT_IN_PROFILES,
  MOCK_CATEGORY_TREE,
  mockTreeToDataNodes,
  resolveSelectedNodes,
  buildPreviewRows,
} from './types';

const { Text } = Typography;

// ================= localStorage 方案持久化 =================
const PROFILES_STORAGE_KEY = 'plm_export_profiles';

const loadProfiles = (): ExportProfile[] => {
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ExportProfile[];
      return [...BUILT_IN_PROFILES, ...parsed.filter(p => !p.isBuiltIn)];
    }
  } catch { /* fallback */ }
  return [...BUILT_IN_PROFILES];
};

const saveCustomProfiles = (profiles: ExportProfile[]) => {
  const custom = profiles.filter(p => !p.isBuiltIn);
  localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(custom));
};

// ================= 默认配置 =================
const createDefaultConfig = (): ExportConfig => ({
  includeChildren: true,
  pathSeparator: ' > ',
  fileFormat: 'xlsx',
  dateFormat: 'YYYY-MM-DD',
  numberPrecision: 2,
  columns: SYSTEM_FIELDS
    .filter(f => ['code', 'name', 'path', 'level', 'parentCode', 'description', 'status'].includes(f.field))
    .map((f, idx) => ({
      id: `col_${idx}`,
      sourceField: f.field,
      sourceLabel: f.label,
      targetHeader: f.label,
      enabled: true,
    })),
  transformRules: [],
});

// ================= Props =================
interface CategoryExportModalProps {
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

const CategoryExportModal: React.FC<CategoryExportModalProps> = ({
  open,
  checkedKeys,
  onCancel,
  onSuccess,
}) => {
  const { token } = theme.useToken();
  const { message: messageApi } = App.useApp();
  const previewGridRef = useRef<AgGridReact>(null);

  // === 步骤状态 ===
  const [currentStep, setCurrentStep] = useState<ExportStep>(0);

  // === 方案状态 ===
  const [profiles, setProfiles] = useState<ExportProfile[]>(loadProfiles);
  const [activeProfileId, setActiveProfileId] = useState<string>('profile_standard');

  // === 导出配置 ===
  const [config, setConfig] = useState<ExportConfig>(createDefaultConfig);

  // === 树选择状态 ===
  const [selectedNodeKeys, setSelectedNodeKeys] = useState<React.Key[]>(() => [...checkedKeys]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>(['cat_001']);

  // === 生成完成标记 ===
  const [generated, setGenerated] = useState(false);

  // 同步 checkedKeys → selectedNodeKeys
  React.useEffect(() => {
    if (open) {
      setSelectedNodeKeys([...checkedKeys]);
      setCurrentStep(0);
      setGenerated(false);
    }
  }, [open, checkedKeys]);

  // === 树数据 ===
  const treeData = useMemo(() => mockTreeToDataNodes(MOCK_CATEGORY_TREE), []);

  // === 已选节点拉平 ===
  const resolvedNodes = useMemo(() => {
    const idSet = new Set(selectedNodeKeys.map(String));
    return resolveSelectedNodes(MOCK_CATEGORY_TREE, idSet, config.includeChildren);
  }, [selectedNodeKeys, config.includeChildren]);

  // === 预览数据 ===
  const previewRows = useMemo(() => {
    if (!config.columns.some(column => column.enabled)) {
      return [];
    }

    return buildPreviewRows(resolvedNodes.slice(0, 10), config.columns, config.transformRules, config.pathSeparator);
  }, [resolvedNodes, config.columns, config.transformRules, config.pathSeparator]);

  const enabledColumns = useMemo(() => {
    return config.columns.filter(column => column.enabled);
  }, [config.columns]);

  const previewColumnLetterMap = useMemo(() => {
    const labelMap = new Map<string, string>();
    enabledColumns.forEach((column, index) => {
      labelMap.set(column.id, toExcelColumnLabel(index));
    });
    return labelMap;
  }, [enabledColumns]);

  const previewPinnedTopRowData = useMemo<PreviewSheetRow[]>(() => {
    if (enabledColumns.length === 0) {
      return [];
    }

    const headerRow: PreviewSheetRow = { key: '__preview_header__', __sheetKind: 'header' };
    enabledColumns.forEach(column => {
      headerRow[column.targetHeader] = column.targetHeader;
    });
    return [headerRow];
  }, [enabledColumns]);

  const previewGridKey = useMemo(() => {
    return enabledColumns
      .map(column => `${column.id}:${column.targetHeader}`)
      .join('|');
  }, [enabledColumns]);

  // === AG Grid 预览列定义 ===
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
      cellStyle: params => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        color: token.colorTextSecondary,
        background: params.node?.rowPinned ? token.colorFillAlter : token.colorBgContainer,
        fontWeight: params.node?.rowPinned ? 600 : 500,
        borderRight: `1px solid ${token.colorBorderSecondary}`,
      }),
      valueGetter: params => {
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
      minWidth: 120,
      resizable: true,
      editable: false,
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

  // === 可添加字段列表（不在映射中） ===
  const availableFields = useMemo(() => {
    const mappedFields = new Set(config.columns.map(c => c.sourceField));
    return SYSTEM_FIELDS.filter(f => !mappedFields.has(f.field));
  }, [config.columns]);

  // === 方案操作 ===
  const handleProfileChange = useCallback((profileId: string) => {
    setActiveProfileId(profileId);
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      setConfig({ ...profile.config });
    }
  }, [profiles]);

  const handleSaveAsProfile = useCallback(() => {
    const name = `自定义方案 ${profiles.filter(p => !p.isBuiltIn).length + 1}`;
    const newProfile: ExportProfile = {
      id: `profile_custom_${Date.now()}`,
      name,
      isBuiltIn: false,
      config: { ...config, columns: config.columns.map(c => ({ ...c })), transformRules: config.transformRules.map(r => ({ ...r })) },
    };
    const updated = [...profiles, newProfile];
    setProfiles(updated);
    setActiveProfileId(newProfile.id);
    saveCustomProfiles(updated);
    messageApi.success(`方案 "${name}" 已保存`);
  }, [config, profiles, messageApi]);

  // === 列映射操作 ===
  const moveColumn = useCallback((index: number, direction: 'up' | 'down') => {
    setConfig(prev => {
      const cols = [...prev.columns];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= cols.length) return prev;
      [cols[index], cols[target]] = [cols[target], cols[index]];
      return { ...prev, columns: cols };
    });
  }, []);

  const toggleColumn = useCallback((index: number) => {
    setConfig(prev => {
      const cols = [...prev.columns];
      cols[index] = { ...cols[index], enabled: !cols[index].enabled };
      return { ...prev, columns: cols };
    });
  }, []);

  const removeColumn = useCallback((index: number) => {
    setConfig(prev => ({
      ...prev,
      columns: prev.columns.filter((_, i) => i !== index),
    }));
  }, []);

  const renameColumnHeader = useCallback((index: number, header: string) => {
    setConfig(prev => {
      const cols = [...prev.columns];
      cols[index] = { ...cols[index], targetHeader: header };
      return { ...prev, columns: cols };
    });
  }, []);

  const addField = useCallback((field: string) => {
    const sys = SYSTEM_FIELDS.find(f => f.field === field);
    if (!sys) return;
    setConfig(prev => ({
      ...prev,
      columns: [
        ...prev.columns,
        {
          id: `col_${Date.now()}`,
          sourceField: sys.field,
          sourceLabel: sys.label,
          targetHeader: sys.label,
          enabled: true,
        },
      ],
    }));
  }, []);

  // === 转换规则操作 ===
  const addTransformRule = useCallback(() => {
    const newRule: TransformRule = {
      id: `tr_${Date.now()}`,
      field: config.columns[0]?.sourceField || 'code',
      type: 'PREFIX',
      config: { prefix: '' },
    };
    setConfig(prev => ({ ...prev, transformRules: [...prev.transformRules, newRule] }));
  }, [config.columns]);

  const removeTransformRule = useCallback((id: string) => {
    setConfig(prev => ({
      ...prev,
      transformRules: prev.transformRules.filter(r => r.id !== id),
    }));
  }, []);

  const updateTransformRule = useCallback((id: string, patch: Partial<TransformRule>) => {
    setConfig(prev => ({
      ...prev,
      transformRules: prev.transformRules.map(r => r.id === id ? { ...r, ...patch } : r),
    }));
  }, []);

  // === 模拟下载 ===
  const handleGenerate = useCallback(() => {
    const enabledCols = config.columns.filter(c => c.enabled);
    // 模拟生成 CSV 内容
    const header = enabledCols.map(c => c.targetHeader).join(',');
    const rows = previewRows.map(row =>
      enabledCols.map(c => String(row[c.targetHeader] ?? '')).join(','),
    );
    const csvContent = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ext = config.fileFormat === 'xlsx' ? 'xlsx' : 'csv';
    a.download = `category-export-${new Date().toISOString().slice(0, 10)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setGenerated(true);
    onSuccess?.();
  }, [config, previewRows, onSuccess]);

  // === 步骤导航 ===
  const canGoNext = useMemo(() => {
    if (currentStep === 0) return selectedNodeKeys.length > 0;
    if (currentStep === 1) return config.columns.some(c => c.enabled);
    return false;
  }, [currentStep, selectedNodeKeys, config.columns]);

  const handleNext = () => setCurrentStep(s => Math.min(s + 1, 2) as ExportStep);
  const handlePrev = () => setCurrentStep(s => Math.max(s - 1, 0) as ExportStep);

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

    const columnIndex = config.columns.findIndex(column => column.id === event.data?.id);
    if (columnIndex >= 0) {
      renameColumnHeader(columnIndex, nextHeader);
    }
  }, [config.columns, renameColumnHeader]);

  const handleMappingRowDragEnd = useCallback((event: RowDragEndEvent<ExportColumnMapping>) => {
    const reorderedColumns: ExportColumnMapping[] = [];
    event.api.forEachNode(node => {
      if (node.data) {
        reorderedColumns.push(node.data);
      }
    });

    if (reorderedColumns.length === config.columns.length) {
      setConfig(prev => ({ ...prev, columns: reorderedColumns }));
    }
  }, [config.columns.length]);

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

  const mappingColDefs = useMemo<ColDef<ExportColumnMapping>[]>(() => {
    return [
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
              className="category-export-drag-handle"
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
        minWidth: 120,
        flex: 1,
        editable: false,
        suppressMovable: true,
        suppressHeaderMenuButton: true,
        tooltipValueGetter: params => params.data?.sourceField,
        cellRenderer: (params: { data?: ExportColumnMapping; value?: string }) => {
          if (!params.data) {
            return null;
          }
          return (
            <Tooltip title={params.data.sourceField}>
              <Text style={{ fontSize: 13 }}>{params.value}</Text>
            </Tooltip>
          );
        },
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
          const rowData = params.data;
          if (!rowData) {
            return null;
          }
          const columnIndex = config.columns.findIndex(column => column.id === rowData.id);
          return (
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                if (columnIndex >= 0) {
                  removeColumn(columnIndex);
                }
              }}
            />
          );
        },
      },
    ];
  }, [config.columns, mappingCenteredCellStyle, mappingIndexCellStyle, previewColumnLetterMap, removeColumn, toggleColumn]);

  // ===================== 渲染各步骤 =====================

  /** Step 0: 选择范围 */
  const renderScopeStep = () => (
    <div style={{ display: 'flex', gap: 16, height: '100%' }}>
      {/* 左：分类树 */}
      <div style={{
        flex: 1,
        minWidth: 0,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        padding: 12,
        overflow: 'auto',
      }}>
        <div style={{ marginBottom: 8 }}>
          <Text strong style={{ fontSize: 13 }}>分类节点</Text>
          <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
            已选 {selectedNodeKeys.length} 个节点
            {config.includeChildren && resolvedNodes.length > selectedNodeKeys.length &&
              `，含子孙共 ${resolvedNodes.length} 条`}
          </Text>
        </div>
        <Tree
          checkable
          checkedKeys={selectedNodeKeys}
          expandedKeys={expandedKeys}
          onExpand={setExpandedKeys}
          onCheck={(keys) => setSelectedNodeKeys(keys as React.Key[])}
          treeData={treeData}
          style={{ fontSize: 13 }}
        />
      </div>

      {/* 右：范围选项 */}
      <div style={{
        width: 240,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div style={{
          background: token.colorFillAlter,
          borderRadius: token.borderRadiusLG,
          padding: 12,
        }}>
          <Flex align="center" justify="space-between" style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 13 }}>递归导出</Text>
            <Switch
              size="small"
              checked={config.includeChildren}
              onChange={v => setConfig(prev => ({ ...prev, includeChildren: v }))}
            />
          </Flex>
          <Text type="secondary" style={{ fontSize: 12 }}>
            开启后将自动导出所选节点及其全部子分类
          </Text>
        </div>

        <div style={{
          background: token.colorFillAlter,
          borderRadius: token.borderRadiusLG,
          padding: 12,
        }}>
          <Text style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>路径分隔符</Text>
          <Select
            size="small"
            style={{ width: '100%' }}
            value={config.pathSeparator}
            options={PATH_SEPARATOR_OPTIONS}
            onChange={v => setConfig(prev => ({ ...prev, pathSeparator: v }))}
          />
        </div>

        <div style={{
          background: token.colorFillAlter,
          borderRadius: token.borderRadiusLG,
          padding: 12,
        }}>
          <Text style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>文件格式</Text>
          <Select
            size="small"
            style={{ width: '100%' }}
            value={config.fileFormat}
            options={[
              { value: 'xlsx', label: 'Excel (.xlsx)' },
              { value: 'csv', label: 'CSV (.csv)' },
            ]}
            onChange={v => setConfig(prev => ({ ...prev, fileFormat: v }))}
          />
        </div>

        <div style={{
          background: token.colorFillAlter,
          borderRadius: token.borderRadiusLG,
          padding: 12,
        }}>
          <Text style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>日期格式</Text>
          <Select
            size="small"
            style={{ width: '100%' }}
            value={config.dateFormat}
            options={DATE_FORMAT_OPTIONS}
            onChange={v => setConfig(prev => ({ ...prev, dateFormat: v }))}
          />
        </div>
      </div>
    </div>
  );

  /** Step 1: 映射与预览（左右分栏） */
  const renderMappingPreviewStep = () => {
    return (
      <Splitter style={{ height: '100%' }}>
        {/* 左侧：字段映射 */}
        <Splitter.Panel defaultSize="25%" min="20%" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', paddingRight: 12 }}>
            {/* 方案选择 + 添加字段 */}
            <Flex align="center" gap={8} wrap>
              <Text style={{ fontSize: 13, whiteSpace: 'nowrap' }}>方案：</Text>
              <Select
                size="middle"
                style={{ width: 160 }}
                value={activeProfileId}
                onChange={handleProfileChange}
                options={profiles.map(p => ({
                  value: p.id,
                  label: (
                    <Flex align="center" gap={4}>
                      {p.name}
                      {p.isBuiltIn && <Tag color="blue" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', marginInlineEnd: 0 }}>内置</Tag>}
                    </Flex>
                  ),
                }))}
              />
              <Button size="middle" onClick={handleSaveAsProfile}>另存</Button>
              {availableFields.length > 0 && (
                <Select
                  size="middle"
                  placeholder="添加字段..."
                  style={{ width: 130 }}
                  value={null}
                  onChange={addField}
                  options={availableFields.map(f => ({ value: f.field, label: f.label }))}
                />
              )}
            </Flex>

            {/* 映射表 */}
            <div className="category-export-mapping-grid" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <AgGridReact<ExportColumnMapping>
                rowData={config.columns}
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
                rowSelection={undefined}
                stopEditingWhenCellsLoseFocus={true}
                suppressHorizontalScroll={true}
                onCellValueChanged={handleMappingCellValueChanged}
                onRowDragEnd={handleMappingRowDragEnd}
              />
            </div>

            {/* 转换规则 */}
            <div style={{ flexShrink: 0 }}>
              <Flex align="center" gap={8} style={{ marginBottom: 6 }}>
                <SettingOutlined style={{ color: token.colorTextSecondary }} />
                <Text strong style={{ fontSize: 13 }}>转换规则</Text>
                <Button
                  type="dashed"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={addTransformRule}
                >
                  添加
                </Button>
              </Flex>
              {config.transformRules.length === 0 ? (
                <Text type="secondary" style={{ fontSize: 12 }}>暂无转换规则，导出时将使用原始值</Text>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {config.transformRules.map(rule => (
                    <Flex key={rule.id} align="center" gap={8} style={{
                      background: token.colorFillAlter,
                      borderRadius: token.borderRadiusLG,
                      padding: '6px 10px',
                    }}>
                      <Select
                        size="small"
                        style={{ width: 100 }}
                        value={rule.field}
                        options={config.columns.map(c => ({ value: c.sourceField, label: c.sourceLabel }))}
                        onChange={v => updateTransformRule(rule.id, { field: v })}
                      />
                      <Select
                        size="small"
                        style={{ width: 100 }}
                        value={rule.type}
                        options={[
                          { value: 'PREFIX', label: '添加前缀' },
                          { value: 'SUFFIX', label: '添加后缀' },
                          { value: 'ENUM_MAP', label: '枚举映射' },
                        ]}
                        onChange={v => updateTransformRule(rule.id, {
                          type: v,
                          config: v === 'PREFIX' ? { prefix: '' } : v === 'SUFFIX' ? { suffix: '' } : {},
                        })}
                      />
                      {(rule.type === 'PREFIX' || rule.type === 'SUFFIX') && (
                        <Input
                          size="small"
                          style={{ width: 80 }}
                          placeholder={rule.type === 'PREFIX' ? '前缀值' : '后缀值'}
                          value={rule.config[rule.type === 'PREFIX' ? 'prefix' : 'suffix'] ?? ''}
                          onChange={e => updateTransformRule(rule.id, {
                            config: { [rule.type === 'PREFIX' ? 'prefix' : 'suffix']: e.target.value },
                          })}
                        />
                      )}
                      {rule.type === 'ENUM_MAP' && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {Object.keys(rule.config).length} 条映射
                        </Text>
                      )}
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => removeTransformRule(rule.id)}
                      />
                    </Flex>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Splitter.Panel>

        {/* 右侧：实时预览 */}
        <Splitter.Panel style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', paddingLeft: 12 }}>
            <Flex align="center" gap={8}>
              <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                预览前 {Math.min(10, resolvedNodes.length)} 条（共 {resolvedNodes.length} 条），
                {config.columns.filter(c => c.enabled).length} 个字段
                {config.transformRules.length > 0 && `，${config.transformRules.length} 条规则`}
              </Text>
            </Flex>
            <div className="category-export-preview-grid" style={{ flex: 1, minHeight: 0 }}>
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
                domLayout="normal"
                headerHeight={32}
                rowHeight={30}
                suppressHorizontalScroll={false}
                suppressMovableColumns={true}
              />
            </div>
          </div>
        </Splitter.Panel>
      </Splitter>
    );
  };

  /** Step 3: 生成文件 */
  const renderGenerateStep = () => (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: 16,
    }}>
      {generated ? (
        <Result
          icon={<CheckCircleFilled style={{ color: token.colorSuccess }} />}
          title="文件生成完成"
          subTitle={`已导出 ${resolvedNodes.length} 条分类数据`}
          extra={
            <Button type="primary" onClick={onCancel}>关闭</Button>
          }
        />
      ) : (
        <>
          <FileExcelOutlined style={{ fontSize: 48, color: token.colorPrimary }} />
          <Text strong style={{ fontSize: 15 }}>准备生成导出文件</Text>
          <Flex vertical align="center" gap={4}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              格式：{config.fileFormat === 'xlsx' ? 'Excel (.xlsx)' : 'CSV (.csv)'}
            </Text>
            <Text type="secondary" style={{ fontSize: 13 }}>
              数据：{resolvedNodes.length} 条分类 × {config.columns.filter(c => c.enabled).length} 个字段
            </Text>
            {config.transformRules.length > 0 && (
              <Text type="secondary" style={{ fontSize: 13 }}>
                转换规则：{config.transformRules.length} 条
              </Text>
            )}
          </Flex>
          <Button
            type="primary"
            size="large"
            icon={<DownloadOutlined />}
            onClick={handleGenerate}
            style={{ marginTop: 8 }}
          >
            生成并下载
          </Button>
        </>
      )}
    </div>
  );

  const stepRenderers = [renderScopeStep, renderMappingPreviewStep, renderGenerateStep];

  return (
    <DraggableModal
      open={open}
      title="导出分类"
      width="70vw"
      footer={null}
      onCancel={onCancel}
      destroyOnClose
      maskClosable={false}
      keyboard={false}
      styles={{ body: { height: '70vh', display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 24px' } }}
    >
      {/* Steps 导航 */}
      <Steps
        current={currentStep}
        size="small"
        items={EXPORT_STEPS.map((s, i) => ({
          title: s.title,
          description: s.description,
          status: i < currentStep ? 'finish' : i === currentStep ? 'process' : 'wait',
        }))}
        style={{ marginBottom: 0 }}
      />

      {/* 步骤内容 */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {stepRenderers[currentStep]()}
      </div>

      <style jsx global>{`
        .category-export-mapping-grid .ag-root-wrapper,
        .category-export-preview-grid .ag-root-wrapper {
          border: 1px solid ${token.colorBorderSecondary};
          border-radius: ${token.borderRadiusLG}px;
          overflow: hidden;
          background: ${token.colorBgContainer};
        }

        .category-export-mapping-grid .ag-header,
        .category-export-preview-grid .ag-header {
          background: ${token.colorFillAlter};
          border-bottom: 1px solid ${token.colorBorderSecondary};
        }

        .category-export-mapping-grid .ag-header-cell,
        .category-export-preview-grid .ag-header-cell {
          font-weight: 600;
        }

        .category-export-mapping-grid .ag-header-cell,
        .category-export-mapping-grid .ag-cell {
          border-right: 0;
          box-shadow: none;
        }

        .category-export-preview-grid .ag-header-cell {
          border-right: 1px solid ${token.colorBorderSecondary};
        }

        .category-export-mapping-grid .ag-pinned-right-header,
        .category-export-mapping-grid .ag-pinned-right-cols-container {
          border-left: 0;
          margin-left: 0;
        }

        .category-export-mapping-grid .ag-row,
        .category-export-preview-grid .ag-row,
        .category-export-preview-grid .ag-row-pinned {
          border-bottom: 1px solid ${token.colorBorderSecondary};
        }

        .category-export-preview-grid .ag-cell {
          border-right: 1px solid ${token.colorBorderSecondary};
        }

        .category-export-preview-grid .ag-header-cell-label {
          justify-content: center;
        }

        .category-export-preview-grid .ag-pinned-left-cols-container .ag-cell-value {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
        }

        .category-export-preview-grid .ag-row-pinned {
          background: ${token.colorFillAlter};
        }

        .category-export-preview-grid .ag-cell-focus,
        .category-export-preview-grid .ag-cell.ag-cell-focus:not(.ag-cell-range-selected),
        .category-export-preview-grid .ag-cell-range-selected {
          border: 2px solid ${token.colorPrimary} !important;
          box-shadow: inset 0 0 0 1px ${token.colorPrimaryBg};
          background: ${token.colorPrimaryBg};
        }

        .category-export-mapping-grid .category-export-drag-handle {
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

        .category-export-mapping-grid .category-export-drag-handle:active {
          cursor: grabbing;
        }

        .category-export-mapping-grid .ag-cell,
        .category-export-preview-grid .ag-cell {
          display: flex;
          align-items: center;
        }

        .category-export-mapping-grid .ag-body-horizontal-scroll {
          display: none;
        }
      `}</style>

      {/* 底部导航 */}
      {currentStep < 2 && (
        <Flex justify="space-between" align="center">
          <Text type="secondary" style={{ fontSize: 12 }}>
            步骤 {currentStep + 1} / {EXPORT_STEPS.length}
          </Text>
          <Space>
            {currentStep > 0 && (
              <Button onClick={handlePrev}>上一步</Button>
            )}
            <Button type="primary" disabled={!canGoNext} onClick={handleNext}>
              {currentStep === 1 ? '下一步：生成文件' : '下一步'}
            </Button>
          </Space>
        </Flex>
      )}
    </DraggableModal>
  );
};

export default CategoryExportModal;
