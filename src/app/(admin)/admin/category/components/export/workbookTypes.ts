'use client';

import type {
  WorkbookExportModuleKey,
  WorkbookExportSchemaResponseDto,
  WorkbookExportStartRequestDto,
} from '@/services/workbookExport';

export type WorkbookExportStep = 0 | 1 | 2;

export interface WorkbookExportFieldConfig {
  id: string;
  fieldKey: string;
  headerText: string;
  defaultHeader: string;
  defaultExportHeader: string;
  description: string;
  valueType: string;
  allowCustomHeader: boolean;
  defaultSelected: boolean;
  enabled: boolean;
}

export interface WorkbookExportModuleConfig {
  moduleKey: WorkbookExportModuleKey;
  enabled: boolean;
  sheetName: string;
  defaultSheetName: string;
  columns: WorkbookExportFieldConfig[];
}

export interface WorkbookExportConfig {
  includeChildren: boolean;
  pathSeparator: string;
  fileName: string;
  modules: Record<WorkbookExportModuleKey, WorkbookExportModuleConfig>;
}

export const WORKBOOK_EXPORT_STEPS = [
  { title: '选择范围', description: '配置分类范围与导出模块' },
  { title: '字段配置', description: '基于 schema 选择列与表头' },
  { title: '生成文件', description: '启动导出任务并下载文件' },
] as const;

export const WORKBOOK_EXPORT_MODULE_ORDER: WorkbookExportModuleKey[] = [
  'CATEGORY',
  'ATTRIBUTE',
  'ENUM_OPTION',
];

export const WORKBOOK_EXPORT_MODULE_LABELS: Record<WorkbookExportModuleKey, string> = {
  CATEGORY: '分类',
  ATTRIBUTE: '属性',
  ENUM_OPTION: '枚举值',
};

export const DEFAULT_WORKBOOK_EXPORT_PATH_SEPARATOR = ' > ';

const DEFAULT_WORKBOOK_EXPORT_PRESETS: Record<WorkbookExportModuleKey, Array<{ fieldKey: string; headerText: string }>> = {
  CATEGORY: [
    { fieldKey: 'businessDomain', headerText: 'Business_Domain' },
    { fieldKey: 'categoryCode', headerText: 'Category_Code' },
    { fieldKey: 'path', headerText: 'Category_Path' },
    { fieldKey: 'categoryName', headerText: 'Category_Name' },
  ],
  ATTRIBUTE: [
    { fieldKey: 'categoryCode', headerText: 'Category_Code' },
    { fieldKey: 'categoryName', headerText: 'Category_Name' },
    { fieldKey: 'attributeKey', headerText: 'Attribute_Key' },
    { fieldKey: 'displayName', headerText: 'Attribute_Name' },
    { fieldKey: 'attributeField', headerText: 'Attribute_Field' },
    { fieldKey: 'description', headerText: 'Description' },
    { fieldKey: 'dataType', headerText: 'Data_Type' },
    { fieldKey: 'unit', headerText: 'Unit' },
    { fieldKey: 'defaultValue', headerText: 'Default_Value' },
    { fieldKey: 'required', headerText: 'Required' },
    { fieldKey: 'unique', headerText: 'Unique' },
    { fieldKey: 'searchable', headerText: 'Searchable' },
    { fieldKey: 'hidden', headerText: 'Hidden' },
    { fieldKey: 'readOnly', headerText: 'Read_Only' },
    { fieldKey: 'minValue', headerText: 'Min_Value' },
    { fieldKey: 'maxValue', headerText: 'Max_Value' },
    { fieldKey: 'step', headerText: 'Step' },
    { fieldKey: 'precision', headerText: 'Precision' },
    { fieldKey: 'trueLabel', headerText: 'True_Label' },
    { fieldKey: 'falseLabel', headerText: 'False_Label' },
  ],
  ENUM_OPTION: [
    { fieldKey: 'categoryCode', headerText: 'Category_Code' },
    { fieldKey: 'attributeKey', headerText: 'Attribute_Key' },
    { fieldKey: 'optionCode', headerText: 'Option_Code' },
    { fieldKey: 'optionName', headerText: 'Option_Name' },
    { fieldKey: 'optionLabel', headerText: 'Display_Label' },
  ],
};

const applyModuleFieldPreset = (
  moduleKey: WorkbookExportModuleKey,
  columns: WorkbookExportFieldConfig[],
): WorkbookExportFieldConfig[] => {
  const preset = DEFAULT_WORKBOOK_EXPORT_PRESETS[moduleKey];
  if (!preset.length) {
    return columns;
  }

  const presetOrder = new Map(preset.map((item, index) => [item.fieldKey, index]));
  const presetHeaders = new Map(preset.map((item) => [item.fieldKey, item.headerText]));

  return [...columns]
    .map((column) => {
      const defaultExportHeader = presetHeaders.get(column.fieldKey) ?? column.defaultHeader;
      const isPresetField = presetOrder.has(column.fieldKey);
      return {
        ...column,
        defaultExportHeader,
        headerText: defaultExportHeader,
        defaultSelected: isPresetField,
        enabled: isPresetField,
      };
    })
    .sort((left, right) => {
      const leftOrder = presetOrder.get(left.fieldKey);
      const rightOrder = presetOrder.get(right.fieldKey);

      if (leftOrder !== undefined && rightOrder !== undefined) {
        return leftOrder - rightOrder;
      }
      if (leftOrder !== undefined) {
        return -1;
      }
      if (rightOrder !== undefined) {
        return 1;
      }
      return 0;
    });
};

