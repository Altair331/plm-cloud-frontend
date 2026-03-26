'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Splitter, theme, Flex, Empty, App } from 'antd';
import type { CodeRule } from './components/types';
import { mockRules, createDefaultRule } from './components/types';
import CodeRuleList from './components/CodeRuleList';
import CodeRuleWorkspace from './components/CodeRuleWorkspace';

export default function CodeSettingPage() {
  const { token } = theme.useToken();
  const { modal } = App.useApp();
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rules, setRules] = useState<CodeRule[]>(mockRules);
  const [activeRuleId, setActiveRuleId] = useState<string | null>(mockRules[0]?.id || null);

  const activeRule = useMemo(() => rules.find(r => r.id === activeRuleId), [rules, activeRuleId]);

  const handleAddRule = useCallback(() => {
    const newRule = createDefaultRule();
    setRules(prev => [newRule, ...prev]);
    setActiveRuleId(newRule.id);
  }, []);

  const handleSaveRule = useCallback((updatedRule: CodeRule) => {
    setRules(prev => prev.map(r => r.id === updatedRule.id ? updatedRule : r));
  }, []);

  const handleBatchDelete = useCallback((ids: React.Key[]) => {
    modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${ids.length} 条编码规则吗？此操作不可恢复。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        setRules(prev => prev.filter(r => !ids.includes(r.id)));
        if (activeRuleId && ids.includes(activeRuleId)) {
          setActiveRuleId(null);
        }
      },
    });
  }, [activeRuleId, modal]);

  return (
    <div style={{
      height: "calc(100vh - 163px)",
      display: "flex",
      flexDirection: "column",
      gap: 16,
      overflow: "hidden",
    }}>
      <Splitter
        onCollapse={(collapsed) => setLeftCollapsed(collapsed[0] ?? false)}
        style={{
          flex: 1,
          minHeight: 0,
          background: "var(--ant-color-bg-container, #fff)",
          borderRadius: 8,
          border: `1px solid ${token.colorBorderSecondary}`,
          boxShadow: "0 0 10px rgba(0, 0, 0, 0.05)",
          overflow: "hidden",
        }}
      >
        <Splitter.Panel
          defaultSize={450}
          min={350}
          max={550}
          collapsible={{ end: true, showCollapsibleIcon: leftCollapsed ? true : "auto" }}
        >
          <CodeRuleList
            rules={rules}
            activeId={activeRuleId}
            onSelect={setActiveRuleId}
            onAdd={handleAddRule}
            onBatchDelete={handleBatchDelete}
          />
        </Splitter.Panel>

        <Splitter.Panel>
          <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>
            {activeRule ? (
              <CodeRuleWorkspace rule={activeRule} onSave={handleSaveRule} />
            ) : (
              <Flex justify="center" align="center" style={{ height: "100%", background: token.colorBgLayout }}>
                <Empty description="请在左侧选择一个规则进行设计" />
              </Flex>
            )}
          </div>
        </Splitter.Panel>
      </Splitter>
    </div>
  );
}
