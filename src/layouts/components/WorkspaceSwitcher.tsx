import React, { useMemo, useState } from 'react';
import { App, Avatar, Button, Divider, Flex, Popover, Space, Switch, Tag, Typography } from 'antd';
import {
  ApartmentOutlined,
  CheckOutlined,
  DownOutlined,
  PlusOutlined,
  SettingOutlined,
  TeamOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import type { AppPalette } from '@/styles/colors';

interface WorkspaceSwitcherProps {
  palette: AppPalette;
}

interface WorkspaceOption {
  id: string;
  name: string;
  plan: string;
  memberCount: number;
  area: 'PRIVATE' | 'TEAM';
}

const MOCK_WORKSPACES: WorkspaceOption[] = [
  {
    id: 'workspace-rd',
    name: 'MI SAKA 的工作空间',
    plan: '免费版 · 1 位成员',
    memberCount: 1,
    area: 'PRIVATE',
  },
  {
    id: 'workspace-headquarter',
    name: 'MI SAKA 的工作空间总部',
    plan: '团队协作区',
    memberCount: 12,
    area: 'TEAM',
  },
];

const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({ palette }) => {
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(MOCK_WORKSPACES[0].id);
  const [newSidebarEnabled, setNewSidebarEnabled] = useState(false);

  const currentWorkspace = useMemo(
    () => MOCK_WORKSPACES.find((item) => item.id === currentWorkspaceId) ?? MOCK_WORKSPACES[0],
    [currentWorkspaceId],
  );

  const triggerActive = open || hovered;
  const workspaceInitial = currentWorkspace.name.trim().charAt(0).toUpperCase() || 'W';

  const popoverContent = (
    <div
      style={{
        width: 360,
        padding: 8,
      }}
    >
      <Space orientation="vertical" size={0} style={{ width: '100%' }}>
        <div
          style={{
            padding: 12,
            borderRadius: 16,
            background: palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : palette.bgContainer,
            border: `1px solid ${palette.borderColor}`,
          }}
        >
          <Flex justify="space-between" align="start" gap={12}>
            <Space align="start" size={12}>
              <Avatar
                shape="square"
                size={40}
                icon={<ApartmentOutlined />}
                style={{
                  background: palette.mode === 'dark' ? '#8a4b12' : '#b85c18',
                  color: '#fff',
                  borderRadius: 10,
                }}
              />
              <div>
                <Typography.Text strong style={{ color: palette.textPrimary, display: 'block' }}>
                  {currentWorkspace.name}
                </Typography.Text>
                <Typography.Text style={{ color: palette.textSecondary, fontSize: 12 }}>
                  {currentWorkspace.plan}
                </Typography.Text>
              </div>
            </Space>
            <Button type="text" icon={<SettingOutlined />} style={{ color: palette.iconColor }} />
          </Flex>

          <Space style={{ marginTop: 14 }}>
            <Button
              size="small"
              style={{ borderRadius: 10 }}
              icon={<SettingOutlined />}
            >
              设置
            </Button>
            <Button
              size="small"
              style={{ borderRadius: 10 }}
              icon={<TeamOutlined />}
            >
              邀请成员
            </Button>
          </Space>
        </div>

        <div style={{ padding: '14px 12px 8px' }}>
          <Typography.Text style={{ color: palette.textSecondary, fontSize: 12 }}>
            账号
          </Typography.Text>
        </div>

        <div style={{ padding: '0 12px 10px' }}>
          <Typography.Text style={{ color: palette.textPrimary }}>
            misaka25680@gmail.com
          </Typography.Text>
        </div>

        <div style={{ padding: '0 8px 8px' }}>
          {MOCK_WORKSPACES.map((workspace) => {
            const selected = workspace.id === currentWorkspaceId;
            return (
              <button
                key={workspace.id}
                type="button"
                onClick={() => {
                  setCurrentWorkspaceId(workspace.id);
                  setOpen(false);
                  message.success(`已切换到 ${workspace.name}`);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: 'none',
                  background: selected
                    ? palette.mode === 'dark'
                      ? 'rgba(15, 98, 254, 0.14)'
                      : 'rgba(15, 98, 254, 0.08)'
                    : 'transparent',
                  color: palette.textPrimary,
                  cursor: 'pointer',
                }}
              >
                <Space size={10}>
                  <Avatar
                    shape="square"
                    size={28}
                    style={{
                      background: workspace.area === 'TEAM' ? '#5b8c00' : '#b85c18',
                      color: '#fff',
                      borderRadius: 8,
                    }}
                  />
                  <div style={{ textAlign: 'left' }}>
                    <Typography.Text style={{ color: palette.textPrimary, display: 'block' }}>
                      {workspace.name}
                    </Typography.Text>
                    <Typography.Text style={{ color: palette.textSecondary, fontSize: 12 }}>
                      {workspace.plan}
                    </Typography.Text>
                  </div>
                </Space>
                {selected ? <CheckOutlined style={{ color: palette.menuTextSelected }} /> : null}
              </button>
            );
          })}
        </div>

        <div style={{ padding: '0 12px 12px' }}>
          <Button
            type="link"
            icon={<PlusOutlined />}
            style={{ paddingInline: 0, color: palette.menuTextSelected }}
            onClick={() => message.info('后续在这里接入新建工作空间流程。')}
          >
            新建工作空间
          </Button>
        </div>

        <Divider style={{ margin: '4px 0 8px', borderColor: palette.borderColor }} />

        <div style={{ padding: '0 12px 8px' }}>
          <Typography.Text style={{ color: palette.textSecondary, fontSize: 12 }}>
            Placeholder
          </Typography.Text>
        </div>

        <Space orientation="vertical" size={2} style={{ width: '100%', padding: '0 8px 12px' }}>
          <Button type="text" style={{ justifyContent: 'flex-start', color: palette.textPrimary }} icon={<UserSwitchOutlined />}>
            Placeholder
          </Button>
          <Button type="text" style={{ justifyContent: 'flex-start', color: palette.textPrimary }} icon={<UserSwitchOutlined />}>
            Placeholder
          </Button>
          <Button type="text" style={{ justifyContent: 'flex-start', color: palette.textPrimary }} icon={<UserSwitchOutlined />}>
            Placeholder
          </Button>
        </Space>

        <div
          style={{
            margin: '0 8px 4px',
            padding: 14,
            borderRadius: 14,
            border: `1px solid ${palette.borderColor}`,
            background: palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
          }}
        >
          <Flex justify="space-between" align="center" gap={12}>
            <div>
              <Typography.Text style={{ color: palette.textPrimary, display: 'block' }}>
                试用新侧边栏
              </Typography.Text>
              <Typography.Text style={{ color: palette.textSecondary, fontSize: 12 }}>
                你的页面、会议和 AI，一步到位。
              </Typography.Text>
            </div>
            <Switch checked={newSidebarEnabled} onChange={setNewSidebarEnabled} size="small" />
          </Flex>
        </div>
      </Space>
    </div>
  );

  return (
    <Popover
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomLeft"
      arrow={false}
      content={popoverContent}
      styles={{
        root: { paddingTop: 0 },
        container: {
          padding: 0,
          borderRadius: 20,
          background: palette.bgContainer,
          border: `1px solid ${palette.borderColor}`,
          boxShadow:
            palette.mode === 'dark'
              ? '0 24px 64px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.04)'
              : '0 28px 60px rgba(15, 24, 40, 0.16), 0 8px 20px rgba(15, 24, 40, 0.08)',
          overflow: 'hidden',
        },
      }}
    >
      <button
        type="button"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          padding: '6px 16px 6px 8px',
          minHeight: 40,
          borderRadius: 999,
          border: 'none',
          background: triggerActive
            ? palette.mode === 'dark'
              ? 'rgba(255, 255, 255, 0.06)'
              : 'rgba(15, 24, 40, 0.06)'
            : 'transparent',
          color: palette.textPrimary,
          cursor: 'pointer',
          boxShadow: 'none',
          transition: 'background-color 0.18s ease',
        }}
      >
        <Avatar
          shape="square"
          size={24}
          style={{
            background: palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 24, 40, 0.08)',
            color: palette.textSecondary,
            borderRadius: 7,
            fontSize: 13,
            fontWeight: 600,
            flex: '0 0 auto',
          }}
        >
          {workspaceInitial}
        </Avatar>
        <Typography.Text
          strong
          style={{
            color: palette.textPrimary,
            fontSize: 13,
            maxWidth: 220,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.1,
            margin: 0,
          }}
        >
            {currentWorkspace.name}
        </Typography.Text>
        <DownOutlined style={{ color: palette.iconColor, fontSize: 10, flex: '0 0 auto' }} />
      </button>
    </Popover>
  );
};

export default WorkspaceSwitcher;