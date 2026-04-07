'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  App,
  Button,
  Flex,
  Result,
  Select,
  Space,
  Splitter,
  Steps,
  Table,
  type TableProps,
  Tag,
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
import type { ColumnsType } from 'antd/es/table';
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
import type { AttributeItem } from '../types';
import {
  ATTRIBUTE_EXPORT_FIELDS,
  ATTRIBUTE_EXPORT_STEPS,
  BUILT_IN_ATTRIBUTE_EXPORT_PROFILES,
  buildAttributeExportPreviewRows,
  cloneAttributeExportConfig,
  type AttributeExportColumnMapping,
  type AttributeExportPreviewRow,
  type AttributeExportProfile,
  type AttributeExportStep,
} from './attributeTypes';

ModuleRegistry.registerModules([AllCommunityModule]);

const { Text } = Typography;

const PROFILES_STORAGE_KEY = 'plm_attribute_export_profiles';

interface AttributeExportModalProps {
  open: boolean;
  attributes: AttributeItem[];
  selectedAttributeIds: string[];
  categoryTitle?: string;
  onCancel: () => void;
  onSuccess?: () => void;
}

interface PreviewSheetRow extends AttributeExportPreviewRow {
  __sheetKind?: 'header';
}

interface AttributeSelectionRow extends AttributeItem {
  key: string;
}

const loadProfiles = (): AttributeExportProfile[] => {
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AttributeExportProfile[];
      return [...BUILT_IN_ATTRIBUTE_EXPORT_PROFILES, ...parsed.filter((profile) => !profile.isBuiltIn)];
    }
  } catch {
    // ignore localStorage parse failure
  }

  return [...BUILT_IN_ATTRIBUTE_EXPORT_PROFILES];
};

const saveCustomProfiles = (profiles: AttributeExportProfile[]) => {
  const customProfiles = profiles.filter((profile) => !profile.isBuiltIn);
  localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(customProfiles));
};

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

const getAttributeTypeTag = (type?: string) => {
  switch (type) {
    case 'string':
      return <Tag color="blue">文本型</Tag>;
    case 'number':
      return <Tag color="green">数字型</Tag>;
    case 'date':
      return <Tag color="gold">日期型</Tag>;
    case 'boolean':
      return <Tag color="purple">布尔型</Tag>;
    case 'enum':
      return <Tag color="cyan">枚举型</Tag>;
    case 'multi-enum':
      return <Tag color="geekblue">多选枚举</Tag>;
    default:
      return <Tag>{type || '-'}</Tag>;
  }
};

