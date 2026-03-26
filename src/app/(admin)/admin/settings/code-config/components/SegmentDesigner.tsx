'use client';

import React, { useMemo } from 'react';
import { Flex, Typography, Button, theme } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { CodeSegment, SegmentType, SubRuleConfig } from './types';
import { generateSubRulePreview } from './types';
import SegmentCard from './SegmentCard';

const { Text } = Typography;

interface SegmentDesignerProps {
  config: SubRuleConfig;
  /** 可选区域标题（如"根节点编码规则"、"子级派生规则"） */
  title?: string;
  /** 覆盖预览文本（用于层级继承模式下的组合预览） */
  previewOverride?: string;
  onAddSegment: (type: SegmentType) => void;
  onRemoveSegment: (id: string) => void;
  onUpdateSegment: (id: string, updates: Partial<CodeSegment>) => void;
  onMoveSegment: (id: string, direction: 'up' | 'down') => void;
}

const SegmentDesigner: React.FC<SegmentDesignerProps> = ({
  config,
  title,
  previewOverride,
  onAddSegment,
  onRemoveSegment,
  onUpdateSegment,
  onMoveSegment,
}) => {
  const { token } = theme.useToken();
  const rawPreview = useMemo(() => generateSubRulePreview(config), [config]);
  const preview = previewOverride ?? rawPreview;

  return (
    <>
      {/* 区域标题 */}
      {title && (
        <Flex
          align="center"
          style={{
            padding: '8px 16px',
            background: token.colorFillQuaternary,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Text strong style={{ fontSize: 13, color: token.colorTextSecondary }}>{title}</Text>
        </Flex>
      )}

      {/* 编码预览条 */}
      <div
        style={{
          padding: '10px 16px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorInfoBg,
        }}
      >
        <Flex align="center" gap={8}>
          <Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>编码示例</Text>
          <Text
            strong
            style={{
              fontSize: 15,
              fontFamily: 'monospace',
              color: token.colorPrimary,
              letterSpacing: 0.5,
            }}
          >
            {preview}
          </Text>
        </Flex>
      </div>

      {/* 编码段列表 */}
      <div style={{ padding: 16 }}>
        <Flex vertical gap={12}>
          {config.segments.map((segment, idx) => (
            <SegmentCard
              key={segment.id}
              segment={segment}
              index={idx}
              total={config.segments.length}
              onChange={onUpdateSegment}
              onRemove={onRemoveSegment}
              onMoveUp={(id) => onMoveSegment(id, 'up')}
              onMoveDown={(id) => onMoveSegment(id, 'down')}
            />
          ))}

          {config.segments.length === 0 && (
            <Flex
              justify="center"
              align="center"
              style={{
                padding: 32,
                border: `1px dashed ${token.colorBorderSecondary}`,
                borderRadius: token.borderRadiusLG,
              }}
            >
              <Text type="secondary">暂无编码段，请点击「新增片段」添加</Text>
            </Flex>
          )}
        </Flex>

        {/* 底部新增按钮 */}
        <Flex justify="center" style={{ marginTop: 12 }}>
          <Button
            size="small"
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => onAddSegment('STRING')}
          >
            新增片段
          </Button>
        </Flex>
      </div>
    </>
  );
};

export default SegmentDesigner;
