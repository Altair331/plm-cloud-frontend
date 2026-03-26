'use client';

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Splitter, theme, Flex, Typography, Empty, Tag, Collapse, Table, Button, Space, Input, Select, Switch, Row, Col, Card } from 'antd';
import type { TableColumnsType } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import BaseTreeToolbar from '@/components/TreeToolbar/BaseTreeToolbar';
import {
  CODE_CONFIG_CLASS_NAMES,
  createCodeConfigGlobalStyles,
  getCodeConfigStyles,
  getListRuleNameStyle,
  getResizableHeaderCellStyle,
} from './codeConfigStyles';

const { Title, Text } = Typography;

type ColumnKey = 'name' | 'code' | 'scope';
type ColumnShareMap = Record<ColumnKey, number>;

interface ResizableHeaderCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  width?: string;
  minShare?: number;
  onResize?: (share: number) => void;
}

const MIN_COLUMN_SHARE: ColumnShareMap = {
  name: 28,
  code: 24,
  scope: 24,
};

const DEFAULT_COLUMN_SHARES: ColumnShareMap = {
  name: 42,
  code: 29,
  scope: 29,
};

const ResizableHeaderCell: React.FC<ResizableHeaderCellProps> = ({ width, minShare = 20, onResize, children, style, ...restProps }) => {
  const startXRef = useRef(0);
  const startShareRef = useRef(typeof width === 'string' ? Number.parseFloat(width) || 0 : 0);
  const tableWidthRef = useRef(0);

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const headerCell = event.currentTarget.parentElement;
    const tableElement = headerCell?.closest('table');

    startXRef.current = event.clientX;
    startShareRef.current = typeof width === 'string' ? Number.parseFloat(width) || 0 : 0;
    tableWidthRef.current = tableElement?.getBoundingClientRect().width || 0;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (tableWidthRef.current <= 0) {
        return;
      }

      const deltaPercent = ((moveEvent.clientX - startXRef.current) / tableWidthRef.current) * 100;
      const nextShare = Math.max(minShare, startShareRef.current + deltaPercent);
      onResize?.(nextShare);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <th {...restProps} style={getResizableHeaderCellStyle(width, style)}>
      {children}
      {typeof width === 'string' && onResize ? (
        <div className={CODE_CONFIG_CLASS_NAMES.resizeHandle} onMouseDown={handleMouseDown} />
      ) : null}
    </th>
  );
};

// ================= 类型定义 =================
export interface CodeSegment {
  id: string;
  type: 'STRING' | 'DATE' | 'SEQUENCE';
  value?: string;           // 用于 STRING 类型
  dateFormat?: string;      // 用于 DATE 类型
  length?: number;          // 用于 SEQUENCE 类型
  resetRule?: 'NEVER' | 'DAILY' | 'MONTHLY' | 'YEARLY'; // 重置规则
}

export interface CodeRule {
  id: string;
  name: string;
  code: string;
  scope: string;
  description?: string;
  segments: CodeSegment[];
}

