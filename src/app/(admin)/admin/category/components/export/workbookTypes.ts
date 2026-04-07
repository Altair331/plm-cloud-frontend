'use client';

import {
  type ExportColumnMapping,
  type ExportPreviewRow,
  type MockCategoryNode,
  type SystemField,
  SYSTEM_FIELDS,
  MOCK_CATEGORY_TREE,
  buildPreviewRows,
  mockTreeToDataNodes,
  resolveSelectedNodes,
} from './types';
import type { AttributeItem, EnumOptionItem } from '../types';

export type WorkbookExportStep = 0 | 1 | 2;
export type WorkbookExportModuleKey = 'category' | 'attribute' | 'enumOption';

export interface WorkbookExportModuleConfig {
  enabled: boolean;
  columns: ExportColumnMapping[];
}

export interface WorkbookExportConfig {
  includeChildren: boolean;
  pathSeparator: string;
  fileFormat: 'xlsx' | 'csv';
  modules: Record<WorkbookExportModuleKey, WorkbookExportModuleConfig>;
}

export interface WorkbookExportProfile {
  id: string;
  name: string;
  description?: string;
  isBuiltIn: boolean;
  config: WorkbookExportConfig;
}

export interface WorkbookExportModuleDefinition {
  key: WorkbookExportModuleKey;
  label: string;
  description: string;
}

export interface WorkbookModuleField {
  field: string;
  label: string;
}

export interface MockWorkbookAttribute extends AttributeItem {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
}

export interface MockWorkbookEnumOption extends EnumOptionItem {
  attributeId: string;
  attributeCode: string;
  attributeName: string;
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  attributeType: AttributeItem['type'];
}

export interface WorkbookExportScopeData {
  categories: MockCategoryNode[];
  attributes: MockWorkbookAttribute[];
  enumOptions: MockWorkbookEnumOption[];
}

export const WORKBOOK_EXPORT_STEPS = [
  { title: '选择范围', description: '配置分类范围与导出数据块' },
  { title: '映射与预览', description: '切换分类 / 属性 / 枚举值配置导出列' },
  { title: '生成文件', description: '生成 mock 工作簿文件' },
] as const;

export const WORKBOOK_EXPORT_MODULES: WorkbookExportModuleDefinition[] = [
  { key: 'category', label: '分类', description: '导出分类层级、路径与状态信息' },
  { key: 'attribute', label: '属性', description: '导出分类下属性定义与控制标记' },
  { key: 'enumOption', label: '枚举值', description: '导出属性枚举值及显示配置' },
];

export const WORKBOOK_ATTRIBUTE_FIELDS: WorkbookModuleField[] = [
  { field: 'categoryCode', label: '所属分类编码' },
  { field: 'categoryName', label: '所属分类名称' },
  { field: 'code', label: '属性编码' },
  { field: 'name', label: '属性名称' },
  { field: 'attributeField', label: '属性字段' },
  { field: 'type', label: '数据类型' },
  { field: 'unit', label: '单位' },
  { field: 'defaultValue', label: '默认值' },
  { field: 'required', label: '必填' },
  { field: 'unique', label: '唯一' },
  { field: 'searchable', label: '可搜索' },
  { field: 'hidden', label: '隐藏' },
  { field: 'readonly', label: '只读' },
  { field: 'version', label: '版本' },
  { field: 'createdAt', label: '创建时间' },
  { field: 'createdBy', label: '创建人' },
  { field: 'modifiedAt', label: '修改时间' },
  { field: 'modifiedBy', label: '修改人' },
];

export const WORKBOOK_ENUM_FIELDS: WorkbookModuleField[] = [
  { field: 'categoryCode', label: '所属分类编码' },
  { field: 'attributeCode', label: '所属属性编码' },
  { field: 'attributeName', label: '所属属性名称' },
  { field: 'attributeType', label: '属性类型' },
  { field: 'code', label: '枚举编码' },
  { field: 'value', label: '枚举值' },
  { field: 'label', label: '显示标签' },
  { field: 'color', label: '颜色' },
  { field: 'order', label: '排序' },
  { field: 'description', label: '描述' },
  { field: 'image', label: '图片' },
];

