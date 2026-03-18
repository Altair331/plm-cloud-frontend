import React from 'react';
import { Tree, theme } from 'antd';
import type { TreeDataNode } from 'antd';
import { FolderOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { useDraggable } from '@dnd-kit/core';
import type { TransferTreeNode } from './TransferWorkspace';
import { getTransferNodeLabelStyle } from './transferNodeStyles';

interface DraggableSourceTreeProps {
  treeData: TransferTreeNode[];
  expandedKeys: React.Key[];
  onExpand: (expandedKeys: React.Key[]) => void;
  onMovedNodeHover?: (key: React.Key | null) => void;
}

// 封装自定义的可拖拽节点 Title
const SourceNodeTitle = ({
  nodeData,
  token,
  onMovedNodeHover,
}: {
  nodeData: any;
  token: any;
  onMovedNodeHover?: (key: React.Key | null) => void;
}) => {
  const { isContextOnly, isMovedSource } = nodeData;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `src-${nodeData.key}`,
    data: nodeData,
    disabled: isContextOnly || isMovedSource
  });

  return (
    <span
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onMouseEnter={() => {
        if (isMovedSource) {
          onMovedNodeHover?.(nodeData.key);
        }
      }}
      onMouseLeave={() => {
        if (isMovedSource) {
          onMovedNodeHover?.(null);
        }
      }}
      style={{
        ...getTransferNodeLabelStyle(token, {
          disabled: isContextOnly || isMovedSource,
          dragging: isDragging,
        }),
        color: isMovedSource ? token.colorTextSecondary : undefined,
        opacity: isMovedSource && !isDragging ? 0.72 : undefined,
      }}
    >
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textDecoration: isMovedSource ? 'line-through' : 'none',
          textDecorationThickness: isMovedSource ? 1.5 : undefined,
        }}
      >
        {nodeData.title}
      </span>
      {isMovedSource && (
        <span
          style={{
            marginLeft: 8,
            fontSize: 12,
            color: token.colorSuccess,
            background: token.colorSuccessBg,
            border: `1px solid ${token.colorSuccessBorder}`,
            borderRadius: 999,
            padding: '1px 6px',
            lineHeight: '18px',
            flexShrink: 0,
          }}
        >
          已移动
        </span>
      )}
    </span>
  );
};

export default function DraggableSourceTree({
  treeData,
  expandedKeys,
  onExpand,
  onMovedNodeHover,
}: DraggableSourceTreeProps) {
  const { token } = theme.useToken();

  const titleRender = (nodeData: any) => {
    return <SourceNodeTitle nodeData={nodeData} token={token} onMovedNodeHover={onMovedNodeHover} />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ flex: '1 1 0', minHeight: 0, overflow: 'auto' }}>
        <Tree
          className="draggable-source-tree dnd-transfer-tree"
          treeData={treeData as TreeDataNode[]}
          expandedKeys={expandedKeys}
          autoExpandParent
          onExpand={onExpand}
          titleRender={titleRender}
          showIcon
          icon={(nodeProps: any) => 
            nodeProps.expanded ? <FolderOpenOutlined /> : <FolderOutlined />
          }
          blockNode
          selectable={false}
        />
      </div>
    </div>
  );
}