// ================= Mock 数据 =================
const mockRules: CodeRule[] = [
  {
    id: 'rule_1',
    name: '产品类别规则',
    code: 'PRODUCT_CODE',
    scope: '产品类',
    description: '用于所有标准物料的自动编号',
    segments: [
      { id: 's1', type: 'STRING', value: 'MAT-' },
      { id: 's2', type: 'DATE', dateFormat: 'YYYYMM' },
      { id: 's3', type: 'STRING', value: '-' },
      { id: 's4', type: 'SEQUENCE', length: 5, resetRule: 'YEARLY' }
    ]
  },
  {
    id: 'rule_2',
    name: '物料类别规则',
    code: 'MATERIAL_CODE',
    scope: '物料类',
    description: '研发设计图纸生成规则',
    segments: [
      { id: 's1', type: 'STRING', value: 'DOC' },
      { id: 's2', type: 'SEQUENCE', length: 6, resetRule: 'NEVER' }
    ]
  },
  {
    id: 'rule_3',
    name: 'BOM类别规则',
    code: 'BOM_CODE',
    scope: 'BOM类',
    description: '用于所有标准物料的自动编号',
    segments: [
      { id: 's1', type: 'STRING', value: 'MAT-' },
      { id: 's2', type: 'DATE', dateFormat: 'YYYYMM' },
      { id: 's3', type: 'STRING', value: '-' },
      { id: 's4', type: 'SEQUENCE', length: 5, resetRule: 'YEARLY' }
    ]
  },
  {
    id: 'rule_4',
    name: '工艺类别规则',
    code: 'PROCESS_CODE',
    scope: '工艺类',
    description: '用于所有标准物料的自动编号',
    segments: [
      { id: 's1', type: 'STRING', value: 'MAT-' },
      { id: 's2', type: 'DATE', dateFormat: 'YYYYMM' },
      { id: 's3', type: 'STRING', value: '-' },
      { id: 's4', type: 'SEQUENCE', length: 5, resetRule: 'YEARLY' }
    ]
  },
  {
    id: 'rule_5',
    name: '测试类别规则',
    code: 'TEST_CODE',
    scope: '测试类',
    description: '用于所有标准物料的自动编号',
    segments: [
      { id: 's1', type: 'STRING', value: 'MAT-' },
      { id: 's2', type: 'DATE', dateFormat: 'YYYYMM' },
      { id: 's3', type: 'STRING', value: '-' },
      { id: 's4', type: 'SEQUENCE', length: 5, resetRule: 'YEARLY' }
    ]
  },
  {
    id: 'rule_6',
    name: '实验类别规则',
    code: 'EXPERIMENT_CODE',
    scope: '实验类',
    description: '用于所有标准物料的自动编号',
    segments: [
      { id: 's1', type: 'STRING', value: 'MAT-' },
      { id: 's2', type: 'DATE', dateFormat: 'YYYYMM' },
      { id: 's3', type: 'STRING', value: '-' },
      { id: 's4', type: 'SEQUENCE', length: 5, resetRule: 'YEARLY' }
    ]
  },
];

const CHECKBOX_COL_WIDTH = 48;
const COLUMN_KEYS: ColumnKey[] = ['name', 'code', 'scope'];

const CONFIG_SECTION_ITEMS = [
  {
    key: 'category',
    label: '分类编码配置',
  },
  {
    key: 'attribute',
    label: '属性编码配置',
  },
  {
    key: 'enum',
    label: '枚举值编码配置',
  },
] as const;

type CodeSegmentTemplateType = 'constant' | 'field' | 'sequence';

interface CodeSegmentTemplate {
  id: string;
  title: string;
  type: CodeSegmentTemplateType;
  constantValue?: string;
  fieldSource?: string;
  fetchMode?: string;
  resetBasis?: string;
  separator?: string;
  length?: number;
  step?: number;
  startAt?: number;
  autoCarry?: boolean;
  padWithZero?: boolean;
}

interface SelectOption {
  label: string;
  value: string;
}

const SEGMENT_TYPE_OPTIONS: SelectOption[] = [
  { label: '常量', value: 'constant' },
  { label: '业务对象字段', value: 'field' },
  { label: '流水号', value: 'sequence' },
] ;

const FIELD_SOURCE_OPTIONS: SelectOption[] = [
  { label: '名称(name)', value: 'name' },
  { label: '编码(code)', value: 'code' },
  { label: '分类编码(categoryCode)', value: 'categoryCode' },
] ;

const FETCH_MODE_OPTIONS: SelectOption[] = [
  { label: '完全取值', value: 'full' },
  { label: '前缀截取', value: 'prefix' },
  { label: '后缀截取', value: 'suffix' },
] ;