const buildColumnMappings = (
  fields: ReadonlyArray<SystemField | WorkbookModuleField>,
  selectedFields: string[],
  labelOverrides?: Partial<Record<string, string>>,
): ExportColumnMapping[] => {
  return fields
    .filter((field) => selectedFields.includes(field.field))
    .map((field, index) => ({
      id: `col_${field.field}_${index}`,
      sourceField: field.field,
      sourceLabel: field.label,
      targetHeader: labelOverrides?.[field.field] || field.label,
      enabled: true,
    }));
};

const collectMockTreeKeys = (nodes: MockCategoryNode[]): Set<string> => {
  const keySet = new Set<string>();
  const walk = (items: MockCategoryNode[]) => {
    items.forEach((item) => {
      keySet.add(item.id);
      if (item.children?.length) {
        walk(item.children);
      }
    });
  };
  walk(nodes);
  return keySet;
};

const MOCK_TREE_KEY_SET = collectMockTreeKeys(MOCK_CATEGORY_TREE);

export const WORKBOOK_MOCK_TREE_DATA = mockTreeToDataNodes(MOCK_CATEGORY_TREE);

export const MOCK_WORKBOOK_ATTRIBUTES: MockWorkbookAttribute[] = [
  {
    id: 'attr_001',
    categoryId: 'cat_003',
    categoryCode: 'ELEC-R-SMD',
    categoryName: '贴片电阻',
    code: 'RES_TOL',
    name: '阻值精度',
    attributeField: 'resistanceTolerance',
    type: 'enum',
    required: true,
    searchable: true,
    unique: false,
    hidden: false,
    readonly: false,
    unit: '%',
    defaultValue: '5',
    description: '贴片电阻的精度等级',
    version: 3,
    isLatest: true,
    createdBy: 'admin',
    createdAt: '2025-03-01 09:20:00',
    modifiedBy: 'engineer1',
    modifiedAt: '2025-03-18 14:10:00',
  },
  {
    id: 'attr_002',
    categoryId: 'cat_003',
    categoryCode: 'ELEC-R-SMD',
    categoryName: '贴片电阻',
    code: 'RES_POWER',
    name: '额定功率',
    attributeField: 'ratedPower',
    type: 'number',
    required: true,
    searchable: true,
    unique: false,
    hidden: false,
    readonly: false,
    unit: 'W',
    defaultValue: '0.125',
    description: '额定功率',
    version: 2,
    isLatest: true,
    createdBy: 'admin',
    createdAt: '2025-03-01 09:35:00',
    modifiedBy: 'admin',
    modifiedAt: '2025-03-10 10:10:00',
  },
  {
    id: 'attr_003',
    categoryId: 'cat_006',
    categoryCode: 'ELEC-C-CER',
    categoryName: '陶瓷电容',
    code: 'CAP_VOLT',
    name: '额定电压',
    attributeField: 'ratedVoltage',
    type: 'number',
    required: true,
    searchable: true,
    unique: false,
    hidden: false,
    readonly: false,
    unit: 'V',
    defaultValue: '16',
    description: '陶瓷电容额定电压',
    version: 4,
    isLatest: true,
    createdBy: 'admin',
    createdAt: '2025-03-02 11:00:00',
    modifiedBy: 'engineer2',
    modifiedAt: '2025-03-19 15:20:00',
  },
  {
    id: 'attr_004',
    categoryId: 'cat_006',
    categoryCode: 'ELEC-C-CER',
    categoryName: '陶瓷电容',
    code: 'CAP_PACKAGE',
    name: '封装规格',
    attributeField: 'packageCode',
    type: 'enum',
    required: true,
    searchable: true,
    unique: false,
    hidden: false,
    readonly: false,
    description: '封装尺寸代码',
    version: 1,
    isLatest: true,
    createdBy: 'engineer2',
    createdAt: '2025-03-05 16:45:00',
    modifiedBy: 'engineer2',
    modifiedAt: '2025-03-05 16:45:00',
  },
  {
    id: 'attr_005',
    categoryId: 'cat_009',
    categoryCode: 'ELEC-IC-MCU',
    categoryName: 'MCU',
    code: 'MCU_FLASH',
    name: 'Flash 容量',
    attributeField: 'flashSize',
    type: 'number',
    required: true,
    searchable: true,
    unique: false,
    hidden: false,
    readonly: false,
    unit: 'KB',
    defaultValue: '256',
    description: '片上 Flash 容量',
    version: 5,
    isLatest: true,
    createdBy: 'admin',
    createdAt: '2025-03-08 10:00:00',
    modifiedBy: 'architect',
    modifiedAt: '2025-03-20 09:00:00',
  },
  {
    id: 'attr_006',
    categoryId: 'cat_009',
    categoryCode: 'ELEC-IC-MCU',
    categoryName: 'MCU',
    code: 'MCU_PACKAGE',
    name: '封装形式',
    attributeField: 'packageType',
    type: 'enum',
    required: true,
    searchable: false,
    unique: false,
    hidden: false,
    readonly: false,
    description: 'MCU 封装形式',
    version: 2,
    isLatest: true,
    createdBy: 'architect',
    createdAt: '2025-03-09 13:00:00',
    modifiedBy: 'architect',
    modifiedAt: '2025-03-21 11:35:00',
  },
];

