import React, { useEffect, useMemo, useState } from 'react';
import type { MenuProps } from 'antd';
import { App, Dropdown, Avatar, Typography, Space, Input, Badge, Button, Tooltip } from 'antd';
import {
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  SkinOutlined,
  GlobalOutlined,
  FileTextOutlined,
  CreditCardOutlined,
  BellOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import type { AppPalette } from '@/styles/colors';
import { authApi, isAuthErrorResponse } from '@/services/auth';
import { clearPersistedAuthState, persistPlatformAuthState, persistWorkspaceSessionState, readPersistedAuthHeaders, readPersistedAuthSnapshot } from '@/utils/authStorage';
import type { AuthPlatformAdminSummaryDto, AuthUserSummaryDto } from '@/models/auth';

interface HeaderRightProps {
  authMode?: 'user' | 'platform-admin';
  isDarkMode: boolean;
  onToggleTheme: () => void;
  palette: AppPalette;
}

const HeaderRight: React.FC<HeaderRightProps> = ({ authMode = 'user', isDarkMode, onToggleTheme, palette }) => {
  const { message } = App.useApp();
  const router = useRouter();
  const initialSnapshot = useMemo(() => readPersistedAuthSnapshot(), []);
  const [user, setUser] = useState<AuthUserSummaryDto | null>(initialSnapshot.platformAuth.user);
  const [admin, setAdmin] = useState<AuthPlatformAdminSummaryDto | null>(initialSnapshot.platformAuth.admin);
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    const persistedHeaders = readPersistedAuthHeaders();
    if (!persistedHeaders.platformToken || !persistedHeaders.platformTokenName) {
      return;
    }

    let active = true;

    if (authMode === 'platform-admin') {
      authApi.getPlatformAdminMe(persistedHeaders)
        .then((response) => {
          if (!active) {
            return;
          }

          setAdmin(response.admin);
          const snapshot = readPersistedAuthSnapshot();
          persistPlatformAuthState({
            ...snapshot.platformAuth,
            user: null,
            admin: response.admin,
            principalType: 'platform-admin',
          });
        })
        .catch(() => {
          if (active) {
            setAdmin(initialSnapshot.platformAuth.admin);
          }
        });
    } else {
      authApi.getMe(persistedHeaders)
        .then((response) => {
          if (!active) {
            return;
          }

          setUser(response.user);
          const snapshot = readPersistedAuthSnapshot();
          persistPlatformAuthState({
            ...snapshot.platformAuth,
            user: response.user,
            admin: null,
            principalType: 'user',
          });
        })
        .catch(() => {
          if (active) {
            setUser(initialSnapshot.platformAuth.user);
          }
        });
    }

    return () => {
      active = false;
    };
  }, [authMode, initialSnapshot.platformAuth.admin, initialSnapshot.platformAuth.user]);

  const accountDisplayName = authMode === 'platform-admin'
    ? (admin?.displayName || '平台管理员')
    : (user?.displayName || '当前账号');

  const accountEmail = authMode === 'platform-admin'
    ? (admin?.email || '未绑定邮箱')
    : (user?.email || '未绑定邮箱');

  const menuItems = useMemo<MenuProps['items']>(
    () => [
      {
        key: 'profile-group',
        type: 'group',
        label: accountDisplayName,
        children: [
          {
            key: 'profile-email',
            label: (
              <Space size={4}>
                <FileTextOutlined />
                <Typography.Text style={{ color: palette.textSecondary }}>
                  {accountEmail}
                </Typography.Text>
              </Space>
            ),
            disabled: false,
          },
        ],
      },
      { type: 'divider', key: 'divider-1' },
      {
        key: 'language',
        label: '语言 (简体中文)',
        icon: <GlobalOutlined />,
        children: [
          { key: 'lang-zh', label: '简体中文' },
          { key: 'lang-en', label: 'English' },
          { key: 'lang-ja', label: '日本語' },
        ],
      },
      { key: 'billing', label: '账单', icon: <CreditCardOutlined /> },
      {
        key: 'theme',
        label: (
          <Space size={4}>
            <span>深色模式</span>
            <Typography.Text style={{ color: palette.textSecondary }}>
              {isDarkMode ? '已开启' : '已关闭'}
            </Typography.Text>
          </Space>
        ),
        icon: <SkinOutlined />,
      },
      { type: 'divider', key: 'divider-2' },
      { key: 'logout', label: '退出登录', icon: <LogoutOutlined /> },
    ],
    [accountDisplayName, accountEmail, isDarkMode, palette]
  );

  const handleLogout = async () => {
    const persistedHeaders = readPersistedAuthHeaders();
    setLogoutLoading(true);

    try {
      if (persistedHeaders.platformToken && persistedHeaders.platformTokenName) {
        await authApi.logout(persistedHeaders);
      }
    } catch (error) {
      if (isAuthErrorResponse(error) && error.code !== 'AUTH_NOT_LOGGED_IN') {
        message.error(error.message || '退出登录失败，请稍后重试。');
        setLogoutLoading(false);
        return;
      }
    }

    clearPersistedAuthState();
    persistWorkspaceSessionState(null);
    message.success('已退出登录。');
    router.push(authMode === 'platform-admin' ? '/admin-login' : '/login');
    router.refresh();
    setLogoutLoading(false);
  };

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'theme') {
      onToggleTheme();
      return;
    }

    if (key === 'logout') {
      void handleLogout();
    }
  };

  const searchInputStyle: React.CSSProperties = {
    width: 240,
    borderRadius: 999,
    backgroundColor: palette.mode === 'dark' ? 'rgba(32, 44, 58, 0.86)' : '#ffffff',
    border: palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e5e7eb',
    color: palette.textPrimary,
  };

  return (
    <Space align="center" size={16}>
      <Input
        allowClear
        placeholder="搜索功能/页面"
        prefix={<SearchOutlined style={{ color: palette.textSecondary }} />}
        style={searchInputStyle}
        size="middle"
      />
      <Tooltip title="消息通知">
        <Badge dot offset={[-2, 2]}>
          <Button
            type="text"
            icon={<BellOutlined style={{ color: palette.iconColor }} />}
            style={{
              padding: 8,
              borderRadius: 999,
                backgroundColor: palette.notificationBg,
                boxShadow: `0 0 0 1px ${palette.notificationBorder}`,
            }}
          />
        </Badge>
      </Tooltip>
      <Dropdown
        trigger={['click']}
        menu={{ items: menuItems, onClick: handleMenuClick }}
        placement="bottomRight"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 12px',
            cursor: 'pointer',
            borderRadius: 999,
            transition: 'background-color 0.2s ease',
            color: palette.textPrimary,
          }}
        >
          <Avatar size={28} icon={<UserOutlined />} />
          <Typography.Text strong style={{ color: palette.textPrimary }}>
            {accountDisplayName}
          </Typography.Text>
          <SettingOutlined style={{ color: palette.iconColor }} />
        </div>
      </Dropdown>
    </Space>
  );
};

export default HeaderRight;
