import React from 'react';
import { Button, Space, Typography, theme } from 'antd';
import { RedoOutlined, SwapRightOutlined, UndoOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface ActionFooterProps {
  pendingAction: 'move' | 'copy' | null;
  onConfirm: (actionType: 'move' | 'copy') => void;
  onCancel: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  currentStep: number;
  totalSteps: number;
  loading?: boolean;
}

export default function ActionFooter({
  pendingAction,
  onConfirm,
  onCancel,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  currentStep,
  totalSteps,
  loading = false
}: ActionFooterProps) {
  const { token } = theme.useToken();
  const stepLabel = `步骤 ${currentStep} / ${Math.max(totalSteps, 0)}`;

  return (
    <div
      style={{
        padding: '12px 24px',
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          minWidth: 0,
          flex: '1 1 320px',
          flexWrap: 'wrap',
        }}
      >
        {pendingAction ? (
          <Text type="secondary">
            当前处于 <Text strong style={{ color: pendingAction === 'copy' ? token.colorSuccess : token.colorPrimary }}>{pendingAction === 'copy' ? '复制' : '移动'}</Text> 待命状态，请确认。
          </Text>
        ) : (
          <Text type="secondary">等待拖拽操作...</Text>
        )}
        <Text type="secondary">
          {stepLabel}
        </Text>
      </div>

      <Space wrap style={{ justifyContent: 'flex-end', flex: '0 1 auto', rowGap: 8 }}>
        <Button onClick={onUndo} disabled={loading || !canUndo} icon={<UndoOutlined />}>
          撤销
        </Button>
        <Button onClick={onRedo} disabled={loading || !canRedo} icon={<RedoOutlined />}>
          重做
        </Button>
        {pendingAction && (
          <Button onClick={onCancel} disabled={loading}>
            取消
          </Button>
        )}
        
        {/* 复制操作使用安全感更强的绿色 (Success color) */}
        <Button
          style={{
            backgroundColor: pendingAction === 'copy' ? token.colorSuccess : undefined,
            color: pendingAction === 'copy' ? '#fff' : undefined,
            borderColor: pendingAction === 'copy' ? token.colorSuccess : undefined,
          }}
          type={pendingAction === 'move' ? 'primary' : 'default'}
          disabled={!pendingAction}
          loading={loading}
          icon={<SwapRightOutlined />}
          onClick={() => {
            if (pendingAction) onConfirm(pendingAction);
          }}
        >
          {pendingAction === 'move' ? '确认移动' : pendingAction === 'copy' ? '确认复制' : '确认操作'}
        </Button>
      </Space>
    </div>
  );
}
