'use client';

import React, { useEffect, useState } from "react";
import {
  UnorderedListOutlined,
  DashboardOutlined,
  AppstoreOutlined,
  DeploymentUnitOutlined,
  FileTextOutlined,
  PieChartOutlined,
  DatabaseOutlined,
  ApiOutlined,
  SettingOutlined,
  UserOutlined,
  FolderOpenOutlined,
} from "@ant-design/icons";
import { Spin } from 'antd';
import { usePathname, useRouter } from "next/navigation";
import UnifiedLayout, { MenuItem } from "@/layouts/UnifiedLayout";
import { authApi, isAuthErrorResponse } from '@/services/auth';
import {
  clearPersistedAuthState,
  mapWorkspaceSessionDtoToState,
  persistPlatformAuthState,
  persistWorkspaceSessionState,
  readPersistedAuthHeaders,
  readPersistedAuthSnapshot,
} from "@/utils/authStorage";

const menuData: MenuItem[] = [
  {
    path: "/dashboard",
    name: "仪表盘",
    icon: <DashboardOutlined />,
    children: [
      { path: "/dashboard/workbench", name: "工作台" },
      { path: "/dashboard/analysis", name: "分析概览" },
      { path: "/dashboard/monitor", name: "实时监控" },
    ],
  },
  {
    path: "/products",
    name: "产品管理",
    icon: <AppstoreOutlined />,
    children: [
      { path: "/products/catalog", name: "产品目录" },
      { path: "/products/version", name: "版本管理" },
      {
        path: "/products/specs",
        name: "规格配置",
        children: [
          { path: "/products/specs/attribute", name: "属性定义" },
          { path: "/products/specs/template", name: "模板管理" },
        ],
      },
    ],
  },
  {
    path: "/category",
    name: "分类管理",
    icon: <UnorderedListOutlined />,
    children: [
      { path: "/category/list", name: "分类集合" },
    ],
  },
  {
    path: "/projects",
    name: "项目集",
    icon: <FolderOpenOutlined />,
    children: [
      { path: "/projects/list", name: "项目列表" },
      { path: "/projects/milestone", name: "里程碑" },
      { path: "/projects/kanban", name: "任务看板" },
    ],
  },
  {
    path: "/workflow",
    name: "流程编排",
    icon: <DeploymentUnitOutlined />,
    children: [
      { path: "/workflow/definition", name: "流程定义" },
      { path: "/workflow/instance", name: "流程实例" },
      { path: "/workflow/form", name: "表单管理" },
    ],
  },
  {
    path: "/documents",
    name: "文档中心",
    icon: <FileTextOutlined />,
    children: [
      { path: "/documents/library", name: "资料库" },
      { path: "/documents/approval", name: "审批记录" },
    ],
  },
  {
    path: "/analytics",
    name: "数据分析",
    icon: <PieChartOutlined />,
    children: [
      { path: "/analytics/report", name: "报表中心" },
      { path: "/analytics/insight", name: "洞察平台" },
    ],
  },
  {
    path: "/assets",
    name: "资产管理",
    icon: <DatabaseOutlined />,
    children: [
      { path: "/assets/library", name: "资产库" },
      { path: "/assets/quality", name: "质量追踪" },
      { path: "/assets/warranty", name: "质保信息" },
    ],
  },
  {
    path: "/integration",
    name: "系统集成",
    icon: <ApiOutlined />,
    children: [
      { path: "/integration/adapter", name: "接口适配" },
      { path: "/integration/sync", name: "同步任务" },
      {
        path: "/integration/monitor",
        name: "运行监控",
        children: [
          { path: "/integration/monitor/log", name: "日志审计" },
          { path: "/integration/monitor/alert", name: "告警规则" },
        ],
      },
    ],
  },
  {
    path: "/system",
    name: "系统设置",
    icon: <SettingOutlined />,
    children: [
      { path: "/system/organization", name: "组织管理" },
      { path: "/system/role", name: "角色权限" },
      { path: "/system/preferences", name: "个性化设置" },
    ],
  },
  {
    path: "/user",
    name: "用户中心",
    icon: <UserOutlined />,
    children: [
      { path: "/user/profile", name: "个人信息" },
      { path: "/user/security", name: "安全设置" },
      { path: "/user/notification", name: "通知偏好" },
    ],
  },
];