export const MOCK_WORKBOOK_ENUM_OPTIONS: MockWorkbookEnumOption[] = [
  {
    id: 'enum_001',
    attributeId: 'attr_001',
    attributeCode: 'RES_TOL',
    attributeName: '阻值精度',
    categoryId: 'cat_003',
    categoryCode: 'ELEC-R-SMD',
    categoryName: '贴片电阻',
    attributeType: 'enum',
    code: 'TOL_1',
    value: '1',
    label: '±1%',
    color: '#0f62fe',
    order: 1,
    description: '高精度',
  },
  {
    id: 'enum_002',
    attributeId: 'attr_001',
    attributeCode: 'RES_TOL',
    attributeName: '阻值精度',
    categoryId: 'cat_003',
    categoryCode: 'ELEC-R-SMD',
    categoryName: '贴片电阻',
    attributeType: 'enum',
    code: 'TOL_5',
    value: '5',
    label: '±5%',
    color: '#24a148',
    order: 2,
    description: '标准精度',
  },
  {
    id: 'enum_003',
    attributeId: 'attr_004',
    attributeCode: 'CAP_PACKAGE',
    attributeName: '封装规格',
    categoryId: 'cat_006',
    categoryCode: 'ELEC-C-CER',
    categoryName: '陶瓷电容',
    attributeType: 'enum',
    code: 'PKG_0402',
    value: '0402',
    label: '0402',
    order: 1,
    description: '英制 0402',
  },
  {
    id: 'enum_004',
    attributeId: 'attr_004',
    attributeCode: 'CAP_PACKAGE',
    attributeName: '封装规格',
    categoryId: 'cat_006',
    categoryCode: 'ELEC-C-CER',
    categoryName: '陶瓷电容',
    attributeType: 'enum',
    code: 'PKG_0603',
    value: '0603',
    label: '0603',
    order: 2,
    description: '英制 0603',
  },
  {
    id: 'enum_005',
    attributeId: 'attr_006',
    attributeCode: 'MCU_PACKAGE',
    attributeName: '封装形式',
    categoryId: 'cat_009',
    categoryCode: 'ELEC-IC-MCU',
    categoryName: 'MCU',
    attributeType: 'enum',
    code: 'LQFP64',
    value: 'LQFP64',
    label: 'LQFP-64',
    order: 1,
    description: '四边引脚扁平封装',
  },
  {
    id: 'enum_006',
    attributeId: 'attr_006',
    attributeCode: 'MCU_PACKAGE',
    attributeName: '封装形式',
    categoryId: 'cat_009',
    categoryCode: 'ELEC-IC-MCU',
    categoryName: 'MCU',
    attributeType: 'enum',
    code: 'QFN48',
    value: 'QFN48',
    label: 'QFN-48',
    order: 2,
    description: '无引脚方形封装',
  },
];