const createEmptyModuleConfig = (moduleKey: WorkbookExportModuleKey): WorkbookExportModuleConfig => ({
  moduleKey,
  enabled: false,
  sheetName: WORKBOOK_EXPORT_MODULE_LABELS[moduleKey],
  defaultSheetName: WORKBOOK_EXPORT_MODULE_LABELS[moduleKey],
  columns: [],
});

export const createEmptyWorkbookExportConfig = (): WorkbookExportConfig => ({
  includeChildren: true,
  pathSeparator: DEFAULT_WORKBOOK_EXPORT_PATH_SEPARATOR,
  fileName: '',
  modules: {
    CATEGORY: createEmptyModuleConfig('CATEGORY'),
    ATTRIBUTE: createEmptyModuleConfig('ATTRIBUTE'),
    ENUM_OPTION: createEmptyModuleConfig('ENUM_OPTION'),
  },
});

export const getInitialWorkbookSelection = (keys: React.Key[]): string[] => {
  return keys
    .map((key) => String(key))
    .filter((key) => !key.startsWith('local_'));
};

export const buildWorkbookExportConfigFromSchema = (
  schema: WorkbookExportSchemaResponseDto,
): WorkbookExportConfig => {
  const nextConfig = createEmptyWorkbookExportConfig();

  for (const moduleKey of WORKBOOK_EXPORT_MODULE_ORDER) {
    const moduleSchema = schema.modules.find((item) => item.moduleKey === moduleKey);
    if (!moduleSchema) {
      continue;
    }

    nextConfig.modules[moduleKey] = {
      moduleKey,
      enabled: true,
      sheetName: moduleSchema.defaultSheetName,
      defaultSheetName: moduleSchema.defaultSheetName,
      columns: applyModuleFieldPreset(moduleKey, moduleSchema.fields.map((field, index) => ({
        id: `${moduleKey}_${field.fieldKey}_${index}`,
        fieldKey: field.fieldKey,
        headerText: field.defaultHeader,
        defaultHeader: field.defaultHeader,
        defaultExportHeader: field.defaultHeader,
        description: field.description,
        valueType: field.valueType,
        allowCustomHeader: field.allowCustomHeader,
        defaultSelected: field.defaultSelected,
        enabled: field.defaultSelected,
      }))),
    };
  }

  return nextConfig;
};

export const getEnabledWorkbookModuleKeys = (
  config: WorkbookExportConfig,
): WorkbookExportModuleKey[] => {
  return WORKBOOK_EXPORT_MODULE_ORDER.filter((moduleKey) => {
    const moduleConfig = config.modules[moduleKey];
    return moduleConfig.enabled && moduleConfig.columns.some((column) => column.enabled);
  });
};

export const buildWorkbookExportRequest = (
  config: WorkbookExportConfig,
  businessDomain: string,
  categoryIds: string[],
  operator?: string,
): WorkbookExportStartRequestDto => {
  return {
    businessDomain,
    scope: {
      categoryIds,
      includeChildren: config.includeChildren,
    },
    output: {
      format: 'XLSX',
      fileName: config.fileName.trim() || undefined,
      pathSeparator: config.pathSeparator,
    },
    modules: WORKBOOK_EXPORT_MODULE_ORDER.map((moduleKey) => {
      const moduleConfig = config.modules[moduleKey];
      const enabledColumns = moduleConfig.columns.filter((column) => column.enabled);

      return {
        moduleKey,
        enabled: moduleConfig.enabled && enabledColumns.length > 0,
        sheetName: moduleConfig.sheetName.trim() || moduleConfig.defaultSheetName,
        columns: enabledColumns.map((column) => ({
          fieldKey: column.fieldKey,
          headerText: column.headerText.trim() || column.defaultExportHeader || column.defaultHeader,
          clientColumnId: column.id,
        })),
      };
    }).filter((module) => module.enabled),
    operator: operator?.trim() || undefined,
    clientRequestId: globalThis.crypto?.randomUUID?.(),
  };
};

export const getWorkbookExportEstimateRows = (
  categoryRows?: number | null,
  attributeRows?: number | null,
  enumOptionRows?: number | null,
) => {
  return {
    CATEGORY: categoryRows ?? 0,
    ATTRIBUTE: attributeRows ?? 0,
    ENUM_OPTION: enumOptionRows ?? 0,
  } satisfies Record<WorkbookExportModuleKey, number>;
};