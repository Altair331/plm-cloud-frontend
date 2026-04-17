type OpenEndedUnion<T extends string> = T | (string & {});

export type AuthUserStatus = OpenEndedUnion<'ACTIVE' | 'INACTIVE' | 'DISABLED' | 'LOCKED'>;

export type AuthWorkspaceStatus = OpenEndedUnion<'ACTIVE' | 'INACTIVE' | 'FROZEN'>;

export type AuthWorkspaceMemberStatus = OpenEndedUnion<'ACTIVE' | 'INACTIVE'>;

export type AuthWorkspaceType = OpenEndedUnion<'TEAM' | 'PERSONAL' | 'LEARNING'>;

export type AuthInvitationSourceScene = OpenEndedUnion<'WORKSPACE' | 'ONBOARDING'>;

export type AuthWorkspaceInvitationEmailBatchResult = OpenEndedUnion<
  | 'CREATED'
  | 'INVALID_EMAIL'
  | 'DUPLICATE_INPUT'
  | 'SELF_SKIPPED'
  | 'ALREADY_MEMBER'
  | 'PENDING_EXISTS'
>;

export type AuthWorkspaceInvitationLinkStatus = OpenEndedUnion<'ACTIVE' | 'DISABLED' | 'EXPIRED'>;

export type AuthErrorCode = OpenEndedUnion<
  | 'INVALID_ARGUMENT'
  | 'AUTH_NOT_LOGGED_IN'
  | 'AUTH_INVALID_CREDENTIALS'
  | 'ACCOUNT_NOT_ACTIVE'
  | 'EMAIL_ALREADY_EXISTS'
  | 'PHONE_ALREADY_EXISTS'
  | 'USERNAME_ALREADY_EXISTS'
  | 'EMAIL_VERIFICATION_CODE_INVALID'
  | 'EMAIL_VERIFICATION_CODE_EXPIRED'
  | 'EMAIL_VERIFICATION_SEND_TOO_FREQUENT'
  | 'EMAIL_VERIFICATION_SEND_FAILED'
  | 'EMAIL_VERIFICATION_DISABLED'
  | 'EMAIL_VERIFICATION_NOT_CONFIGURED'
  | 'USER_NOT_ACTIVE'
  | 'WORKSPACE_PERMISSION_DENIED'
  | 'WORKSPACE_ROLE_NOT_FOUND'
  | 'WORKSPACE_ROLE_NOT_ACTIVE'
  | 'WORKSPACE_MEMBER_NOT_FOUND'
  | 'WORKSPACE_MEMBER_INACTIVE'
  | 'WORKSPACE_NOT_FOUND'
  | 'WORKSPACE_NOT_ACTIVE'
  | 'INVITATION_EMAIL_MISMATCH'
  | 'INVITATION_ACCEPT_EMAIL_REQUIRED'
  | 'WORKSPACE_INVITATION_ALREADY_ACCEPTED'
  | 'WORKSPACE_INVITATION_CANCELED'
  | 'WORKSPACE_INVITATION_EXPIRED'
  | 'WORKSPACE_INVITATION_LINK_DISABLED'
  | 'WORKSPACE_INVITATION_LINK_EXPIRED'
  | 'GATEWAY_ROUTE_NOT_FOUND'
  | 'GATEWAY_DOWNSTREAM_UNAVAILABLE'
  | 'GATEWAY_INTERNAL_ERROR'
>;

export interface AuthErrorResponseDto {
  timestamp: string;
  status: number;
  error: string;
  code: AuthErrorCode;
  message: string;
  path: string;
}

export interface AuthUserSummaryDto {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  status: AuthUserStatus;
  isFirstLogin: boolean;
  workspaceCount: number;
}

export interface AuthWorkspaceSummaryDto {
  workspaceId: string;
  workspaceCode: string;
  workspaceName: string;
  workspaceStatus: AuthWorkspaceStatus;
  workspaceType: AuthWorkspaceType;
  defaultLocale: string;
  defaultTimezone: string;
  workspaceMemberId: string;
  memberStatus: AuthWorkspaceMemberStatus;
  isDefaultWorkspace: boolean;
}

export interface AuthWorkspaceDictionaryOptionDto {
  code: string;
  label: string;
  description?: string | null;
  sortOrder: number;
  isDefault: boolean;
}

export interface AuthWorkspaceBootstrapOptionsDto {
  workspaceTypes: AuthWorkspaceDictionaryOptionDto[];
  locales: AuthWorkspaceDictionaryOptionDto[];
  timezones: AuthWorkspaceDictionaryOptionDto[];
}

