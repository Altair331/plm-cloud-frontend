---
name: plm-frontend-page-design
description: 基于 PLM Cloud Frontend（Next.js App Router + TypeScript + Ant Design + ProLayout）的页面设计与实现规范。只要用户提到"页面设计""后台页面""管理端界面""列表/表单/详情页""主题风格统一""按现有项目风格开发新页面""参考现有设计"，都应优先使用本技能，即使用户没有明确说"用 skill"。
compatibility:
  framework: Next.js 16 App Router
  language: TypeScript + React 19
  ui: Ant Design 6 + ProComponents
---

# PLM 前端页面设计 Skill

用于在当前仓库中新增或改造页面时，保证技术实现、目录结构与视觉风格完全对齐现有实现。设计规则均来自对已有代码的逐行提炼，不引入任何额外风格。

---

## 1. 项目基线

- 路由框架：`Next.js App Router`，目录在 `src/app/`，按路由组组织（`(admin)`、`(auth)`、`(main)`）
- UI 体系：`antd@6` + `@ant-design/pro-components`，布局基于 `src/layouts/UnifiedLayout.tsx`
- 主题来源：
  - 设计 token：`src/styles/theme.ts`（`themeTokens`：`colorPrimary: '#0f62fe'`，`borderRadius: 10`，`headerHeight: 56`，`siderWidth: 224`）
  - 调色板：`src/styles/colors.ts`（`lightPalette` / `darkPalette`，通过 `getPalette(mode)` 获取）
  - CSS 变量由 `UnifiedLayout` 在 `html` 元素的 `data-theme` 上维护，如 `--menu-*`、`--tab-*`
- 每个路由组必须有 `layout.tsx`，使用 `UnifiedLayout` 传入 `menuData`
- 页面文件落点：
  - 管理端：`src/app/(admin)/admin/<module>/[id]/page.tsx` 或 `page.tsx`
  - 主业务端：`src/app/(main)/<module>/page.tsx`
  - 模块内组件：`<module>/components/*.tsx`
  - 跨模块组件：`src/components/<ComponentName>/`
  - 业务功能抽象：`src/features/<domain>/`
  - 领域模型：`src/models/<domain>.ts`
  - 接口服务：`src/services/<domain>.ts`
  - 全局上下文：`src/contexts/`，注入入口：`src/components/providers/AppProviders.tsx`

### 1.1 当前目录映射（2026-03）

```
src/app/(admin)/admin/
  category/
    [id]/page.tsx          # 分类管理主页（树 + Splitter + AttributeDesigner）
    AdminCategoryTree.tsx  # 带工具栏的分类树适配层
    AttributeDesigner.tsx  # 属性设计工作台（列表 + 工作区 Splitter）
    components/
      AttributeList.tsx
      AttributeWorkspace.tsx
      BatchDeleteModal.tsx
      BatchTransferModal.tsx
      CreateCategoryModal.tsx
      toolbarStyles.ts     # 工具栏样式常量与工厂函数
      types.ts
    batch-transfer/components/
      ActionFooter.tsx
      BatchTransferDryRunPanel.tsx
      DraggableSourceTree.tsx
      DropTargetTree.tsx
      TransferWorkspace.tsx
      dnd-tree-styles.ts
      transferNodeStyles.ts
  dashboard/page.tsx       # 概览（Card + Statistic + Row/Col）
  users/page.tsx           # 用户表格（ProTable）
  settings/page.tsx        # redirect → code-config
  settings/code-config/page.tsx  # 空（待开发）
src/components/
  ContextMenu/FloatingContextMenu.tsx
  DraggableModal/index.tsx
  VersionGraph/index.tsx
src/features/category/CategoryTree.tsx
src/contexts/DictionaryContext.tsx
```

---

## 2. Token 使用速查表

| 用途 | Token |
|------|-------|
| 主容器背景 | `token.colorBgContainer` |
| 布局背景 | `token.colorBgLayout` |
| 次级填充（card alt） | `token.colorFillAlter` |
| 四级填充 | `token.colorFillQuaternary` |
| 禁用背景 | `token.colorBgContainerDisabled` |
| 主边框 | `token.colorBorder` |
| 次级边框 | `token.colorBorderSecondary` |
| 主文字 | `token.colorText` |
| 次级文字 | `token.colorTextSecondary` |
| 三级文字 | `token.colorTextTertiary` |
| 最浅文字 | `token.colorTextQuaternary` |
| 禁用文字 | `token.colorTextDisabled` |
| 主色 | `token.colorPrimary` |
| 主色背景 | `token.colorPrimaryBg` |
| 主色边框 | `token.colorPrimaryBorder` |
| 信息背景 | `token.colorInfoBg` |
| 信息边框 | `token.colorInfoBorder` |
| 成功色（复制按钮） | `token.colorSuccess` |
| 行悬停背景 | `token.controlItemBgHover` |
| 行激活背景 | `token.controlItemBgActive` |
| 大圆角 | `token.borderRadiusLG` |

