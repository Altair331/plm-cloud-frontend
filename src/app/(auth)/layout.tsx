"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useGlobalLoading } from '@/components/providers/GlobalLoadingProvider';
import { authApi, isAuthErrorResponse } from '@/services/auth';
import {
  clearPersistedAuthState,
  mapWorkspaceSessionDtoToState,
  persistPlatformAuthState,
  persistWorkspaceSessionState,
  readPersistedAuthHeaders,
  readPersistedAuthSnapshot,
} from '@/utils/authStorage';
import './login/login.css';
import './register/register.css';
import './admin-login/admin-login.css';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { showLoading, hideLoading } = useGlobalLoading();
  const persistedHeaders = useMemo(() => readPersistedAuthHeaders(), []);
  const currentSnapshot = useMemo(() => readPersistedAuthSnapshot(), []);
  const hasPersistedPlatformToken = Boolean(
    persistedHeaders.platformToken && persistedHeaders.platformTokenName,
  );
  const [checkingAccess, setCheckingAccess] = useState(hasPersistedPlatformToken);

  useEffect(() => {
    if (!hasPersistedPlatformToken) {
      return;
    }

    let active = true;
    const isPlatformAdmin = currentSnapshot.platformAuth.principalType === 'platform-admin';

    const loadingId = showLoading('正在检查登录状态...');

    const allowAuthPage = () => {
      if (!active) {
        return;
      }

      hideLoading(loadingId);
      setCheckingAccess(false);
    };

    const redirectTo = (targetPath: string) => {
      if (!active) {
        return;
      }

      router.replace(targetPath);
    };

    const restoreSession = async () => {
      try {
        if (isPlatformAdmin) {
          const adminMe = await authApi.getPlatformAdminMe(persistedHeaders);

          if (!active) {
            return;
          }

          persistPlatformAuthState({
            ...currentSnapshot.platformAuth,
            user: null,
            admin: adminMe.admin,
            principalType: 'platform-admin',
          });
          redirectTo('/admin/dashboard');
          return;
        }

        const me = await authApi.getMe(persistedHeaders);

        if (!active) {
          return;
        }

        persistPlatformAuthState({
          ...currentSnapshot.platformAuth,
          user: me.user,
          admin: null,
          principalType: 'user',
        });

        const shouldCreateWorkspace = me.user.isFirstLogin || me.user.workspaceCount === 0;

        if (shouldCreateWorkspace) {
          persistWorkspaceSessionState(null);
          redirectTo('/workspace/create');
          return;
        }

        if (me.currentWorkspace) {
          persistWorkspaceSessionState(mapWorkspaceSessionDtoToState(me.currentWorkspace));
          redirectTo('/dashboard');
          return;
        }

        const targetWorkspaceId = me.defaultWorkspace?.workspaceId ?? me.workspaceOptions[0]?.workspaceId;

        if (!targetWorkspaceId) {
          persistWorkspaceSessionState(null);
          redirectTo('/workspace/create');
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
        redirectTo('/dashboard');
      } catch (error) {
        if (!active) {
          return;
        }

        if (isAuthErrorResponse(error)) {
          if (error.code === 'AUTH_NOT_LOGGED_IN') {
            clearPersistedAuthState();
          }

          if (isPlatformAdmin && (error.code === 'PLATFORM_ADMIN_REQUIRED' || error.code === 'ACCOUNT_NOT_ACTIVE')) {
            clearPersistedAuthState();
          }
        }

        allowAuthPage();
      }
    };

    void restoreSession();

    return () => {
      active = false;
      hideLoading(loadingId);
    };
  }, [currentSnapshot, hasPersistedPlatformToken, hideLoading, pathname, persistedHeaders, router, showLoading]);

  if (checkingAccess) {
    return null;
  }

  return children;
}