const BasicLayout: React.FC<React.PropsWithChildren> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    let active = true;

    const restoreAccess = async () => {
      const persistedHeaders = readPersistedAuthHeaders();
      if (!persistedHeaders.platformToken || !persistedHeaders.platformTokenName) {
        clearPersistedAuthState();
        router.replace('/login');
        return;
      }

      try {
        const me = await authApi.getMe(persistedHeaders);

        if (!active) {
          return;
        }

        const currentSnapshot = readPersistedAuthSnapshot();
        persistPlatformAuthState({
          ...currentSnapshot.platformAuth,
          user: me.user,
        });

        const shouldCreateWorkspace = me.user.isFirstLogin || me.user.workspaceCount === 0;

        if (shouldCreateWorkspace) {
          persistWorkspaceSessionState(null);
          router.replace('/workspace/create');
          return;
        }

        if (me.currentWorkspace) {
          persistWorkspaceSessionState(mapWorkspaceSessionDtoToState(me.currentWorkspace));
          setCheckingAccess(false);
          return;
        }

        const targetWorkspaceId = me.defaultWorkspace?.workspaceId ?? me.workspaceOptions[0]?.workspaceId;
        if (!targetWorkspaceId) {
          router.replace('/workspace/create');
          return;
        }

        const restoredSession = await authApi.switchWorkspace(
          {
            workspaceId: targetWorkspaceId,
            rememberAsDefault: false,
          },
          persistedHeaders,
        );

        if (!active) {
          return;
        }

        persistWorkspaceSessionState(mapWorkspaceSessionDtoToState(restoredSession));
        setCheckingAccess(false);
      } catch (error) {
        if (!active) {
          return;
        }

        if (isAuthErrorResponse(error)) {
          if (error.code === 'AUTH_NOT_LOGGED_IN') {
            clearPersistedAuthState();
            router.replace('/login');
            return;
          }

          if (
            error.code === 'WORKSPACE_MEMBER_NOT_FOUND'
            || error.code === 'WORKSPACE_MEMBER_INACTIVE'
            || error.code === 'WORKSPACE_NOT_FOUND'
            || error.code === 'WORKSPACE_NOT_ACTIVE'
          ) {
            persistWorkspaceSessionState(null);

            try {
              const workspaces = await authApi.listWorkspaces(persistedHeaders);
              if (!active) {
                return;
              }

              if (workspaces.length === 0) {
                const snapshot = readPersistedAuthSnapshot();
                if (snapshot.platformAuth.user) {
                  persistPlatformAuthState({
                    ...snapshot.platformAuth,
                    user: {
                      ...snapshot.platformAuth.user,
                      workspaceCount: 0,
                    },
                  });
                }
                router.replace('/workspace/create');
                return;
              }

              const restoredSession = await authApi.switchWorkspace(
                {
                  workspaceId: workspaces[0].workspaceId,
                  rememberAsDefault: false,
                },
                persistedHeaders,
              );

              if (!active) {
                return;
              }

              persistWorkspaceSessionState(mapWorkspaceSessionDtoToState(restoredSession));
              setCheckingAccess(false);
              return;
            } catch {
              router.replace('/workspace/create');
              return;
            }
          }
        }

        router.replace('/login');
      }
    };

    void restoreAccess();

    return () => {
      active = false;
    };
  }, [pathname, router]);

  if (checkingAccess) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f5f7fa',
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  return (
    <UnifiedLayout menuData={menuData} enableWorkspaceSwitcher>
        {children}
    </UnifiedLayout>
  )
};

export default BasicLayout;
