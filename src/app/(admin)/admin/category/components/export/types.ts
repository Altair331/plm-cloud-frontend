import type { DataNode } from 'antd/es/tree';

// ================= 导出方案 =================
export interface ExportProfile {
  id: string;
  name: string;
  description?: string;
  isBuiltIn: boolean;
  config: ExportConfig;
}

export interface ExportConfig {
  includeChildren: boolean;       // 递归包含子孙
  pathSeparator: string;          // 层级路径分隔符
  fileFormat: 'xlsx' | 'csv';
  dateFormat: string;
  numberPrecision: number;
  columns: ExportColumnMapping[]; // 字段映射（有序）
  transformRules: TransformRule[];
}

// ================= 字段映射 =================
export interface ExportColumnMapping {
  id: string;
  sourceField: string;            // 系统字段名
  sourceLabel: string;            // 系统字段显示名
  targetHeader: string;           // 导出表头
  enabled: boolean;
  width?: number;
}

// ================= 转换规则 =================
export type TransformType = 'PREFIX' | 'SUFFIX' | 'ENUM_MAP' | 'DATE_FORMAT' | 'NUMBER_FORMAT';

export interface TransformRule {
  id: string;
  field: string;                  // 目标字段
  type: TransformType;
  config: Record<string, string>; // 类型相关配置
}

// ================= 预览行 =================
export interface ExportPreviewRow {
  key: string;
  [field: string]: string | number | boolean | null | undefined;
}

// ================= 导出进度 =================
export type ExportStep = 0 | 1 | 2;
export type StepStatus = 'wait' | 'process' | 'finish' | 'error';

export const EXPORT_STEPS = [
  { title: '选择范围', description: '勾选分类节点' },
  { title: '映射与预览', description: '配置导出列 & 实时预览' },
  { title: '生成文件', description: '下载 Excel' },
] as const;

// ================= 系统字段定义 =================
export interface SystemField {
  field: string;
  label: string;
  group: 'basic' | 'attribute' | 'system';
}

export const SYSTEM_FIELDS: SystemField[] = [
  { field: 'code', label: '分类编码', group: 'basic' },
  { field: 'name', label: '分类名称', group: 'basic' },
  { field: 'path', label: '层级路径', group: 'basic' },
  { field: 'level', label: '层级深度', group: 'basic' },
  { field: 'parentCode', label: '父级编码', group: 'basic' },
  { field: 'parentName', label: '父级名称', group: 'basic' },
  { field: 'description', label: '描述', group: 'basic' },
  { field: 'status', label: '状态', group: 'basic' },
  { field: 'businessDomain', label: '业务域', group: 'basic' },
  { field: 'createdAt', label: '创建时间', group: 'system' },
  { field: 'createdBy', label: '创建人', group: 'system' },
  { field: 'modifiedAt', label: '修改时间', group: 'system' },
  { field: 'modifiedBy', label: '修改人', group: 'system' },
];

export const PATH_SEPARATOR_OPTIONS = [
  { value: ' > ', label: '> （大于号）' },
  { value: ' / ', label: '/ （斜杠）' },
  { value: ' - ', label: '- （短横线）' },
  { value: '.', label: '. （点号）' },
];

export const DATE_FORMAT_OPTIONS = [
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
  { value: 'YYYY/MM/DD', label: 'YYYY/MM/DD' },
  { value: 'YYYY-MM-DD HH:mm:ss', label: 'YYYY-MM-DD HH:mm:ss' },
  { value: 'YYYYMMDD', label: 'YYYYMMDD' },
];

// ================= 默认列映射 =================
const createDefaultColumns = (): ExportColumnMapping[] =>
  SYSTEM_FIELDS.filter(f => ['code', 'name', 'path', 'level', 'parentCode', 'description', 'status'].includes(f.field))
    .map((f, idx) => ({
      id: `col_${idx}`,
      sourceField: f.field,
      sourceLabel: f.label,
      targetHeader: f.label,
      enabled: true,
    }));