const SEPARATOR_OPTIONS: SelectOption[] = [
  { label: '-', value: '-' },
  { label: '_', value: '_' },
  { label: '/', value: '/' },
  { label: '无', value: '' },
] ;

const RESET_BASIS_OPTIONS: SelectOption[] = [
  { label: '非依据', value: 'none' },
  { label: '自然日', value: 'daily' },
  { label: '自然月', value: 'monthly' },
  { label: '自然年', value: 'yearly' },
] ;

const FIELD_SOURCE_PREVIEW_MAP: Record<string, string> = {
  name: '名称(name)',
  code: '编码(code)',
  categoryCode: '分类编码(categoryCode)',
};

const INITIAL_CATEGORY_SEGMENTS: CodeSegmentTemplate[] = [
  {
    id: 'seg_1',
    title: '编码一段',
    type: 'constant',
    constantValue: 'MAT',
  },
  {
    id: 'seg_2',
    title: '编码二段',
    type: 'field',
    fieldSource: 'name',
    fetchMode: 'full',
    resetBasis: 'none',
    separator: '-',
  },
  {
    id: 'seg_3',
    title: '编码三段',
    type: 'sequence',
    length: 8,
    step: 1,
    startAt: 1,
    separator: '-',
    autoCarry: false,
    padWithZero: true,
  },
];

const createTemplateSegment = (index: number): CodeSegmentTemplate => ({
  id: `seg_${Date.now()}_${index}`,
  title: `编码${['一', '二', '三', '四', '五', '六'][index - 1] || `${index}`}段`,
  type: 'constant',
  constantValue: '',
});

const SegmentField = ({
  label,
  span = 24,
  children,
}: {
  label: string;
  span?: number;
  children: React.ReactNode;
}) => (
  <Col span={span}>
    <Flex vertical gap={8}>
      <Text type="secondary">{label}</Text>
      {children}
    </Flex>
  </Col>
);

const distributeDeltaAcrossColumns = (
  currentShares: ColumnShareMap,
  targetKey: ColumnKey,
  requestedShare: number,
): ColumnShareMap => {
  const otherKeys = COLUMN_KEYS.filter((key) => key !== targetKey);
  const minTargetShare = MIN_COLUMN_SHARE[targetKey];
  const maxTargetShare = 100 - otherKeys.reduce((sum, key) => sum + MIN_COLUMN_SHARE[key], 0);
  const clampedTargetShare = Math.min(maxTargetShare, Math.max(minTargetShare, requestedShare));
  const delta = clampedTargetShare - currentShares[targetKey];

  if (Math.abs(delta) < 0.01) {
    return currentShares;
  }

  const nextShares = { ...currentShares };
  nextShares[targetKey] = clampedTargetShare;

  if (delta > 0) {
    let remainingDelta = delta;
    const totalShrinkCapacity = otherKeys.reduce(
      (sum, key) => sum + Math.max(0, currentShares[key] - MIN_COLUMN_SHARE[key]),
      0,
    );

    for (const key of otherKeys) {
      const shrinkCapacity = Math.max(0, currentShares[key] - MIN_COLUMN_SHARE[key]);
      const allocatedDelta = totalShrinkCapacity > 0
        ? (delta * shrinkCapacity) / totalShrinkCapacity
        : delta / otherKeys.length;
      const actualDelta = Math.min(shrinkCapacity, allocatedDelta, remainingDelta);
      nextShares[key] = currentShares[key] - actualDelta;
      remainingDelta -= actualDelta;
    }

    for (const key of otherKeys) {
      if (remainingDelta <= 0.01) {
        break;
      }
      const shrinkCapacity = Math.max(0, nextShares[key] - MIN_COLUMN_SHARE[key]);
      const actualDelta = Math.min(shrinkCapacity, remainingDelta);
      nextShares[key] -= actualDelta;
      remainingDelta -= actualDelta;
    }
  } else {
    const growDelta = Math.abs(delta);
    const totalGrowBase = otherKeys.reduce((sum, key) => sum + currentShares[key], 0);
    let distributed = 0;

    for (const key of otherKeys) {
      const actualDelta = totalGrowBase > 0
        ? (growDelta * currentShares[key]) / totalGrowBase
        : growDelta / otherKeys.length;
      nextShares[key] = currentShares[key] + actualDelta;
      distributed += actualDelta;
    }

    const remainder = growDelta - distributed;
    if (Math.abs(remainder) > 0.01) {
      nextShares[otherKeys[otherKeys.length - 1]] += remainder;
    }
  }

  const totalShare = COLUMN_KEYS.reduce((sum, key) => sum + nextShares[key], 0);
  if (Math.abs(totalShare - 100) > 0.01) {
    nextShares.scope += 100 - totalShare;
  }

  return nextShares;
};

