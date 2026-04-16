'use client';

import React, { useMemo, useState } from 'react';
import {
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
  ArrowRightOutlined,
  BulbFilled,
  LinkOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import InventoryIcon from '@mui/icons-material/Inventory';
import PersonIcon from '@mui/icons-material/Person';
import SchoolIcon from '@mui/icons-material/School';

const { Title, Text } = Typography;

const TOTAL_STEPS = 3;

const LOCALE_OPTIONS = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
];

const TIMEZONE_OPTIONS = [
  { label: 'Asia/Shanghai (UTC+08:00)', value: 'Asia/Shanghai' },
  { label: 'UTC (UTC+00:00)', value: 'UTC' },
  { label: 'America/Los_Angeles (UTC-08:00)', value: 'America/Los_Angeles' },
];

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
  key: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface WorkspaceTypeCardProps {
  option: WorkspaceTypeOption;
  selected: boolean;
  onSelect: (key: string) => void;
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

const WorkspaceCreationOnboarding: React.FC = () => {
  const { token } = theme.useToken();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [setupForm] = Form.useForm<WorkspaceSetupFormValues>();
  const [inviteEmails, setInviteEmails] = useState('');

  const workspaceTypeOptions: WorkspaceTypeOption[] = useMemo(
    () => [
      {
        key: 'team',
        icon: <InventoryIcon style={{ fontSize: 22 }} />,
        title: '团队工作区',
        description: '管理产品数据、项目目标、团队协作。',
      },
      {
        key: 'personal',
        icon: <PersonIcon style={{ fontSize: 22 }} />,
        title: '个人工作区',
        description: '管理个人内容，整理思路与资料。',
      },
      {
        key: 'learning',
        icon: <SchoolIcon style={{ fontSize: 22 }} />,
        title: '学习 / 研究',
        description: '笔记、研究和知识整理。',
      },
    ],
    [],
  );

  const handleTypeSelect = (key: string) => {
    setSelectedType(key);
  };

  const handleStep1Next = () => {
    if (selectedType) {
      setCurrentStep(1);
    }
  };

  const handleStep2Next = () => {
    setupForm.validateFields().then(() => {
      setCurrentStep(2);
    });
  };

  const handleStep3Finish = () => {
    // 暂时不接入接口，仅前端页面操作
    setCurrentStep(2);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

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
        disabled={!selectedType}
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
          defaultLocale: 'zh-CN',
          defaultTimezone: 'Asia/Shanghai',
          rememberAsDefault: true,
        }}
      >
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
            <Select size="large" options={LOCALE_OPTIONS} />
          </Form.Item>

          <Form.Item
            label="默认时区"
            name="defaultTimezone"
            rules={[{ required: true, message: '请选择默认时区' }]}
            style={{ marginBottom: 0 }}
          >
            <Select size="large" options={TIMEZONE_OPTIONS} />
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
      >
        拷贝邀请链接
      </Button>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8 }}>
        <Button size="large" onClick={handleBack}>
          返回
        </Button>
        <Button
          type="primary"
          size="large"
          icon={<ArrowRightOutlined />}
          iconPlacement="end"
          onClick={handleStep3Finish}
        >
          继续
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
        </div>
      </div>
    </div>
  );
};

export default WorkspaceCreationOnboarding;