import request from './request';
import type {
  AuthCreateWorkspaceRequestDto,
  AuthErrorCode,
  AuthErrorResponseDto,
  AuthLoginResponseDto,
  AuthMeResponseDto,
  AuthPasswordLoginRequestDto,
  AuthRegisterRequestDto,
  AuthRegisterResponseDto,
  AuthRequestHeaders,
  AuthSendRegisterEmailCodeRequestDto,
  AuthSendRegisterEmailCodeResponseDto,
  AuthWorkspaceInvitationEmailBatchRequestDto,
  AuthWorkspaceInvitationEmailBatchResponseDto,
  AuthWorkspaceInvitationLinkCreateRequestDto,
  AuthWorkspaceInvitationLinkDto,
  AuthWorkspaceBootstrapOptionsDto,
  AuthSwitchWorkspaceRequestDto,
  AuthWorkspaceSessionDto,
  AuthWorkspaceSummaryDto,
  PlatformAuthState,
  WorkspaceSessionState,
} from '@/models/auth';

export type {
  AuthCreateWorkspaceRequestDto,
  AuthErrorCode,
  AuthErrorResponseDto,
  AuthLoginResponseDto,
  AuthMeResponseDto,
  AuthPasswordLoginRequestDto,
  AuthRegisterRequestDto,
  AuthRegisterResponseDto,
  AuthRequestHeaders,
  AuthSendRegisterEmailCodeRequestDto,
  AuthSendRegisterEmailCodeResponseDto,
  AuthInvitationSourceScene,
  AuthWorkspaceInvitationEmailBatchItemDto,
  AuthWorkspaceInvitationEmailBatchRequestDto,
  AuthWorkspaceInvitationEmailBatchResponseDto,
  AuthWorkspaceInvitationEmailBatchResult,
  AuthWorkspaceInvitationLinkCreateRequestDto,
  AuthWorkspaceInvitationLinkDto,
  AuthWorkspaceInvitationLinkStatus,
  AuthWorkspaceBootstrapOptionsDto,
  AuthWorkspaceDictionaryOptionDto,
  AuthSwitchWorkspaceRequestDto,
  AuthUserStatus,
  AuthWorkspaceMemberStatus,
  AuthWorkspaceSessionDto,
  AuthWorkspaceStatus,
  AuthWorkspaceSummaryDto,
  AuthWorkspaceType,
  PlatformAuthState,
  WorkspaceSessionState,
} from '@/models/auth';

const AUTH_BASE = '/auth';
const AUTH_PUBLIC_BASE = `${AUTH_BASE}/public`;
const AUTH_WORKSPACE_SESSION_BASE = `${AUTH_BASE}/workspace-session`;
const AUTH_WORKSPACE_INVITATIONS_BASE = `${AUTH_BASE}/workspace-invitations`;
const AUTH_WORKSPACE_INVITATION_LINKS_BASE = `${AUTH_BASE}/workspace-invitation-links`;

const normalize204Response = <T>(data: T | '' | null | undefined): T | null => {
  if (data === '' || data == null) {
    return null;
  }

  return data;
};

export const buildAuthHeaders = (authHeaders?: AuthRequestHeaders): Record<string, string> => {
  const headers: Record<string, string> = {};

  if (authHeaders?.platformTokenName && authHeaders.platformToken) {
    headers[authHeaders.platformTokenName] = authHeaders.platformToken;
  }

  if (authHeaders?.workspaceTokenName && authHeaders.workspaceToken) {
    headers[authHeaders.workspaceTokenName] = authHeaders.workspaceToken;
  }

  return headers;
};

export const buildPlatformAuthHeaders = (authHeaders?: AuthRequestHeaders): Record<string, string> => {
  const headers: Record<string, string> = {};

  if (authHeaders?.platformTokenName && authHeaders.platformToken) {
    headers[authHeaders.platformTokenName] = authHeaders.platformToken;
  }

  return headers;
};

export const isAuthErrorResponse = (error: unknown): error is AuthErrorResponseDto => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return 'status' in error && 'message' in error && 'code' in error;
};