// ================= 左侧：规则列表组件 =================
const CodeRuleList = ({ 
  rules, 
  activeId, 
  onSelect 
}: { 
  rules: CodeRule[], 
  activeId: string | null, 
  onSelect: (id: string) => void 
}) => {
  const { token } = theme.useToken();
  const styles = getCodeConfigStyles(token);
  const globalStyles = createCodeConfigGlobalStyles(token, CHECKBOX_COL_WIDTH);
  const [searchText, setSearchText] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [checkableEnabled, setCheckableEnabled] = useState(false);
  const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([]);
  const [columnShares, setColumnShares] = useState<ColumnShareMap>(DEFAULT_COLUMN_SHARES);

  const filteredRules = rules.filter(r => 
    r.name.includes(searchText) || r.code.includes(searchText)
  );

  const handleColumnResize = useCallback((columnKey: ColumnKey, nextShare: number) => {
    setColumnShares((prev) => distributeDeltaAcrossColumns(prev, columnKey, nextShare));
  }, []);

  const toolbarState = useMemo(() => ({
    checkableEnabled,
    checkedKeys,
    checkedCount: checkedKeys.length,
    searchValue: searchText,
    searchExpanded,
    onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => setSearchText(e.target.value),
    onSearchVisibilityChange: setSearchExpanded,
    onSearchClear: () => setSearchText(''),
    onCheckableToggle: () => {
      setCheckableEnabled((prev) => {
        const nextValue = !prev;
        if (!nextValue) {
          setCheckedKeys([]);
        }
        return nextValue;
      });
    },
  }), [searchText, searchExpanded, checkableEnabled, checkedKeys]);

  const columns: TableColumnsType<CodeRule> = [
    {
      title: '编码名称',
      dataIndex: 'name',
      key: 'name',
      align: 'center',
      width: `${columnShares.name}%`,
      ellipsis: true,
      onHeaderCell: () => ({
        width: `${columnShares.name}%`,
        minShare: MIN_COLUMN_SHARE.name,
        onResize: (share: number) => handleColumnResize('name', share),
      }),
      render: (value: string, record: CodeRule) => (
        <Text
          strong
          style={getListRuleNameStyle(token, record.id === activeId)}
        >
          {value}
        </Text>
      ),
    },
    {
      title: '编码 Code',
      dataIndex: 'code',
      key: 'code',
      align: 'center',
      width: `${columnShares.code}%`,
      ellipsis: true,
      onHeaderCell: () => ({
        width: `${columnShares.code}%`,
        minShare: MIN_COLUMN_SHARE.code,
        onResize: (share: number) => handleColumnResize('code', share),
      }),
      render: (value: string) => (
        <Text
          type="secondary"
          style={styles.listMonoText}
          ellipsis={{ tooltip: value }}
        >
          {value}
        </Text>
      ),
    },
    {
      title: '编码作用域',
      dataIndex: 'scope',
      key: 'scope',
      align: 'center',
      width: `${columnShares.scope}%`,
      ellipsis: true,
      onHeaderCell: () => ({
        width: `${columnShares.scope}%`,
        minShare: MIN_COLUMN_SHARE.scope,
        onResize: (share: number) => handleColumnResize('scope', share),
      }),
      render: (value: string) => (
        <Text type="secondary" style={styles.listSecondaryText} ellipsis={{ tooltip: value }}>
          {value}
        </Text>
      ),
    },
  ];

  const rowSelection = checkableEnabled
    ? {
        selectedRowKeys: checkedKeys,
        onChange: (nextSelectedRowKeys: React.Key[]) => setCheckedKeys(nextSelectedRowKeys),
        columnWidth: CHECKBOX_COL_WIDTH,
      }
    : undefined;

  return (
    <Flex vertical style={styles.listContainer}>
      {/* 列表工具栏 */}
      <Flex align="center" style={styles.listToolbar}>
        <BaseTreeToolbar
          toolbarState={toolbarState}
          searchPlaceholder="搜索规则"
          batchActionsVisible={checkedKeys.length > 0}
          primaryActions={[
            {
              key: 'add',
              icon: <PlusOutlined />,
              tooltip: '新增规则',
              variant: 'primary',
              onClick: () => {}
            }
          ]}
          batchActions={[
            {
              key: 'delete',
              icon: <DeleteOutlined />,
              tooltip: '批量删除',
              variant: 'danger',
              onClick: () => {}
            }
          ]}
        />
      </Flex>
      
      {/* 列表主体区 */}
      <div className={CODE_CONFIG_CLASS_NAMES.listScroll} style={styles.listScroll}>
        <Table<CodeRule>
          className={[CODE_CONFIG_CLASS_NAMES.listTable, checkableEnabled ? CODE_CONFIG_CLASS_NAMES.listTableCheckable : ''].filter(Boolean).join(' ')}
          rowKey="id"
          size="small"
          tableLayout="fixed"
          components={{
            header: {
              cell: ResizableHeaderCell,
            },
          }}
          pagination={false}
          dataSource={filteredRules}
          columns={columns}
          rowSelection={rowSelection}
          onRow={(record) => ({
            onClick: (event) => {
              const target = event.target as HTMLElement;
              if (target.closest('.ant-checkbox-wrapper') || target.closest('.ant-checkbox')) {
                return;
              }
              onSelect(record.id);
            },
          })}
          rowClassName={(record) => (record.id === activeId ? CODE_CONFIG_CLASS_NAMES.rowActive : CODE_CONFIG_CLASS_NAMES.row)}
        />
      </div>
      
      {/* 底部信息 */}
      <div style={styles.listFooter}>
        共 {filteredRules.length} 个规则
      </div>

      <style jsx global>{globalStyles}</style>
    </Flex>
  );
};