const AttributeExportModal: React.FC<AttributeExportModalProps> = ({
  open,
  attributes,
  selectedAttributeIds,
  categoryTitle,
  onCancel,
  onSuccess,
}) => {
  const { token } = theme.useToken();
  const { message: messageApi } = App.useApp();
  const previewGridRef = useRef<AgGridReact>(null);
  const [currentStep, setCurrentStep] = useState<AttributeExportStep>(0);
  const [profiles, setProfiles] = useState<AttributeExportProfile[]>(loadProfiles);
  const [activeProfileId, setActiveProfileId] = useState<string>('attr_profile_standard');
  const [config, setConfig] = useState(() => cloneAttributeExportConfig(BUILT_IN_ATTRIBUTE_EXPORT_PROFILES[0].config));
  const [selectedIds, setSelectedIds] = useState<React.Key[]>([]);
  const [generated, setGenerated] = useState(false);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    setCurrentStep(0);
    setGenerated(false);
    setActiveProfileId('attr_profile_standard');
    setConfig(cloneAttributeExportConfig(BUILT_IN_ATTRIBUTE_EXPORT_PROFILES[0].config));
    setSelectedIds(selectedAttributeIds.length > 0 ? [...selectedAttributeIds] : attributes.map((attribute) => attribute.id));
  }, [open, selectedAttributeIds, attributes]);

  const attributeTableRows = useMemo<AttributeSelectionRow[]>(() => (
    attributes.map((attribute) => ({ ...attribute, key: attribute.id }))
  ), [attributes]);

  const selectedAttributes = useMemo(() => {
    const selectedSet = new Set(selectedIds.map(String));
    return attributes.filter((attribute) => selectedSet.has(attribute.id));
  }, [attributes, selectedIds]);

  const enabledColumns = useMemo(() => config.columns.filter((column) => column.enabled), [config.columns]);

  const previewRows = useMemo(() => {
    if (selectedAttributes.length === 0 || enabledColumns.length === 0) {
      return [];
    }

    return buildAttributeExportPreviewRows(selectedAttributes.slice(0, 10), config.columns);
  }, [config.columns, enabledColumns.length, selectedAttributes]);

  const previewGridKey = useMemo(() => (
    enabledColumns.map((column) => `${column.id}:${column.targetHeader}`).join('|')
  ), [enabledColumns]);

  const previewPinnedTopRowData = useMemo<PreviewSheetRow[]>(() => {
    if (enabledColumns.length === 0) {
      return [];
    }

    const headerRow: PreviewSheetRow = { key: '__attribute_preview_header__', __sheetKind: 'header' };
    enabledColumns.forEach((column) => {
      headerRow[column.targetHeader] = column.targetHeader;
    });
    return [headerRow];
  }, [enabledColumns]);

  const previewColumnLetterMap = useMemo(() => {
    const labelMap = new Map<string, string>();
    enabledColumns.forEach((column, index) => {
      labelMap.set(column.id, toExcelColumnLabel(index));
    });
    return labelMap;
  }, [enabledColumns]);

  const availableFields = useMemo(() => {
    const mappedFields = new Set(config.columns.map((column) => column.sourceField));
    return ATTRIBUTE_EXPORT_FIELDS.filter((field) => !mappedFields.has(field.field));
  }, [config.columns]);

  const selectionColumns = useMemo<ColumnsType<AttributeSelectionRow>>(() => [
    {
      title: '属性名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (value: string) => <Text strong>{value || '未命名属性'}</Text>,
    },
    {
      title: '属性字段',
      dataIndex: 'attributeField',
      key: 'attributeField',
      width: 150,
      ellipsis: true,
      render: (value?: string) => <Text type="secondary">{value || '-'}</Text>,
    },
    {
      title: '数据类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (value?: string) => getAttributeTypeTag(value),
    },
  ], []);

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

  const handleProfileChange = useMemo(() => (profileId: string) => {
    setActiveProfileId(profileId);
    const profile = profiles.find((item) => item.id === profileId);
    if (profile) {
      setConfig(cloneAttributeExportConfig(profile.config));
    }
  }, [profiles]);

  const handleSaveAsProfile = useMemo(() => () => {
    const name = `属性导出方案 ${profiles.filter((profile) => !profile.isBuiltIn).length + 1}`;
    const newProfile: AttributeExportProfile = {
      id: `attr_profile_custom_${Date.now()}`,
      name,
      isBuiltIn: false,
      config: cloneAttributeExportConfig(config),
    };
    const nextProfiles = [...profiles, newProfile];
    setProfiles(nextProfiles);
    setActiveProfileId(newProfile.id);
    saveCustomProfiles(nextProfiles);
    messageApi.success(`方案“${name}”已保存`);
  }, [config, messageApi, profiles]);

  const toggleColumn = React.useCallback((index: number) => {
    setConfig((prev) => {
      const nextColumns = [...prev.columns];
      nextColumns[index] = { ...nextColumns[index], enabled: !nextColumns[index].enabled };
      return { ...prev, columns: nextColumns };
    });
  }, []);

  const removeColumn = React.useCallback((index: number) => {
    setConfig((prev) => ({
      ...prev,
      columns: prev.columns.filter((_, columnIndex) => columnIndex !== index),
    }));
  }, []);

  const renameColumnHeader = React.useCallback((index: number, header: string) => {
    setConfig((prev) => {
      const nextColumns = [...prev.columns];
      nextColumns[index] = { ...nextColumns[index], targetHeader: header };
      return { ...prev, columns: nextColumns };
    });
  }, []);

  const addField = React.useCallback((field: string) => {
    const sourceField = ATTRIBUTE_EXPORT_FIELDS.find((item) => item.field === field);
    if (!sourceField) {
      return;
    }

    setConfig((prev) => ({
      ...prev,
      columns: [
        ...prev.columns,
        {
          id: `attr_col_${Date.now()}`,
          sourceField: sourceField.field,
          sourceLabel: sourceField.label,
          targetHeader: sourceField.label,
          enabled: true,
        },
      ],
    }));
  }, []);

  const handleMappingCellValueChanged = React.useCallback((event: CellValueChangedEvent<AttributeExportColumnMapping>) => {
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

    const columnIndex = config.columns.findIndex((column) => column.id === event.data?.id);
    if (columnIndex >= 0) {
      renameColumnHeader(columnIndex, nextHeader);
    }
  }, [config.columns, renameColumnHeader]);

  const handleMappingRowDragEnd = React.useCallback((event: RowDragEndEvent<AttributeExportColumnMapping>) => {
    const reorderedColumns: AttributeExportColumnMapping[] = [];
    event.api.forEachNode((node) => {
      if (node.data) {
        reorderedColumns.push(node.data);
      }
    });

    if (reorderedColumns.length === config.columns.length) {
      setConfig((prev) => ({ ...prev, columns: reorderedColumns }));
    }
  }, [config.columns.length]);

  const mappingColDefs = useMemo<ColDef<AttributeExportColumnMapping>[]>(() => [
    {
      headerName: '列号',
      width: 72,
      minWidth: 72,
      maxWidth: 72,
      sortable: false,
      resizable: false,
      suppressMovable: true,
      suppressHeaderMenuButton: true,
      cellRenderer: (params: ICellRendererParams<AttributeExportColumnMapping>) => {
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
            className="attribute-export-drag-handle"
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
      cellRenderer: (params: { value?: string }) => <Text>{params.value}</Text>,
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
      cellRenderer: (params: { data?: AttributeExportColumnMapping }) => {
        const rowData = params.data;
        if (!rowData) {
          return null;
        }

        const columnIndex = config.columns.findIndex((column) => column.id === rowData.id);
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
  ], [config.columns, mappingCenteredCellStyle, mappingIndexCellStyle, previewColumnLetterMap, removeColumn]);

  const canGoNext = useMemo(() => {
    if (currentStep === 0) {
      return selectedAttributes.length > 0;
    }
    if (currentStep === 1) {
      return enabledColumns.length > 0 && selectedAttributes.length > 0;
    }
    return false;
  }, [currentStep, enabledColumns.length, selectedAttributes.length]);

  const handleGenerate = React.useCallback(() => {
    const enabledExportColumns = config.columns.filter((column) => column.enabled);
    if (enabledExportColumns.length === 0 || selectedAttributes.length === 0) {
      return;
    }

    const rows = buildAttributeExportPreviewRows(selectedAttributes, config.columns);
    const header = enabledExportColumns.map((column) => column.targetHeader).join(',');
    const contentRows = rows.map((row) => (
      enabledExportColumns.map((column) => String(row[column.targetHeader] ?? '')).join(',')
    ));
    const csvContent = [header, ...contentRows].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attribute-export-${new Date().toISOString().slice(0, 10)}.${config.fileFormat === 'xlsx' ? 'xlsx' : 'csv'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setGenerated(true);
    onSuccess?.();
  }, [config, onSuccess, selectedAttributes]);

  const renderScopeStep = () => {
    const rowSelection: TableProps<AttributeSelectionRow>['rowSelection'] = {
      selectedRowKeys: selectedIds,
      onChange: (keys: React.Key[]) => setSelectedIds(keys),
    };

    return (
      <div style={{ display: 'flex', gap: 16, height: '100%' }}>
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <Table<AttributeSelectionRow>
            rowKey="key"
            size="small"
            pagination={false}
            rowSelection={rowSelection}
            dataSource={attributeTableRows}
            columns={selectionColumns}
            scroll={{ y: 'calc(70vh - 330px)' }}
          />
        </div>
        <div style={{ width: 260, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: token.colorFillAlter, borderRadius: token.borderRadiusLG, padding: 12 }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>导出范围</Text>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>当前分类：{categoryTitle || '-'}</Text>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>属性总数：{attributes.length}</Text>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>已选条数：{selectedAttributes.length}</Text>
          </div>
          <div style={{ background: token.colorFillAlter, borderRadius: token.borderRadiusLG, padding: 12 }}>
            <Text style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>文件格式</Text>
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
          </div>
        </div>
      </div>
    );
  };

  const renderMappingPreviewStep = () => (
    <Splitter style={{ height: '100%' }}>
      <Splitter.Panel defaultSize="42%" min="28%" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', paddingRight: 12 }}>
          <Flex align="center" gap={8} wrap>
            <Text style={{ fontSize: 13, whiteSpace: 'nowrap' }}>方案：</Text>
            <Select
              size="small"
              style={{ width: 180 }}
              value={activeProfileId}
              onChange={handleProfileChange}
              options={profiles.map((profile) => ({
                value: profile.id,
                label: (
                  <Flex align="center" gap={4}>
                    {profile.name}
                    {profile.isBuiltIn ? <Tag color="blue" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', marginInlineEnd: 0 }}>内置</Tag> : null}
                  </Flex>
                ),
              }))}
            />
            <Button size="small" onClick={handleSaveAsProfile}>另存</Button>
            {availableFields.length > 0 ? (
              <Select
                size="small"
                placeholder="添加字段..."
                style={{ width: 140 }}
                value={null}
                onChange={addField}
                options={availableFields.map((field) => ({ value: field.field, label: field.label }))}
              />
            ) : null}
          </Flex>

          <Flex align="center" gap={6} style={{ color: token.colorTextSecondary, fontSize: 12 }}>
            <InfoCircleOutlined />
            <span>单击“导出表头”列即可编辑，右侧预览会同步更新</span>
          </Flex>

          <div className="attribute-export-mapping-grid" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <AgGridReact<AttributeExportColumnMapping>
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
          <Flex align="center" gap={8}>
            <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              预览前 {Math.min(10, selectedAttributes.length)} 条（共 {selectedAttributes.length} 条），{enabledColumns.length} 个字段
            </Text>
          </Flex>
          <div className="attribute-export-preview-grid" style={{ flex: 1, minHeight: 0 }}>
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

  const renderGenerateStep = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
      {generated ? (
        <Result
          icon={<CheckCircleFilled style={{ color: token.colorSuccess }} />}
          title="文件生成完成"
          subTitle={`已导出 ${selectedAttributes.length} 条属性数据`}
          extra={<Button type="primary" onClick={onCancel}>关闭</Button>}
        />
      ) : (
        <>
          <FileExcelOutlined style={{ fontSize: 48, color: token.colorPrimary }} />
          <Text strong style={{ fontSize: 15 }}>准备生成属性导出文件</Text>
          <Flex vertical align="center" gap={4}>
            <Text type="secondary" style={{ fontSize: 13 }}>格式：{config.fileFormat === 'xlsx' ? 'Excel (.xlsx)' : 'CSV (.csv)'}</Text>
            <Text type="secondary" style={{ fontSize: 13 }}>数据：{selectedAttributes.length} 条属性 × {enabledColumns.length} 个字段</Text>
          </Flex>
          <Button type="primary" size="large" icon={<DownloadOutlined />} onClick={handleGenerate} style={{ marginTop: 8 }}>
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
      title="导出属性"
      width="70vw"
      footer={null}
      onCancel={onCancel}
      destroyOnClose
      maskClosable={false}
      keyboard={false}
      styles={{ body: { height: '70vh', display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 24px' } }}
    >
      <Steps
        current={currentStep}
        size="small"
        items={ATTRIBUTE_EXPORT_STEPS.map((step, index) => ({
          title: step.title,
          description: step.description,
          status: index < currentStep ? 'finish' : index === currentStep ? 'process' : 'wait',
        }))}
        style={{ marginBottom: 0 }}
      />

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {stepRenderers[currentStep]()}
      </div>

      <style jsx global>{`
        .attribute-export-mapping-grid .ag-root-wrapper,
        .attribute-export-preview-grid .ag-root-wrapper {
          border: 1px solid ${token.colorBorderSecondary};
          border-radius: ${token.borderRadiusLG}px;
          overflow: hidden;
          background: ${token.colorBgContainer};
        }

        .attribute-export-mapping-grid .ag-header,
        .attribute-export-preview-grid .ag-header {
          background: ${token.colorFillAlter};
          border-bottom: 1px solid ${token.colorBorderSecondary};
        }

        .attribute-export-mapping-grid .ag-header-cell,
        .attribute-export-preview-grid .ag-header-cell {
          font-weight: 600;
        }

        .attribute-export-mapping-grid .ag-header-cell,
        .attribute-export-mapping-grid .ag-cell {
          border-right: 0;
          box-shadow: none;
        }

        .attribute-export-mapping-grid .ag-pinned-right-header,
        .attribute-export-mapping-grid .ag-pinned-right-cols-container {
          border-left: 0;
          margin-left: 0;
        }

        .attribute-export-mapping-grid .ag-row,
        .attribute-export-preview-grid .ag-row,
        .attribute-export-preview-grid .ag-row-pinned {
          border-bottom: 1px solid ${token.colorBorderSecondary};
        }

        .attribute-export-preview-grid .ag-header-cell,
        .attribute-export-preview-grid .ag-cell {
          border-right: 1px solid ${token.colorBorderSecondary};
        }

        .attribute-export-preview-grid .ag-header-cell-label {
          justify-content: center;
        }

        .attribute-export-preview-grid .ag-pinned-left-cols-container .ag-cell-value {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
        }

        .attribute-export-preview-grid .ag-row-pinned {
          background: ${token.colorFillAlter};
        }

        .attribute-export-drag-handle {
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

        .attribute-export-drag-handle:active {
          cursor: grabbing;
        }

        .attribute-export-mapping-grid .ag-cell,
        .attribute-export-preview-grid .ag-cell {
          display: flex;
          align-items: center;
        }

        .attribute-export-mapping-grid .ag-body-horizontal-scroll {
          display: none;
        }
      `}</style>

      {currentStep < 2 ? (
        <Flex justify="space-between" align="center">
          <Text type="secondary" style={{ fontSize: 12 }}>步骤 {currentStep + 1} / {ATTRIBUTE_EXPORT_STEPS.length}</Text>
          <Space>
            {currentStep > 0 ? <Button onClick={() => setCurrentStep((step) => Math.max(step - 1, 0) as AttributeExportStep)}>上一步</Button> : null}
            <Button type="primary" disabled={!canGoNext} onClick={() => setCurrentStep((step) => Math.min(step + 1, 2) as AttributeExportStep)}>
              {currentStep === 1 ? '下一步：生成文件' : '下一步'}
            </Button>
          </Space>
        </Flex>
      ) : null}
    </DraggableModal>
  );
};

export default AttributeExportModal;