export interface AuthWorkspaceSessionDto {
  workspaceToken: string;
  workspaceTokenName: string;
  workspaceId: string;
  workspaceCode: string;
  workspaceName: string;
  workspaceType: AuthWorkspaceType;
  defaultLocale: string;
  defaultTimezone: string;
  workspaceMemberId: string;
  roleCodes: string[];
}

export interface AuthRequestHeaders {
  platformTokenName?: string | null;
  platformToken?: string | null;
  workspaceTokenName?: string | null;
  workspaceToken?: string | null;
}

export interface AuthSendRegisterEmailCodeRequestDto {
  email: string;
}

export interface AuthSendRegisterEmailCodeResponseDto {
  email: string;
  maskedEmail: string;
  expiresAt: string;
  expireInSeconds: number;
  resendCooldownSeconds: number;
}

export interface AuthRegisterRequestDto {
  username: string;
  displayName: string;
  password: string;
  confirmPassword: string;
  email: string;
  emailVerificationCode: string;
  phone?: string | null;
}

export interface AuthRegisterResponseDto {
  userId: string;
  username: string;
  displayName: string;
  registeredAt: string;
}

export interface AuthPasswordLoginRequestDto {
  identifier: string;
  password: string;
}

export interface AuthLoginResponseDto {
  platformToken: string;
  platformTokenName: string;
  user: AuthUserSummaryDto;
  defaultWorkspace: AuthWorkspaceSummaryDto | null;
  workspaceOptions: AuthWorkspaceSummaryDto[];
  currentWorkspace: AuthWorkspaceSessionDto | null;
}

export interface AuthMeResponseDto {
  user: AuthUserSummaryDto;
  defaultWorkspace: AuthWorkspaceSummaryDto | null;
  workspaceOptions: AuthWorkspaceSummaryDto[];
  currentWorkspace: AuthWorkspaceSessionDto | null;
}

export interface AuthListWorkspacesResponseDto extends Array<AuthWorkspaceSummaryDto> {}

export interface AuthCreateWorkspaceRequestDto {
  workspaceName: string;
  workspaceType: AuthWorkspaceType;
  defaultLocale: string;
  defaultTimezone: string;
  rememberAsDefault?: boolean;
}

export interface AuthWorkspaceInvitationEmailBatchRequestDto {
  workspaceId: string;
  emails: string[];
  targetRoleCode?: string;
  sourceScene?: AuthInvitationSourceScene;
}

export interface AuthWorkspaceInvitationEmailBatchItemDto {
  email: string;
  result: AuthWorkspaceInvitationEmailBatchResult;
  invitationId: string | null;
  message: string | null;
}

export interface AuthWorkspaceInvitationEmailBatchResponseDto {
  workspaceId: string;
  batchId: string;
  successCount: number;
  skippedCount: number;
  results: AuthWorkspaceInvitationEmailBatchItemDto[];
}

export interface AuthWorkspaceInvitationLinkCreateRequestDto {
  workspaceId: string;
  sourceScene?: AuthInvitationSourceScene;
  targetRoleCode?: string;
  expiresInHours?: number;
  maxUseCount?: number;
}

export interface AuthWorkspaceInvitationLinkDto {
  linkId: string;
  workspaceId: string;
  workspaceName: string;
  shareUrl: string;
  sourceScene: AuthInvitationSourceScene;
  targetRoleCode: string | null;
  expiresAt: string | null;
  usedCount: number;
  maxUseCount: number | null;
  status: AuthWorkspaceInvitationLinkStatus;
  createdAt: string;
}

export interface AuthSwitchWorkspaceRequestDto {
  workspaceId: string;
  rememberAsDefault?: boolean;
}

export interface PlatformAuthState {
  platformToken: string | null;
  platformTokenName: string | null;
  user: AuthUserSummaryDto | null;
}

export interface WorkspaceSessionState {
  workspaceToken: string | null;
  workspaceTokenName: string | null;
  workspaceId: string | null;
  workspaceCode: string | null;
  workspaceName: string | null;
  workspaceType: AuthWorkspaceType | null;
  defaultLocale: string | null;
  defaultTimezone: string | null;
  workspaceMemberId: string | null;
  roleCodes: string[];
}

export const createEmptyPlatformAuthState = (): PlatformAuthState => ({
  platformToken: null,
  platformTokenName: null,
  user: null,
});

export const createEmptyWorkspaceSessionState = (): WorkspaceSessionState => ({
  workspaceToken: null,
  workspaceTokenName: null,
  workspaceId: null,
  workspaceCode: null,
  workspaceName: null,
  workspaceType: null,
  defaultLocale: null,
  defaultTimezone: null,
  workspaceMemberId: null,
  roleCodes: [],
});