// ================= 预设方案 =================
export const BUILT_IN_PROFILES: ExportProfile[] = [
  {
    id: 'profile_standard',
    name: '系统标准模板',
    description: '包含分类基础字段的标准导出方案',
    isBuiltIn: true,
    config: {
      includeChildren: true,
      pathSeparator: ' > ',
      fileFormat: 'xlsx',
      dateFormat: 'YYYY-MM-DD',
      numberPrecision: 2,
      columns: createDefaultColumns(),
      transformRules: [],
    },
  },
  {
    id: 'profile_integration',
    name: '第三方系统对接方案',
    description: '适配 ERP / MES 系统的字段映射',
    isBuiltIn: true,
    config: {
      includeChildren: false,
      pathSeparator: '.',
      fileFormat: 'csv',
      dateFormat: 'YYYYMMDD',
      numberPrecision: 0,
      columns: [
        { id: 'col_0', sourceField: 'code', sourceLabel: '分类编码', targetHeader: 'ITEM_CLASS_CODE', enabled: true },
        { id: 'col_1', sourceField: 'name', sourceLabel: '分类名称', targetHeader: 'ITEM_CLASS_NAME', enabled: true },
        { id: 'col_2', sourceField: 'parentCode', sourceLabel: '父级编码', targetHeader: 'PARENT_CLASS_CODE', enabled: true },
        { id: 'col_3', sourceField: 'level', sourceLabel: '层级深度', targetHeader: 'LEVEL', enabled: true },
        { id: 'col_4', sourceField: 'status', sourceLabel: '状态', targetHeader: 'STATUS', enabled: true },
        { id: 'col_5', sourceField: 'description', sourceLabel: '描述', targetHeader: 'DESCRIPTION', enabled: true },
      ],
      transformRules: [
        { id: 'tr_1', field: 'code', type: 'PREFIX', config: { prefix: 'PLM-' } },
        { id: 'tr_2', field: 'status', type: 'ENUM_MAP', config: { CREATED: 'NEW', EFFECTIVE: 'ACTIVE', INVALID: 'INACTIVE' } },
      ],
    },
  },
];

// ================= Mock 分类树节点 =================
export interface MockCategoryNode {
  id: string;
  code: string;
  name: string;
  parentCode: string;
  parentName: string;
  level: number;
  path: string;
  description: string;
  status: string;
  businessDomain: string;
  createdAt: string;
  createdBy: string;
  modifiedAt: string;
  modifiedBy: string;
  children?: MockCategoryNode[];
}

export const MOCK_CATEGORY_TREE: MockCategoryNode[] = [
  {
    id: 'cat_001', code: 'ELEC', name: '电子元器件', parentCode: '', parentName: '',
    level: 1, path: '电子元器件', description: '电子类物料根分类', status: 'EFFECTIVE',
    businessDomain: '物料分类', createdAt: '2025-01-15 09:00:00', createdBy: 'admin',
    modifiedAt: '2025-03-10 14:30:00', modifiedBy: 'admin',
    children: [
      {
        id: 'cat_002', code: 'ELEC-R', name: '电阻', parentCode: 'ELEC', parentName: '电子元器件',
        level: 2, path: '电子元器件 > 电阻', description: '各类电阻', status: 'EFFECTIVE',
        businessDomain: '物料分类', createdAt: '2025-01-15 09:10:00', createdBy: 'admin',
        modifiedAt: '2025-03-10 14:30:00', modifiedBy: 'admin',
        children: [
          {
            id: 'cat_003', code: 'ELEC-R-SMD', name: '贴片电阻', parentCode: 'ELEC-R', parentName: '电阻',
            level: 3, path: '电子元器件 > 电阻 > 贴片电阻', description: 'SMD电阻', status: 'EFFECTIVE',
            businessDomain: '物料分类', createdAt: '2025-01-15 09:15:00', createdBy: 'admin',
            modifiedAt: '2025-02-20 10:00:00', modifiedBy: 'engineer1',
          },
          {
            id: 'cat_004', code: 'ELEC-R-TH', name: '插件电阻', parentCode: 'ELEC-R', parentName: '电阻',
            level: 3, path: '电子元器件 > 电阻 > 插件电阻', description: '直插电阻', status: 'EFFECTIVE',
            businessDomain: '物料分类', createdAt: '2025-01-15 09:16:00', createdBy: 'admin',
            modifiedAt: '2025-02-20 10:05:00', modifiedBy: 'engineer1',
          },
        ],
      },
      {
        id: 'cat_005', code: 'ELEC-C', name: '电容', parentCode: 'ELEC', parentName: '电子元器件',
        level: 2, path: '电子元器件 > 电容', description: '各类电容', status: 'EFFECTIVE',
        businessDomain: '物料分类', createdAt: '2025-01-15 09:20:00', createdBy: 'admin',
        modifiedAt: '2025-03-01 11:00:00', modifiedBy: 'admin',
        children: [
          {
            id: 'cat_006', code: 'ELEC-C-CER', name: '陶瓷电容', parentCode: 'ELEC-C', parentName: '电容',
            level: 3, path: '电子元器件 > 电容 > 陶瓷电容', description: 'MLCC', status: 'EFFECTIVE',
            businessDomain: '物料分类', createdAt: '2025-01-15 09:22:00', createdBy: 'admin',
            modifiedAt: '2025-03-01 11:05:00', modifiedBy: 'admin',
          },
          {
            id: 'cat_007', code: 'ELEC-C-EL', name: '电解电容', parentCode: 'ELEC-C', parentName: '电容',
            level: 3, path: '电子元器件 > 电容 > 电解电容', description: '铝电解电容', status: 'CREATED',
            businessDomain: '物料分类', createdAt: '2025-02-10 15:00:00', createdBy: 'engineer1',
            modifiedAt: '2025-02-10 15:00:00', modifiedBy: 'engineer1',
          },
        ],
      },
      {
        id: 'cat_008', code: 'ELEC-IC', name: '集成电路', parentCode: 'ELEC', parentName: '电子元器件',
        level: 2, path: '电子元器件 > 集成电路', description: 'IC芯片', status: 'EFFECTIVE',
        businessDomain: '物料分类', createdAt: '2025-01-15 09:30:00', createdBy: 'admin',
        modifiedAt: '2025-03-05 09:00:00', modifiedBy: 'admin',
        children: [
          {
            id: 'cat_009', code: 'ELEC-IC-MCU', name: 'MCU', parentCode: 'ELEC-IC', parentName: '集成电路',
            level: 3, path: '电子元器件 > 集成电路 > MCU', description: '微控制器', status: 'EFFECTIVE',
            businessDomain: '物料分类', createdAt: '2025-01-15 09:32:00', createdBy: 'admin',
            modifiedAt: '2025-03-05 09:05:00', modifiedBy: 'admin',
          },
        ],
      },
      {
        id: 'cat_010', code: 'ELEC-CN', name: '连接器', parentCode: 'ELEC', parentName: '电子元器件',
        level: 2, path: '电子元器件 > 连接器', description: '各类连接器', status: 'INVALID',
        businessDomain: '物料分类', createdAt: '2025-01-15 09:40:00', createdBy: 'admin',
        modifiedAt: '2025-04-01 08:00:00', modifiedBy: 'admin',
      },
    ],
  },
];