// ================= 右侧：设计工作区组件 =================
const CodeRuleWorkspace = ({ rule }: { rule: CodeRule }) => {
  const { token } = theme.useToken();
  const styles = getCodeConfigStyles(token);
  const [isEditing, setIsEditing] = useState(false);
  const [activePanelKey, setActivePanelKey] = useState<string>(CONFIG_SECTION_ITEMS[0].key);
  const [categorySegments, setCategorySegments] = useState<CodeSegmentTemplate[]>(INITIAL_CATEGORY_SEGMENTS);

  const previewCode = useMemo(() => categorySegments.map((segment, index) => {
    let segmentPreview = '';

    if (segment.type === 'constant') {
      segmentPreview = segment.constantValue?.trim() || '常量';
    } else if (segment.type === 'field') {
      const sourcePreview = FIELD_SOURCE_PREVIEW_MAP[segment.fieldSource || 'name'] || '业务对象字段';
      if (segment.fetchMode === 'prefix') {
        segmentPreview = `${sourcePreview}-前缀`;
      } else if (segment.fetchMode === 'suffix') {
        segmentPreview = `${sourcePreview}-后缀`;
      } else {
        segmentPreview = sourcePreview;
      }
    } else {
      const baseValue = String(segment.startAt ?? 1);
      segmentPreview = segment.padWithZero
        ? baseValue.padStart(segment.length ?? 8, '0')
        : baseValue;
    }

    if (index < categorySegments.length - 1 && segment.separator) {
      return `${segmentPreview}${segment.separator}`;
    }

    return segmentPreview;
  }).join(''), [categorySegments]);

  const handleSegmentChange = useCallback((segmentId: string, patch: Partial<CodeSegmentTemplate>) => {
    setCategorySegments((prev) => prev.map((segment) => {
      if (segment.id !== segmentId) {
        return segment;
      }

      const nextSegment = { ...segment, ...patch };

      if (patch.type === 'constant') {
        return {
          ...nextSegment,
          constantValue: nextSegment.constantValue ?? '',
          fieldSource: undefined,
          fetchMode: undefined,
          resetBasis: undefined,
          separator: undefined,
          length: undefined,
          step: undefined,
          startAt: undefined,
          autoCarry: undefined,
          padWithZero: undefined,
        };
      }

      if (patch.type === 'field') {
        return {
          ...nextSegment,
          fieldSource: nextSegment.fieldSource ?? 'name',
          fetchMode: nextSegment.fetchMode ?? 'full',
          resetBasis: nextSegment.resetBasis ?? 'none',
          separator: nextSegment.separator ?? '-',
          constantValue: undefined,
          length: undefined,
          step: undefined,
          startAt: undefined,
          autoCarry: undefined,
          padWithZero: undefined,
        };
      }

      if (patch.type === 'sequence') {
        return {
          ...nextSegment,
          length: nextSegment.length ?? 8,
          step: nextSegment.step ?? 1,
          startAt: nextSegment.startAt ?? 1,
          separator: nextSegment.separator ?? '-',
          autoCarry: nextSegment.autoCarry ?? false,
          padWithZero: nextSegment.padWithZero ?? true,
          constantValue: undefined,
          fieldSource: undefined,
          fetchMode: undefined,
          resetBasis: undefined,
        };
      }

      return nextSegment;
    }));
  }, []);

  const handleAddSegment = useCallback(() => {
    setCategorySegments((prev) => [...prev, createTemplateSegment(prev.length + 1)]);
  }, []);

  const handleRemoveSegment = useCallback(() => {
    setCategorySegments((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const renderCategoryEditor = () => (
    <div
      className={CODE_CONFIG_CLASS_NAMES.editorSurface}
      style={styles.editorSurface}
    >
      <Flex vertical gap={16} style={styles.editorContent}>
        <Flex justify="space-between" style={styles.editorHead}>
          <Flex vertical gap={6}>
            <Text strong style={styles.editorTitle}>
              编码设置
            </Text>
            <Flex align="center" gap={12} wrap>
              <Text type="secondary">编码示例 :</Text>
              <Text style={styles.previewCode}>{previewCode}</Text>
            </Flex>
          </Flex>
          <Space>
            <Button size="small" onClick={handleAddSegment} disabled={!isEditing}>新增</Button>
            <Button size="small" onClick={handleRemoveSegment} disabled={!isEditing || categorySegments.length <= 1}>删除</Button>
          </Space>
        </Flex>

        <Row gutter={[16, 16]}>
          {categorySegments.map((segment) => (
            <Col key={segment.id} xs={24} md={12}>
              <Card
                size="small"
                title={<Text strong>{segment.title}</Text>}
                extra={
                  <Select
                    value={segment.type}
                    options={SEGMENT_TYPE_OPTIONS}
                    onChange={(value) => handleSegmentChange(segment.id, { type: value as CodeSegmentTemplateType })}
                    disabled={!isEditing}
                    variant="filled"
                    style={styles.segmentTypeSelect}
                  />
                }
                styles={{
                  header: styles.segmentCardHeader,
                  body: styles.segmentCardBody,
                }}
                style={styles.segmentCard}
              >
                {segment.type === 'constant' ? (
                  <Row gutter={[20, 12]}>
                    <SegmentField label="设置值">
                      <Input
                        variant="filled"
                        value={segment.constantValue}
                        onChange={(event) => handleSegmentChange(segment.id, { constantValue: event.target.value })}
                        disabled={!isEditing}
                      />
                    </SegmentField>
                  </Row>
                ) : null}

                {segment.type === 'field' ? (
                  <Row gutter={[20, 12]}>
                    <SegmentField label="使用模式" span={8}>
                      <Select
                        value={segment.fetchMode}
                        options={FETCH_MODE_OPTIONS}
                        onChange={(value) => handleSegmentChange(segment.id, { fetchMode: value })}
                        disabled={!isEditing}
                        variant="filled"
                        style={styles.fullWidthField}
                      />
                    </SegmentField>
                    <SegmentField label="编码来源" span={8}>
                      <Select
                        value={segment.fieldSource}
                        options={FIELD_SOURCE_OPTIONS}
                        onChange={(value) => handleSegmentChange(segment.id, { fieldSource: value })}
                        disabled={!isEditing}
                        variant="filled"
                        style={styles.fullWidthField}
                      />
                    </SegmentField>
                    <SegmentField label="流水号依据" span={8}>
                      <Select
                        value={segment.resetBasis}
                        options={RESET_BASIS_OPTIONS}
                        onChange={(value) => handleSegmentChange(segment.id, { resetBasis: value })}
                        disabled={!isEditing}
                        variant="filled"
                        style={styles.fullWidthField}
                      />
                    </SegmentField>
                    <SegmentField label="段间分隔符" span={8}>
                      <Select
                        value={segment.separator}
                        options={SEPARATOR_OPTIONS}
                        onChange={(value) => handleSegmentChange(segment.id, { separator: value })}
                        disabled={!isEditing}
                        variant="filled"
                        style={styles.fullWidthField}
                      />
                    </SegmentField>
                  </Row>
                ) : null}

                {segment.type === 'sequence' ? (
                  <Row gutter={[20, 12]}>
                    <SegmentField label="长度" span={6}>
                      <Input
                        variant="filled"
                        value={segment.length}
                        onChange={(event) => handleSegmentChange(segment.id, { length: Number(event.target.value || 0) || undefined })}
                        disabled={!isEditing}
                      />
                    </SegmentField>
                    <SegmentField label="步长" span={6}>
                      <Input
                        variant="filled"
                        value={segment.step}
                        onChange={(event) => handleSegmentChange(segment.id, { step: Number(event.target.value || 0) || undefined })}
                        disabled={!isEditing}
                      />
                    </SegmentField>
                    <SegmentField label="起始值" span={6}>
                      <Input
                        variant="filled"
                        value={segment.startAt}
                        onChange={(event) => handleSegmentChange(segment.id, { startAt: Number(event.target.value || 0) || undefined })}
                        disabled={!isEditing}
                      />
                    </SegmentField>
                    <SegmentField label="段间分隔符" span={6}>
                      <Select
                        value={segment.separator}
                        options={SEPARATOR_OPTIONS}
                        onChange={(value) => handleSegmentChange(segment.id, { separator: value })}
                        disabled={!isEditing}
                        variant="filled"
                        style={styles.fullWidthField}
                      />
                    </SegmentField>
                    <Col span={8}>
                      <Flex justify="space-between" align="center" style={styles.switchRow}>
                        <Text>超过设置长度时自动升位</Text>
                        <Switch size="small" checked={segment.autoCarry} onChange={(checked) => handleSegmentChange(segment.id, { autoCarry: checked })} disabled={!isEditing} />
                      </Flex>
                    </Col>
                    <Col span={8}>
                      <Flex justify="space-between" align="center" style={styles.switchRow}>
                        <Text>用0补位</Text>
                        <Switch size="small" checked={segment.padWithZero} onChange={(checked) => handleSegmentChange(segment.id, { padWithZero: checked })} disabled={!isEditing} />
                      </Flex>
                    </Col>
                  </Row>
                ) : null}
              </Card>
            </Col>
          ))}
        </Row>
      </Flex>
    </div>
  );

  return (
    <Flex vertical style={styles.workspaceContainer}>
      <Flex
        align="center"
        justify="space-between"
        style={styles.workspaceHeader}
      >
        <Flex align="center" gap={12} wrap="wrap">
          <Title level={5} style={styles.titleReset}>
            {rule.name}
          </Title>
          <Tag color="cyan">{rule.scope}</Tag>
          <Tag color={isEditing ? 'processing' : 'default'}>{isEditing ? '编辑中' : '只读'}</Tag>
          <Text type="secondary" copyable style={styles.activeRuleCode}>
            {rule.code}
          </Text>
        </Flex>

        <Space size="small">
          {isEditing ? (
            <>
              <Button size="small" onClick={() => setIsEditing(false)}>
                取消
              </Button>
              <Button type="primary" size="small" onClick={() => setIsEditing(false)}>
                保存
              </Button>
            </>
          ) : (
            <Button type="text" size="small" onClick={() => setIsEditing(true)}>
              编辑
            </Button>
          )}
        </Space>
      </Flex>

      <Collapse
        accordion
        ghost
        activeKey={activePanelKey}
        bordered={false}
        onChange={(key) => setActivePanelKey(Array.isArray(key) ? String(key[0] || CONFIG_SECTION_ITEMS[0].key) : String(key || CONFIG_SECTION_ITEMS[0].key))}
        className={`${CODE_CONFIG_CLASS_NAMES.workspaceScroll} ${CODE_CONFIG_CLASS_NAMES.workspaceCollapse}`}
        style={styles.workspaceCollapse}
        items={CONFIG_SECTION_ITEMS.map((item) => ({
          key: item.key,
          label: <Text strong>{item.label}</Text>,
          styles: {
            header: styles.collapseHeader,
            body: styles.collapseBody,
          },
          children: item.key === 'category'
            ? renderCategoryEditor()
            : (
              <div style={styles.placeholderPanel}>
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={isEditing ? `${item.label}编辑区域待配置` : `${item.label}只读内容待配置`}
                />
              </div>
            ),
        }))}
      />
    </Flex>
  );
};

// ================= 主页面入口 =================
export default function CodeSettingPage() {
  const { token } = theme.useToken();
  const styles = getCodeConfigStyles(token);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rules, setRules] = useState<CodeRule[]>(mockRules);
  const [activeRuleId, setActiveRuleId] = useState<string | null>(mockRules[0].id);

  const activeRule = useMemo(() => rules.find(r => r.id === activeRuleId), [rules, activeRuleId]);

  return (
    <div style={styles.pageContainer}>
      <Splitter
        onCollapse={(collapsed) => setLeftCollapsed(collapsed[0] ?? false)}
        style={styles.splitter}
      >
        <Splitter.Panel defaultSize={450} min={350} max={550} collapsible={{ end: true, showCollapsibleIcon: leftCollapsed ? true : "auto" }}>
          <CodeRuleList rules={rules} activeId={activeRuleId} onSelect={setActiveRuleId} />
        </Splitter.Panel>
        
        <Splitter.Panel>
          <div style={styles.splitterPanelContent}>
            {activeRule ? (
              <CodeRuleWorkspace rule={activeRule} />
            ) : (
              <Flex justify="center" align="center" style={styles.emptyState}>
                <Empty description="请在左侧选择一个规则进行设计" />
              </Flex>
            )}
          </div>
        </Splitter.Panel>
      </Splitter>
    </div>
  );
}
