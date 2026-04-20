'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Checkbox,
  Form,
  Input,
  Select,
  Space,
  Typography,
  theme,
} from 'antd';
import {
  ApartmentOutlined,
  ArrowRightOutlined,
  BulbFilled,
  LinkOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import InventoryIcon from '@mui/icons-material/Inventory';
import PersonIcon from '@mui/icons-material/Person';
import SchoolIcon from '@mui/icons-material/School';
import { useRouter } from 'next/navigation';
import { authApi, isAuthErrorResponse } from '@/services/auth';
import type {
  AuthWorkspaceInvitationEmailBatchResponseDto,
  AuthWorkspaceInvitationLinkDto,
  AuthWorkspaceBootstrapOptionsDto,
  AuthWorkspaceDictionaryOptionDto,
  AuthWorkspaceSessionDto,
  AuthWorkspaceType,
} from '@/models/auth';
import {
  mapWorkspaceSessionDtoToState,
  persistPlatformAuthState,
  persistWorkspaceSessionState,
  readPersistedAuthHeaders,
  readPersistedAuthSnapshot,
} from '@/utils/authStorage';

const { Title, Text } = Typography;

const TOTAL_STEPS = 3;

/* ───────── Step Progress Bar ───────── */

interface StepProgressBarProps {
  current: number;
  total: number;
}

const StepProgressBar: React.FC<StepProgressBarProps> = ({ current, total }) => {
  const { token } = theme.useToken();

  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        width: 120,
        height: 4,
      }}
    >
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: '100%',
            borderRadius: 2,
            background: i <= current ? token.colorPrimary : token.colorFillQuaternary,
            transition: 'background 0.3s ease',
          }}
        />
      ))}
    </div>
  );
};

/* ───────── Workspace Type Options (Step 1) ───────── */

interface WorkspaceTypeOption {
  key: AuthWorkspaceType;
  icon: React.ReactNode;
  title: string;
  description: string;
}

const getWorkspaceTypeIcon = (workspaceType: string): React.ReactNode => {
  switch (workspaceType) {
    case 'TEAM':
      return <InventoryIcon style={{ fontSize: 22 }} />;
    case 'PERSONAL':
      return <PersonIcon style={{ fontSize: 22 }} />;
    case 'LEARNING':
      return <SchoolIcon style={{ fontSize: 22 }} />;
    default:
      return <ApartmentOutlined style={{ fontSize: 22 }} />;
  }
};

interface WorkspaceTypeCardProps {
  option: WorkspaceTypeOption;
  selected: boolean;
  onSelect: (key: AuthWorkspaceType) => void;
}