export const cloneWorkbookExportConfig = (config: WorkbookExportConfig): WorkbookExportConfig => ({
  includeChildren: config.includeChildren,
  pathSeparator: config.pathSeparator,
  fileFormat: config.fileFormat,
  modules: {
    category: {
      enabled: config.modules.category.enabled,
      columns: config.modules.category.columns.map((column) => ({ ...column })),
    },
    attribute: {
      enabled: config.modules.attribute.enabled,
      columns: config.modules.attribute.columns.map((column) => ({ ...column })),
    },
    enumOption: {
      enabled: config.modules.enumOption.enabled,
      columns: config.modules.enumOption.columns.map((column) => ({ ...column })),
    },
  },
});

export const WORKBOOK_BUILT_IN_PROFILES: WorkbookExportProfile[] = [
  {
    id: 'workbook_profile_standard',
    name: '系统标准模板',
    description: '分类、属性、枚举值三张工作表全部导出',
    isBuiltIn: true,
    config: {
      includeChildren: true,
      pathSeparator: ' > ',
      fileFormat: 'xlsx',
      modules: {
        category: {
          enabled: true,
          columns: buildColumnMappings(
            SYSTEM_FIELDS,
            ['code', 'name', 'path', 'level', 'parentCode', 'status', 'description'],
          ),
        },
        attribute: {
          enabled: true,
          columns: buildColumnMappings(
            WORKBOOK_ATTRIBUTE_FIELDS,
            ['categoryCode', 'code', 'name', 'attributeField', 'type', 'unit', 'required', 'searchable'],
          ),
        },
        enumOption: {
          enabled: true,
          columns: buildColumnMappings(
            WORKBOOK_ENUM_FIELDS,
            ['categoryCode', 'attributeCode', 'code', 'value', 'label', 'order'],
          ),
        },
      },
    },
  },
  {
    id: 'workbook_profile_integration',
    name: '主数据交换模板',
    description: '按外部系统常用字段命名输出三块数据',
    isBuiltIn: true,
    config: {
      includeChildren: true,
      pathSeparator: '.',
      fileFormat: 'xlsx',
      modules: {
        category: {
          enabled: true,
          columns: buildColumnMappings(
            SYSTEM_FIELDS,
            ['code', 'name', 'parentCode', 'level', 'status'],
            {
              code: 'CATEGORY_CODE',
              name: 'CATEGORY_NAME',
              parentCode: 'PARENT_CATEGORY_CODE',
              level: 'CATEGORY_LEVEL',
              status: 'CATEGORY_STATUS',
            },
          ),
        },
        attribute: {
          enabled: true,
          columns: buildColumnMappings(
            WORKBOOK_ATTRIBUTE_FIELDS,
            ['categoryCode', 'code', 'name', 'attributeField', 'type', 'required'],
            {
              categoryCode: 'CATEGORY_CODE',
              code: 'ATTRIBUTE_CODE',
              name: 'ATTRIBUTE_NAME',
              attributeField: 'ATTRIBUTE_FIELD',
              type: 'DATA_TYPE',
              required: 'REQUIRED_FLAG',
            },
          ),
        },
        enumOption: {
          enabled: true,
          columns: buildColumnMappings(
            WORKBOOK_ENUM_FIELDS,
            ['attributeCode', 'code', 'value', 'label', 'order'],
            {
              attributeCode: 'ATTRIBUTE_CODE',
              code: 'OPTION_CODE',
              value: 'OPTION_VALUE',
              label: 'OPTION_LABEL',
              order: 'DISPLAY_ORDER',
            },
          ),
        },
      },
    },
  },
];

const getAttributeTypeLabel = (type?: AttributeItem['type']): string => {
  switch (type) {
    case 'string':
      return '文本型';
    case 'number':
      return '数字型';
    case 'boolean':
      return '布尔型';
    case 'date':
      return '日期型';
    case 'enum':
      return '枚举型（单选）';
    case 'multi-enum':
      return '枚举型（多选）';
    default:
      return '-';
  }
};