export const authApi = {
  getWorkspaceBootstrapOptions(): Promise<AuthWorkspaceBootstrapOptionsDto> {
    return request.get(`${AUTH_PUBLIC_BASE}/workspace-bootstrap-options`);
  },

  sendRegisterEmailCode(
    data: AuthSendRegisterEmailCodeRequestDto,
  ): Promise<AuthSendRegisterEmailCodeResponseDto> {
    return request.post(`${AUTH_PUBLIC_BASE}/register/email-code`, data);
  },

  registerAccount(data: AuthRegisterRequestDto): Promise<AuthRegisterResponseDto> {
    return request.post(`${AUTH_PUBLIC_BASE}/register`, data);
  },

  loginWithPassword(data: AuthPasswordLoginRequestDto): Promise<AuthLoginResponseDto> {
    return request.post(`${AUTH_PUBLIC_BASE}/login/password`, data);
  },

  logout(authHeaders: AuthRequestHeaders): Promise<void> {
    return request.post(`${AUTH_BASE}/logout`, undefined, {
      headers: buildPlatformAuthHeaders(authHeaders),
    }).then(() => undefined);
  },

  getMe(authHeaders: AuthRequestHeaders): Promise<AuthMeResponseDto> {
    return request.get(`${AUTH_BASE}/me`, {
      headers: buildPlatformAuthHeaders(authHeaders),
    });
  },

  listWorkspaces(authHeaders: AuthRequestHeaders): Promise<AuthWorkspaceSummaryDto[]> {
    return request.get(`${AUTH_BASE}/workspaces`, {
      headers: buildPlatformAuthHeaders(authHeaders),
    });
  },

  createWorkspace(
    data: AuthCreateWorkspaceRequestDto,
    authHeaders: AuthRequestHeaders,
  ): Promise<AuthWorkspaceSessionDto> {
    return request.post(`${AUTH_BASE}/workspaces`, data, {
      headers: buildPlatformAuthHeaders(authHeaders),
    });
  },

  inviteWorkspaceMembersByEmail(
    data: AuthWorkspaceInvitationEmailBatchRequestDto,
    authHeaders: AuthRequestHeaders,
  ): Promise<AuthWorkspaceInvitationEmailBatchResponseDto> {
    return request.post(`${AUTH_WORKSPACE_INVITATIONS_BASE}/email-batch`, data, {
      headers: buildPlatformAuthHeaders(authHeaders),
    });
  },

  createWorkspaceInvitationLink(
    data: AuthWorkspaceInvitationLinkCreateRequestDto,
    authHeaders: AuthRequestHeaders,
  ): Promise<AuthWorkspaceInvitationLinkDto> {
    return request.post(`${AUTH_WORKSPACE_INVITATION_LINKS_BASE}`, data, {
      headers: buildPlatformAuthHeaders(authHeaders),
    });
  },

  switchWorkspace(
    data: AuthSwitchWorkspaceRequestDto,
    authHeaders: AuthRequestHeaders,
  ): Promise<AuthWorkspaceSessionDto> {
    return request.post(`${AUTH_WORKSPACE_SESSION_BASE}/switch`, data, {
      headers: buildPlatformAuthHeaders(authHeaders),
    });
  },

  getCurrentWorkspaceSession(authHeaders: AuthRequestHeaders): Promise<AuthWorkspaceSessionDto | null> {
    return request.get(`${AUTH_WORKSPACE_SESSION_BASE}/current`, {
      headers: buildPlatformAuthHeaders(authHeaders),
    }).then((response) => normalize204Response(response as unknown as AuthWorkspaceSessionDto | '' | null | undefined));
  },

  clearCurrentWorkspaceSession(authHeaders: AuthRequestHeaders): Promise<void> {
    return request.delete(`${AUTH_WORKSPACE_SESSION_BASE}/current`, {
      headers: buildPlatformAuthHeaders(authHeaders),
    }).then(() => undefined);
  },
};

export interface RegisterPayload {
  email: string;
  password: string;
  givenName: string;
  surname: string;
  company: string;
}

export interface RegisterResult {
  success: boolean;
  userId?: string;
}

export function register(data: RegisterPayload): Promise<RegisterResult> {
  return request.post('/api/auth/register', data).then(() => ({ success: true }));
}