// ================= 工具函数 =================

/** 递归拉平分类树 */
export const flattenCategoryTree = (
  nodes: MockCategoryNode[],
  includeChildren: boolean,
): MockCategoryNode[] => {
  const result: MockCategoryNode[] = [];
  const walk = (list: MockCategoryNode[]) => {
    for (const node of list) {
      result.push(node);
      if (includeChildren && node.children) {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return result;
};

/** 从完整 mock 树中按 ID 集合提取选中节点及其子树 */
export const resolveSelectedNodes = (
  tree: MockCategoryNode[],
  selectedIds: Set<string>,
  includeChildren: boolean,
): MockCategoryNode[] => {
  const result: MockCategoryNode[] = [];
  const walk = (list: MockCategoryNode[]) => {
    for (const node of list) {
      if (selectedIds.has(node.id)) {
        if (includeChildren) {
          result.push(...flattenCategoryTree([node], true));
        } else {
          result.push(node);
        }
      } else if (node.children) {
        walk(node.children);
      }
    }
  };
  walk(tree);
  return result;
};

/** 将路径按分隔符重新格式化 */
export const reformatPath = (path: string, separator: string): string => {
  return path.split(' > ').join(separator);
};

/** 根据映射列与转换规则，生成预览行 */
export const buildPreviewRows = (
  nodes: MockCategoryNode[],
  columns: ExportColumnMapping[],
  rules: TransformRule[],
  pathSeparator: string,
): ExportPreviewRow[] => {
  const enabledCols = columns.filter(c => c.enabled);
  return nodes.map((node, idx) => {
    const row: ExportPreviewRow = { key: `row_${idx}` };
    for (const col of enabledCols) {
      let value: string | number | boolean | null | undefined = (node as unknown as Record<string, unknown>)[col.sourceField] as string | number | boolean | null | undefined;
      // 路径字段用自定义分隔符
      if (col.sourceField === 'path' && typeof value === 'string') {
        value = reformatPath(value, pathSeparator);
      }
      // 应用转换规则
      for (const rule of rules) {
        if (rule.field !== col.sourceField) continue;
        if (rule.type === 'PREFIX' && typeof value === 'string') {
          value = (rule.config.prefix || '') + value;
        }
        if (rule.type === 'SUFFIX' && typeof value === 'string') {
          value = value + (rule.config.suffix || '');
        }
        if (rule.type === 'ENUM_MAP' && typeof value === 'string') {
          value = rule.config[value] ?? value;
        }
      }
      row[col.targetHeader] = value;
    }
    return row;
  });
};

/** Mock 树节点 → antd DataNode（用于弹窗内树选择） */
export const mockTreeToDataNodes = (nodes: MockCategoryNode[]): DataNode[] => {
  return nodes.map(node => ({
    key: node.id,
    title: `${node.code} - ${node.name}`,
    children: node.children ? mockTreeToDataNodes(node.children) : undefined,
    isLeaf: !node.children || node.children.length === 0,
  }));
};
