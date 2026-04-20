'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGlobalLoading } from '@/components/providers/GlobalLoadingProvider';
import { authApi, isAuthErrorResponse } from '@/services/auth';
import {
  clearPersistedAuthState,
  persistPlatformAuthState,
  readPersistedAuthHeaders,
  readPersistedAuthSnapshot,
} from '@/utils/authStorage';

interface UseProtectedPlatformAdminAccessOptions {
  loadingMessage?: string;
}

export const useProtectedPlatformAdminAccess = (
  options?: UseProtectedPlatformAdminAccessOptions,
): boolean => {
  const router = useRouter();
  const { showLoading, hideLoading } = useGlobalLoading();
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    let active = true;
    const loadingId = showLoading(options?.loadingMessage ?? '正在验证平台管理员访问权限...');

    const allowAccess = () => {
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

    const restoreAccess = async () => {
      const persistedHeaders = readPersistedAuthHeaders();
      if (!persistedHeaders.platformToken || !persistedHeaders.platformTokenName) {
        clearPersistedAuthState();
        redirectTo('/admin-login');
        return;
      }

      try {
        const me = await authApi.getPlatformAdminMe(persistedHeaders);

        if (!active) {
          return;
        }

        const currentSnapshot = readPersistedAuthSnapshot();
        persistPlatformAuthState({
          ...currentSnapshot.platformAuth,
          user: null,
          admin: me.admin,
          principalType: 'platform-admin',
        });

        allowAccess();
      } catch (error) {
        if (!active) {
          return;
        }

        if (
          isAuthErrorResponse(error)
          && (
            error.code === 'AUTH_NOT_LOGGED_IN'
            || error.code === 'ACCOUNT_NOT_ACTIVE'
            || error.code === 'PLATFORM_ADMIN_REQUIRED'
          )
        ) {
          clearPersistedAuthState();
        }

        redirectTo('/admin-login');
      }
    };

    void restoreAccess();

    return () => {
      active = false;
      hideLoading(loadingId);
    };
  }, [hideLoading, options?.loadingMessage, router, showLoading]);

  return checkingAccess;
};