const WorkspaceTypeCard: React.FC<WorkspaceTypeCardProps> = ({ option, selected, onSelect }) => {
  const { token } = theme.useToken();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(option.key)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(option.key);
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '16px 20px',
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${selected ? token.colorPrimary : token.colorBorderSecondary}`,
        background: selected ? token.colorPrimaryBg : token.colorBgContainer,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: token.borderRadiusLG,
          background: token.colorFillAlter,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          color: token.colorTextSecondary,
          flex: '0 0 auto',
        }}
      >
        {option.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text strong style={{ display: 'block', color: token.colorText }}>
          {option.title}
        </Text>
        <Text style={{ color: token.colorTextTertiary, fontSize: 13 }}>
          {option.description}
        </Text>
      </div>
    </div>
  );
};

/* ───────── Main Component ───────── */

interface WorkspaceSetupFormValues {
  workspaceName: string;
  defaultLocale: string;
  defaultTimezone: string;
  rememberAsDefault: boolean;
}

const parseInviteEmails = (rawValue: string): string[] => {
  return rawValue
    .split(/[\s,;，；]+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const buildInviteResultMessage = (response: AuthWorkspaceInvitationEmailBatchResponseDto): string => {
  if (response.successCount > 0 && response.skippedCount > 0) {
    return `工作区已创建，成功发送 ${response.successCount} 条邀请，另有 ${response.skippedCount} 条被跳过。`;
  }

  if (response.successCount > 0) {
    return `工作区已创建，已发送 ${response.successCount} 条邀请。`;
  }

  if (response.skippedCount > 0) {
    return `工作区已创建，但本次邀请全部被跳过，请检查邮箱结果。`;
  }

  return '工作区已创建。';
};

const WorkspaceCreationOnboarding: React.FC = () => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedType, setSelectedType] = useState<AuthWorkspaceType | null>(null);
  const [workspaceSetup, setWorkspaceSetup] = useState<WorkspaceSetupFormValues | null>(null);
  const [bootstrapOptions, setBootstrapOptions] = useState<AuthWorkspaceBootstrapOptionsDto | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [copyingInviteLink, setCopyingInviteLink] = useState(false);
  const [createdWorkspaceSession, setCreatedWorkspaceSession] = useState<AuthWorkspaceSessionDto | null>(null);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<AuthWorkspaceInvitationLinkDto | null>(null);
  const [setupForm] = Form.useForm<WorkspaceSetupFormValues>();
  const [inviteEmails, setInviteEmails] = useState('');

  useEffect(() => {
    let active = true;

    const persistedHeaders = readPersistedAuthHeaders();
    if (!persistedHeaders.platformToken || !persistedHeaders.platformTokenName) {
      message.error('请先登录后再创建工作区。');
      router.replace('/login');
      return () => {
        active = false;
      };
    }

    authApi.getMe(persistedHeaders)
      .then((session) => {
        if (!active) {
          return;
        }

        const currentSnapshot = readPersistedAuthSnapshot();
        persistPlatformAuthState({
          ...currentSnapshot.platformAuth,
          user: session.user,
          admin: null,
          principalType: 'user',
        });

        if (session.currentWorkspace) {
          persistWorkspaceSessionState(mapWorkspaceSessionDtoToState(session.currentWorkspace));
        }

        return authApi.getWorkspaceBootstrapOptions();
      })
      .then((response) => {
        if (!response || !active) {
          return;
        }

        setBootstrapOptions(response);

        const defaultType = response.workspaceTypes.find((item) => item.isDefault)?.code as AuthWorkspaceType | undefined;
        const defaultLocale = response.locales.find((item) => item.isDefault)?.code ?? response.locales[0]?.code;
        const defaultTimezone = response.timezones.find((item) => item.isDefault)?.code ?? response.timezones[0]?.code;

        if (defaultType) {
          setSelectedType(defaultType);
        }

        setupForm.setFieldsValue({
          defaultLocale,
          defaultTimezone,
          rememberAsDefault: true,
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        if (isAuthErrorResponse(error)) {
          if (error.code === 'AUTH_NOT_LOGGED_IN') {
            message.error('登录态已失效，请重新登录。');
            router.replace('/login');
            return;
          }

          message.error(error.message || '工作区引导选项加载失败，请稍后重试。');
          return;
        }

        message.error('工作区引导选项加载失败，请稍后重试。');
      })
      .finally(() => {
        if (active) {
          setOptionsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [router, setupForm]);

  const workspaceTypeOptions: WorkspaceTypeOption[] = useMemo(
    () => [...(bootstrapOptions?.workspaceTypes ?? [])]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((option) => ({
        key: option.code as AuthWorkspaceType,
        icon: getWorkspaceTypeIcon(option.code),
        title: option.label,
        description: option.description ?? '',
      })),
    [bootstrapOptions],
  );

  const localeOptions = useMemo(
    () => [...(bootstrapOptions?.locales ?? [])]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((option: AuthWorkspaceDictionaryOptionDto) => ({
        label: option.label,
        value: option.code,
      })),
    [bootstrapOptions],
  );

  const timezoneOptions = useMemo(
    () => [...(bootstrapOptions?.timezones ?? [])]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((option: AuthWorkspaceDictionaryOptionDto) => ({
        label: option.label,
        value: option.code,
      })),
    [bootstrapOptions],
  );

  const handleTypeSelect = (key: AuthWorkspaceType) => {
    setSelectedType(key);
  };

  const handleStep1Next = () => {
    if (selectedType) {
      setCurrentStep(1);
    }
  };

  const handleStep2Next = () => {
    setupForm.validateFields().then((values) => {
      setWorkspaceSetup(values);
      setCurrentStep(2);
    });
  };

  const syncPlatformUserSnapshot = async (workspaceSession: AuthWorkspaceSessionDto, persistedHeaders: ReturnType<typeof readPersistedAuthHeaders>) => {
    const meHeaders = {
      ...persistedHeaders,
      workspaceToken: workspaceSession.workspaceToken,
      workspaceTokenName: workspaceSession.workspaceTokenName,
    };

    try {
      const me = await authApi.getMe(meHeaders);
      const currentSnapshot = readPersistedAuthSnapshot();
      persistPlatformAuthState({
        ...currentSnapshot.platformAuth,
        user: me.user,
        admin: null,
        principalType: 'user',
      });
    } catch {
      const currentSnapshot = readPersistedAuthSnapshot();
      if (currentSnapshot.platformAuth.user) {
        persistPlatformAuthState({
          ...currentSnapshot.platformAuth,
          user: {
            ...currentSnapshot.platformAuth.user,
            isFirstLogin: false,
            workspaceCount: Math.max(1, currentSnapshot.platformAuth.user.workspaceCount),
          },
          admin: null,
          principalType: 'user',
        });
      }
    }
  };

  const ensureWorkspaceCreated = async (): Promise<AuthWorkspaceSessionDto> => {
    if (createdWorkspaceSession) {
      return createdWorkspaceSession;
    }

    if (!selectedType) {
      message.error('请先选择工作区类型。');
      setCurrentStep(0);
      throw new Error('WORKSPACE_TYPE_REQUIRED');
    }

    const persistedHeaders = readPersistedAuthHeaders();
    if (!persistedHeaders.platformToken || !persistedHeaders.platformTokenName) {
      message.error('登录态已失效，请重新登录。');
      router.replace('/login');
      throw new Error('AUTH_REQUIRED');
    }

    if (!workspaceSetup) {
      message.error('请先完成工作区基本信息配置。');
      setCurrentStep(1);
      throw new Error('WORKSPACE_SETUP_REQUIRED');
    }

    const workspaceSession = await authApi.createWorkspace(
      {
        workspaceName: workspaceSetup.workspaceName.trim(),
        workspaceType: selectedType,
        defaultLocale: workspaceSetup.defaultLocale,
        defaultTimezone: workspaceSetup.defaultTimezone,
        rememberAsDefault: workspaceSetup.rememberAsDefault,
      },
      persistedHeaders,
    );

    setCreatedWorkspaceSession(workspaceSession);
    persistWorkspaceSessionState(mapWorkspaceSessionDtoToState(workspaceSession));
    await syncPlatformUserSnapshot(workspaceSession, persistedHeaders);

    return workspaceSession;
  };

  const handleCopyInviteLink = async () => {
    setCopyingInviteLink(true);

    try {
      const workspaceSession = await ensureWorkspaceCreated();
      const persistedHeaders = readPersistedAuthHeaders();

      const inviteLink = await authApi.createWorkspaceInvitationLink(
        {
          workspaceId: workspaceSession.workspaceId,
          sourceScene: 'ONBOARDING',
        },
        persistedHeaders,
      );

      setGeneratedInviteLink(inviteLink);

      try {
        await navigator.clipboard.writeText(inviteLink.shareUrl);
        message.success('邀请链接已复制到剪贴板。');
      } catch {
        message.success(`邀请链接已生成：${inviteLink.shareUrl}`);
      }
    } catch (error) {
      if (isAuthErrorResponse(error)) {
        if (error.code === 'AUTH_NOT_LOGGED_IN') {
          message.error('登录态已失效，请重新登录。');
          router.replace('/login');
          return;
        }

        message.error(error.message || '邀请链接生成失败，请稍后重试。');
        return;
      }

      if (error instanceof Error && (
        error.message === 'WORKSPACE_TYPE_REQUIRED'
        || error.message === 'AUTH_REQUIRED'
        || error.message === 'WORKSPACE_SETUP_REQUIRED'
      )) {
        return;
      }

      message.error('邀请链接生成失败，请稍后重试。');
    } finally {
      setCopyingInviteLink(false);
    }
  };

  const handleStep3Finish = async () => {
    setCreatingWorkspace(true);

    try {
      const workspaceSession = await ensureWorkspaceCreated();
      const inviteEmailList = parseInviteEmails(inviteEmails);

      if (inviteEmailList.length > 0) {
        const persistedHeaders = readPersistedAuthHeaders();
        const inviteResult = await authApi.inviteWorkspaceMembersByEmail(
          {
            workspaceId: workspaceSession.workspaceId,
            emails: inviteEmailList,
            sourceScene: 'ONBOARDING',
          },
          persistedHeaders,
        );

        if (inviteResult.successCount > 0) {
          message.success(buildInviteResultMessage(inviteResult));
        } else if (inviteResult.skippedCount > 0) {
          message.warning(buildInviteResultMessage(inviteResult));
        } else {
          message.success('工作区创建成功。');
        }
      } else {
        message.success(generatedInviteLink ? '工作区已创建，邀请链接可直接分享。' : '工作区创建成功。');
      }

      router.push('/dashboard');
    } catch (error) {
      if (isAuthErrorResponse(error)) {
        if (error.code === 'AUTH_NOT_LOGGED_IN') {
          message.error('登录态已失效，请重新登录。');
          router.replace('/login');
          return;
        }

        message.error(error.message || '工作区创建或邀请发送失败，请稍后重试。');
        return;
      }

      if (error instanceof Error && (
        error.message === 'WORKSPACE_TYPE_REQUIRED'
        || error.message === 'AUTH_REQUIRED'
        || error.message === 'WORKSPACE_SETUP_REQUIRED'
      )) {
        return;
      }

      message.error('工作区创建或邀请发送失败，请稍后重试。');
    } finally {
      setCreatingWorkspace(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderWorkspaceSetupFields = () => (
    <>
      <Form.Item
        label="工作区名称"
        name="workspaceName"
        rules={[{ required: true, message: '请输入工作区名称' }]}
      >
        <Input
          size="large"
          maxLength={40}
          placeholder="例如：MI SAKA 的工作区"
        />
      </Form.Item>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        <Form.Item
          label="默认语言"
          name="defaultLocale"
          rules={[{ required: true, message: '请选择默认语言' }]}
          style={{ marginBottom: 0 }}
        >
          <Select size="large" options={localeOptions} loading={optionsLoading} />
        </Form.Item>

        <Form.Item
          label="默认时区"
          name="defaultTimezone"
          rules={[{ required: true, message: '请选择默认时区' }]}
          style={{ marginBottom: 0 }}
        >
          <Select size="large" options={timezoneOptions} loading={optionsLoading} />
        </Form.Item>
      </div>

      <Form.Item
        name="rememberAsDefault"
        valuePropName="checked"
        style={{ marginTop: 20, marginBottom: 0 }}
      >
        <Checkbox>
          <Space orientation="vertical" size={2} style={{ width: '100%' }}>
            <Text style={{ color: token.colorText }}>设为默认工作区</Text>
            <Text style={{ color: token.colorTextTertiary, fontSize: 12 }}>
              后续登录后优先进入该工作区
            </Text>
          </Space>
        </Checkbox>
      </Form.Item>
    </>
  );

  /* ───────── Step 1: Choose workspace type ───────── */
  const renderStep1 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <Title level={3} style={{ margin: 0, color: token.colorText }}>
          你想如何使用工作区？
        </Title>
        <Text style={{ color: token.colorTextSecondary, marginTop: 6, display: 'block' }}>
          助力定制你的体验
        </Text>
      </div>

      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        {workspaceTypeOptions.map((opt) => (
          <WorkspaceTypeCard
            key={opt.key}
            option={opt}
            selected={selectedType === opt.key}
            onSelect={handleTypeSelect}
          />
        ))}
      </Space>

      <Button
        type="primary"
        size="large"
        block
        disabled={!selectedType || optionsLoading || workspaceTypeOptions.length === 0}
        icon={<ArrowRightOutlined />}
        iconPlacement="end"
        onClick={handleStep1Next}
        style={{ marginTop: 8 }}
      >
        继续
      </Button>
    </div>
  );

  /* ───────── Step 2: Workspace name / language / timezone ───────── */
  const renderStep2 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <Title level={3} style={{ margin: 0, color: token.colorText }}>
          设置你的工作区
        </Title>
        <Text style={{ color: token.colorTextSecondary, marginTop: 6, display: 'block' }}>
          为你的团队配置基本信息
        </Text>
      </div>

      <Form<WorkspaceSetupFormValues>
        form={setupForm}
        layout="vertical"
        initialValues={{
          workspaceName: '',
          rememberAsDefault: true,
        }}
      >
        {renderWorkspaceSetupFields()}
      </Form>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8 }}>
        <Button size="large" onClick={handleBack}>
          返回
        </Button>
        <Button
          type="primary"
          size="large"
          icon={<ArrowRightOutlined />}
          iconPlacement="end"
          onClick={handleStep2Next}
        >
          继续
        </Button>
      </div>
    </div>
  );

  /* ───────── Step 3: Invite members ───────── */
  const renderStep3 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <Title level={3} style={{ margin: 0, color: token.colorText }}>
          你的团队中还有谁？
        </Title>
        <Text style={{ color: token.colorTextSecondary, marginTop: 6, display: 'block' }}>
          通过邮件添加团队成员
        </Text>
      </div>

      <div>
        <Text style={{ display: 'block', marginBottom: 8, color: token.colorText }}>
          邀请你的团队
        </Text>
        <Input.TextArea
          rows={5}
          value={inviteEmails}
          onChange={(e) => setInviteEmails(e.target.value)}
          placeholder="annie@myteam.com, fay@company.com, henry@company.com, ..."
          style={{
            resize: 'none',
            borderRadius: token.borderRadiusLG,
          }}
        />
      </div>

      <Button
        type="link"
        icon={<LinkOutlined />}
        style={{ paddingInline: 0, alignSelf: 'flex-start', color: token.colorPrimary }}
        loading={copyingInviteLink}
        onClick={() => void handleCopyInviteLink()}
      >
        拷贝邀请链接
      </Button>

      {generatedInviteLink ? (
        <Text style={{ color: token.colorTextTertiary, fontSize: 12 }}>
          当前邀请链接已生成，可直接分享给团队成员。
        </Text>
      ) : null}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8 }}>
        <Button size="large" onClick={handleBack}>
          返回
        </Button>
        <Button
          type="primary"
          size="large"
          icon={<ArrowRightOutlined />}
          iconPlacement="end"
          loading={creatingWorkspace}
          onClick={handleStep3Finish}
        >
          {createdWorkspaceSession ? '完成并进入工作区' : '创建工作区'}
        </Button>
      </div>
    </div>
  );

  /* ───────── Step icon mapping ───────── */
  const stepIcons: Record<number, React.ReactNode> = {
    0: <BulbFilled style={{ fontSize: 48, color: token.colorWarning }} />,
    1: <BulbFilled style={{ fontSize: 48, color: token.colorWarning }} />,
    2: <TeamOutlined style={{ fontSize: 48, color: token.colorPrimary }} />,
  };

  const stepRenderers: Record<number, () => React.ReactNode> = {
    0: renderStep1,
    1: renderStep2,
    2: renderStep3,
  };

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: token.borderRadiusLG + 8,
        overflow: 'hidden',
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      {/* 内容区 */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 480,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
          }}
        >
          {/* 图标 + 进度条 */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              bottom: '100%',
              marginBottom: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              alignItems: 'flex-start',
              pointerEvents: 'none',
            }}
          >
            {stepIcons[currentStep]}
            <StepProgressBar current={currentStep} total={TOTAL_STEPS} />
          </div>

          {/* 当前步骤内容 */}
          <div style={{ width: '100%' }}>
            {stepRenderers[currentStep]()}
          </div>

          {currentStep !== 1 ? (
            <div style={{ display: 'none' }} aria-hidden>
              <Form<WorkspaceSetupFormValues>
                form={setupForm}
                layout="vertical"
                initialValues={{
                  workspaceName: '',
                  rememberAsDefault: true,
                }}
              >
                {renderWorkspaceSetupFields()}
              </Form>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default WorkspaceCreationOnboarding;