const getBooleanLabel = (value?: boolean): string => {
  if (value === undefined) {
    return '-';
  }
  return value ? '是' : '否';
};

const mapAttributeFieldValue = (item: MockWorkbookAttribute, field: string): string | number | boolean | null | undefined => {
  switch (field) {
    case 'type':
      return getAttributeTypeLabel(item.type);
    case 'required':
    case 'unique':
    case 'searchable':
    case 'hidden':
      return getBooleanLabel(item[field]);
    case 'readonly':
      return getBooleanLabel(item.readonly);
    case 'defaultValue':
      return item.defaultValue === undefined || item.defaultValue === null ? '-' : String(item.defaultValue);
    default:
      return (item as unknown as Record<string, string | number | boolean | null | undefined>)[field] ?? '-';
  }
};

const mapEnumFieldValue = (item: MockWorkbookEnumOption, field: string): string | number | boolean | null | undefined => {
  switch (field) {
    case 'attributeType':
      return getAttributeTypeLabel(item.attributeType);
    case 'image':
      return item.image || '-';
    case 'color':
      return item.color || '-';
    default:
      return (item as unknown as Record<string, string | number | boolean | null | undefined>)[field] ?? '-';
  }
};

const buildModuleRows = <TItem,>(
  items: TItem[],
  columns: ExportColumnMapping[],
  valueResolver: (item: TItem, field: string) => string | number | boolean | null | undefined,
  rowPrefix: string,
): ExportPreviewRow[] => {
  const enabledColumns = columns.filter((column) => column.enabled);
  return items.map((item, index) => {
    const row: ExportPreviewRow = { key: `${rowPrefix}_${index}` };
    enabledColumns.forEach((column) => {
      row[column.targetHeader] = valueResolver(item, column.sourceField);
    });
    return row;
  });
};

export const getWorkbookModuleFields = (moduleKey: WorkbookExportModuleKey): WorkbookModuleField[] => {
  if (moduleKey === 'category') {
    return SYSTEM_FIELDS;
  }
  if (moduleKey === 'attribute') {
    return WORKBOOK_ATTRIBUTE_FIELDS;
  }
  return WORKBOOK_ENUM_FIELDS;
};

export const getInitialWorkbookSelection = (checkedKeys: ReadonlyArray<string | number>): string[] => {
  const matchedKeys = checkedKeys
    .map(String)
    .filter((key) => MOCK_TREE_KEY_SET.has(key));

  if (matchedKeys.length > 0) {
    return matchedKeys;
  }

  return MOCK_CATEGORY_TREE[0] ? [MOCK_CATEGORY_TREE[0].id] : [];
};

export const resolveWorkbookScopeData = (
  selectedNodeKeys: ReadonlyArray<string | number>,
  includeChildren: boolean,
): WorkbookExportScopeData => {
  const categories = resolveSelectedNodes(MOCK_CATEGORY_TREE, new Set(selectedNodeKeys.map(String)), includeChildren);
  const categoryIdSet = new Set(categories.map((item) => item.id));
  const attributes = MOCK_WORKBOOK_ATTRIBUTES.filter((item) => categoryIdSet.has(item.categoryId));
  const attributeIdSet = new Set(attributes.map((item) => item.id));
  const enumOptions = MOCK_WORKBOOK_ENUM_OPTIONS.filter((item) => attributeIdSet.has(item.attributeId));

  return {
    categories,
    attributes,
    enumOptions,
  };
};

export const getWorkbookModuleRows = (
  moduleKey: WorkbookExportModuleKey,
  scopeData: WorkbookExportScopeData,
  columns: ExportColumnMapping[],
  pathSeparator: string,
): ExportPreviewRow[] => {
  if (moduleKey === 'category') {
    return buildPreviewRows(scopeData.categories, columns, [], pathSeparator);
  }
  if (moduleKey === 'attribute') {
    return buildModuleRows(scopeData.attributes, columns, mapAttributeFieldValue, 'attr');
  }
  return buildModuleRows(scopeData.enumOptions, columns, mapEnumFieldValue, 'enum');
};