**注意：** CSS 变量 `var(--ant-color-bg-container, #fff)` 仅在无法用 token hook 的地方（如 Splitter style 等 antd 内部节点）使用。

---

## 3. 代码编写风格

### 3.1 命名约定

- 组件 / 文件：PascalCase（`AttributeWorkspace`、`CategoryTree`）
- Hook：`useXxx`，返回 `{ data, loading, error, run }` 等稳定结构
- 事件处理：`handleXxx`；映射/规范化：`mapXxx`、`normalizeXxx`
- 常量：全大写下划线（`TOOLBAR_ICON_BUTTON_SIZE`、`LIST_GRID_TEMPLATE_COLUMNS`）
- Style 常量文件：`xxxStyles.ts`，与组件文件同目录

### 3.2 类型约束

- 所有 Props、DTO、ViewModel 显式声明 interface/type，避免隐式 any
- 后端 DTO 放 `src/models/`，页面 ViewModel 就地声明（小）或放 `components/types.ts`（大）
- 分页：`{ content, totalElements, totalPages, size, number }` 统一结构

### 3.3 状态与副作用

- 函数组件 + hooks；`useMemo` 做派生状态
- `useEffect` 清理：事件监听、beforeunload、observer 必须清理
- 多选、脏数据、未保存离开必须显式状态化

### 3.4 服务层

- 所有接口调用走 `src/services/*.ts`，不在组件内写 axios
- 路径参数用 `encodeURIComponent` 处理
- service 层透传错误，页面层负责 `message.error` 提示

### 3.5 UI 细节

- 图标库可混用（antd + MUI），但同一模块保持统一
- 中英文混合文案保留，但同一交互链路语气一致
- 注释说明"意图与边界"，不解释显而易见的代码

---

## 4. 禁止事项

- 不要引入与当前项目冲突的全新 UI 体系（如 Tailwind-only）
- 不要绕开 App Router 采用旧式页面组织
- 不要大量内联硬编码颜色（背景色、边框色必须用 token）
- 不要把工具栏按钮写成方形—— 本项目圆形按钮使用 `borderRadius: 999`
- 不要跳过 DraggableModal 直接用 Modal（所有表单类弹窗统一用 DraggableModal）
- 不要在弹窗 footer 放保存按钮（保存按钮在 body 顶部的 Space 里）
- 不要使用 any 类型
- 不要把模块私有组件放到 `src/components/`，先判断是否跨模块
- 不要在 JSX 里内联复杂数据映射，集中到 `mapXxx` 函数
- 不要使用大量的局部CSS，优先使用antd框架内支持的token或 CSS 变量
- 不要使用大量的卡片化ui设计，优先考虑列表、表单、详情页等更紧凑的设计模式

---

## 5. 设计质量自检

- [ ] 高度计算用 `calc(100vh - 163px)`，不写死 px
- [ ] 工具栏 46~48px，圆形按钮 24px，间距 6px
- [ ] `Splitter` 容器有 `overflow: hidden`，Panel 有 `flex: 1, minHeight: 0`
- [ ] Drawer 在面板内：`getContainer={false}` + `rootStyle={{ position: 'absolute' }}`
- [ ] 脏检查用 `normalizeXxx` + JSON.stringify 比较
- [ ] `modal.confirm` 来自 `App.useApp()`，不用全局 `Modal.confirm`
- [ ] 枚举标签通过 `useDictionary().getLabel` 获取，不硬编码中文
- [ ] 明暗模式下所有背景/文字/边框均用 token（无 #fff / #000 硬编码）
- [ ] 表单弹窗关闭前有脏检查，`maskClosable={false}` + `keyboard={false}`
- [ ] 新增页面无遗漏的 `use client` 声明（交互页面均需）
- [ ] 使用`npx tsc --noEmit`检查无类型错误，无输出则表示通过

当用户要求"按当前项目风格设计/实现新页面"时，直接执行本 skill，严格遵循本文档中的所有模式。
