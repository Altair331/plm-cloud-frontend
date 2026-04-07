import type { AttributeItem } from '../types';

export interface AttributeExportProfile {
  id: string;
  name: string;
  description?: string;
  isBuiltIn: boolean;
  config: AttributeExportConfig;
}

export interface AttributeExportConfig {
  fileFormat: 'xlsx' | 'csv';
  columns: AttributeExportColumnMapping[];
}

export interface AttributeExportColumnMapping {
  id: string;
  sourceField: string;
  sourceLabel: string;
  targetHeader: string;
  enabled: boolean;
}

export interface AttributeExportPreviewRow {
  key: string;
  [field: string]: string | number | boolean | null | undefined;
}

export type AttributeExportStep = 0 | 1 | 2;

export const ATTRIBUTE_EXPORT_STEPS = [
  { title: '选择范围', description: '勾选属性条目' },
  { title: '映射与预览', description: '配置导出列 & 实时预览' },
  { title: '生成文件', description: '下载 Excel' },
] as const;

export interface AttributeExportField {
  field: string;
  label: string;
  group: 'basic' | 'flag' | 'system';
}

export const ATTRIBUTE_EXPORT_FIELDS: AttributeExportField[] = [
  { field: 'code', label: '属性编码', group: 'basic' },
  { field: 'name', label: '属性名称', group: 'basic' },
  { field: 'attributeField', label: '属性字段', group: 'basic' },
  { field: 'type', label: '数据类型', group: 'basic' },
  { field: 'unit', label: '单位', group: 'basic' },
  { field: 'description', label: '描述', group: 'basic' },
  { field: 'defaultValue', label: '默认值', group: 'basic' },
  { field: 'required', label: '必填', group: 'flag' },
  { field: 'unique', label: '唯一', group: 'flag' },
  { field: 'searchable', label: '可搜索', group: 'flag' },
  { field: 'hidden', label: '隐藏', group: 'flag' },
  { field: 'readonly', label: '只读', group: 'flag' },
  { field: 'version', label: '版本', group: 'system' },
  { field: 'createdAt', label: '创建时间', group: 'system' },
  { field: 'createdBy', label: '创建人', group: 'system' },
  { field: 'modifiedAt', label: '修改时间', group: 'system' },
  { field: 'modifiedBy', label: '修改人', group: 'system' },
];

const createDefaultColumns = (): AttributeExportColumnMapping[] =>
  ATTRIBUTE_EXPORT_FIELDS.filter((field) => ['code', 'name', 'attributeField', 'type', 'unit', 'required', 'searchable'].includes(field.field)).map((field, index) => ({
    id: `attr_col_${index}`,
    sourceField: field.field,
    sourceLabel: field.label,
    targetHeader: field.label,
    enabled: true,
  }));

export const BUILT_IN_ATTRIBUTE_EXPORT_PROFILES: AttributeExportProfile[] = [
  {
    id: 'attr_profile_standard',
    name: '系统标准模板',
    description: '覆盖属性基础信息与控制标记的标准导出方案',
    isBuiltIn: true,
    config: {
      fileFormat: 'xlsx',
      columns: createDefaultColumns(),
    },
  },
  {
    id: 'attr_profile_integration',
    name: '外部系统对接模板',
    description: '适配主数据或第三方系统交换的属性字段模板',
    isBuiltIn: true,
    config: {
      fileFormat: 'csv',
      columns: [
        { id: 'attr_col_0', sourceField: 'code', sourceLabel: '属性编码', targetHeader: 'ATTRIBUTE_CODE', enabled: true },
        { id: 'attr_col_1', sourceField: 'name', sourceLabel: '属性名称', targetHeader: 'ATTRIBUTE_NAME', enabled: true },
        { id: 'attr_col_2', sourceField: 'attributeField', sourceLabel: '属性字段', targetHeader: 'ATTRIBUTE_FIELD', enabled: true },
        { id: 'attr_col_3', sourceField: 'type', sourceLabel: '数据类型', targetHeader: 'DATA_TYPE', enabled: true },
        { id: 'attr_col_4', sourceField: 'required', sourceLabel: '必填', targetHeader: 'REQUIRED', enabled: true },
        { id: 'attr_col_5', sourceField: 'unique', sourceLabel: '唯一', targetHeader: 'UNIQUE_FLAG', enabled: true },
      ],
    },
  },
];

export const cloneAttributeExportConfig = (config: AttributeExportConfig): AttributeExportConfig => ({
  fileFormat: config.fileFormat,
  columns: config.columns.map((column) => ({ ...column })),
});

const getAttributeTypeLabel = (type?: string): string => {
  switch (type) {
    case 'string':
      return '文本型';
    case 'number':
      return '数字型';
    case 'date':
      return '日期型';
    case 'boolean':
      return '布尔型';
    case 'enum':
      return '枚举型（单选）';
    case 'multi-enum':
      return '枚举型（多选）';
    default:
      return type || '-';
  }
};

const getBooleanLabel = (value?: boolean): string => {
  if (value === undefined) {
    return '-';
  }
  return value ? '是' : '否';
};

const getAttributeFieldValue = (attribute: AttributeItem, field: string): string | number | boolean | null | undefined => {
  switch (field) {
    case 'type':
      return getAttributeTypeLabel(attribute.type);
    case 'required':
      return getBooleanLabel(attribute.required);
    case 'unique':
      return getBooleanLabel(attribute.unique);
    case 'searchable':
      return getBooleanLabel(attribute.searchable);
    case 'hidden':
      return getBooleanLabel(attribute.hidden);
    case 'readonly':
      return getBooleanLabel(attribute.readonly);
    case 'defaultValue':
      return attribute.defaultValue === undefined || attribute.defaultValue === null ? '-' : String(attribute.defaultValue);
    default:
      return (attribute as unknown as Record<string, string | number | boolean | null | undefined>)[field] ?? '-';
  }
};

export const buildAttributeExportPreviewRows = (
  attributes: AttributeItem[],
  columns: AttributeExportColumnMapping[],
): AttributeExportPreviewRow[] => {
  const enabledColumns = columns.filter((column) => column.enabled);

  return attributes.map((attribute, index) => {
    const row: AttributeExportPreviewRow = { key: `attr_row_${attribute.id || index}` };

    enabledColumns.forEach((column) => {
      row[column.targetHeader] = getAttributeFieldValue(attribute, column.sourceField);
    });

    return row;
  });
};