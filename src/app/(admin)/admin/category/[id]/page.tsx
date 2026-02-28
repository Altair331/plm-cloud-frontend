"use client";

import React, { useState, useEffect } from "react";
import { Splitter, message, Modal, Input } from "antd";
import type { DataNode, TreeProps } from "antd/es/tree";
import CategoryTree from "../AdminCategoryTree";
import {
  metaCategoryApi,
  MetaCategoryBrowseNodeDto,
} from "@/services/metaCategory";
import {
  AppstoreOutlined,
  PartitionOutlined,
  TagsOutlined,
} from "@ant-design/icons";
import { Descriptions } from "antd";
import AttributeDesigner from "../AttributeDesigner";

import { useParams } from "next/navigation";

interface CategoryTreeNode extends Omit<DataNode, "children"> {
  children?: CategoryTreeNode[];
  dataRef?: MetaCategoryBrowseNodeDto;
  level?: "segment" | "family" | "class" | "commodity" | "item";
  loaded?: boolean;
  familyCode?: string;
  classCode?: string; // For Commodity nodes to know their parent Class
  commodityCode?: string;
}

const getChildLevel = (
  level?: CategoryTreeNode["level"],
): CategoryTreeNode["level"] | undefined => {
  if (level === "segment") return "family";
  if (level === "family") return "class";
  if (level === "class") return "commodity";
  if (level === "commodity") return "item";
  return undefined;
};

const getDefaultIconByLevel = (level?: CategoryTreeNode["level"]) => {
  if (level === "segment") return <AppstoreOutlined />;
  if (level === "family" || level === "class" || level === "commodity") {
    return <PartitionOutlined />;
  }
  return <TagsOutlined />;
};

const CategoryManagementPage: React.FC = () => {
  const params = useParams();
  const categoryId = params.id as string;

  const [selectedKey, setSelectedKey] = useState<React.Key>("");
  const [selectedNode, setSelectedNode] = useState<
    CategoryTreeNode | undefined
  >(undefined);
  const [leftCollapsed, setLeftCollapsed] = useState(false);

  const [treeData, setTreeData] = useState<CategoryTreeNode[]>([]);
  const [loadedKeys, setLoadedKeys] = useState<React.Key[]>([]);

  const updateNodeInTree = (
    list: CategoryTreeNode[],
    key: React.Key,
    updater: (node: CategoryTreeNode) => CategoryTreeNode,
  ): CategoryTreeNode[] => {
    return list.map((node) => {
      if (node.key === key) {
        return updater(node);
      }
      if (node.children) {
        return {
          ...node,
          children: updateNodeInTree(node.children, key, updater),
        };
      }
      return node;
    });
  };

  const removeNodeFromTree = (
    list: CategoryTreeNode[],
    key: React.Key,
  ): CategoryTreeNode[] => {
    return list
      .filter((node) => node.key !== key)
      .map((node) => {
        if (!node.children) return node;
        return {
          ...node,
          children: removeNodeFromTree(node.children, key),
        };
      });
  };

  // Initial Load (Segments)
  useEffect(() => {
    loadSegments();
  }, []);

  const loadSegments = async () => {
    try {
      const segments = await metaCategoryApi.listUnspscSegments();
      const nodes: CategoryTreeNode[] = (Array.isArray(segments) ? segments : []).map((s) => ({
        title: `${s.code} - ${s.title}`,
        key: s.key,
        isLeaf: false,
        dataRef: s,
        level: "segment",
        icon: <AppstoreOutlined />,
      }));
      setTreeData(nodes);
      setLoadedKeys([]);
    } catch (error) {
      console.error(error);
      message.error("Failed to load segments");
    }
  };

  const onLoadData = async (node: any): Promise<void> => {
    const { key, children, dataRef, level } = node as CategoryTreeNode;
    if (children && children.length > 0) return;

    try {
      let childNodes: CategoryTreeNode[] = [];

      if (level === "segment") {
        // Load Families
        const families = await metaCategoryApi.listUnspscFamilies(
          dataRef!.code,
        );
        childNodes = families.map((f) => ({
          title: `${f.code} - ${f.title}`,
          key: f.key,
          isLeaf: false,
          dataRef: f,
          level: "family",
          icon: <PartitionOutlined />,
        }));
      } else if (level === "family") {
        // Load Classes
        const groups = await metaCategoryApi.listUnspscClassesWithCommodities(
          dataRef!.code,
        );
        childNodes = groups.map((g) => ({
          title: `${g.clazz.code} - ${g.clazz.title}`,
          key: g.clazz.key,
          isLeaf: !g.commodities || g.commodities.length === 0,
          dataRef: g.clazz,
          level: "class",
          icon: <PartitionOutlined />,
          familyCode: dataRef!.code,
        }));
      } else if (level === "class") {
        // Load Commodities
        // Since listUnspscClassesWithCommodities is by family, we need finding the parent family code
        // Which we passed down as node.familyCode
        const parentFamilyCode = (node as CategoryTreeNode).familyCode;
        if (parentFamilyCode) {
          const groups =
            await metaCategoryApi.listUnspscClassesWithCommodities(
              parentFamilyCode,
            );
          // Find current class group
          const currentClassGroup = groups.find(
            (g) => g.clazz.key === dataRef?.key,
          );
          if (currentClassGroup && currentClassGroup.commodities) {
            childNodes = currentClassGroup.commodities.map((c) => ({
              title: `${c.code} - ${c.title}`,
              key: c.key,
              isLeaf: false,
              dataRef: c,
              level: "commodity",
              icon: <PartitionOutlined />,
              familyCode: parentFamilyCode,
              classCode: dataRef?.code,
            }));
          }
        }
      } else if (level === "commodity") {
        // Load Items under Commodity
        const groups = await metaCategoryApi.listUnspscClassesWithCommodities(
          dataRef!.code,
        );
        childNodes = groups.map((g) => ({
          title: `${g.clazz.code} - ${g.clazz.title}`,
          key: g.clazz.key,
          isLeaf: true,
          dataRef: g.clazz,
          level: "item",
          icon: <TagsOutlined />,
          commodityCode: dataRef!.code,
        }));
      }

      setTreeData((origin) =>
        updateTreeData(origin, key as React.Key, childNodes),
      );
      setLoadedKeys((keys) => [...keys, key as React.Key]);
    } catch (error) {
      console.error(error);
      message.error("Failed to load children");
    }
  };

  const updateTreeData = (
    list: CategoryTreeNode[],
    key: React.Key,
    children: CategoryTreeNode[],
  ): CategoryTreeNode[] => {
    return list.map((node) => {
      if (node.key === key) {
        return { ...node, children };
      }
      if (node.children) {
        return {
          ...node,
          children: updateTreeData(node.children, key, children),
        };
      }
      return node;
    });
  };

  const onSelect: TreeProps["onSelect"] = (keys, info) => {
    if (keys.length > 0) {
      setSelectedKey(keys[0]);
      setSelectedNode(info.node as CategoryTreeNode);
    } else {
      setSelectedKey("");
      setSelectedNode(undefined);
    }
  };

  const handleMenuClick = (key: string, node: CategoryTreeNode) => {
    if (key === "design") {
      setSelectedKey(node.key);
      setSelectedNode(node);
      return;
    }

    if (key === "add") {
      const childLevel = getChildLevel(node.level);
      if (!childLevel) {
        message.warning("当前节点不支持新增子分类");
        return;
      }

      let inputValue = "";
      Modal.confirm({
        title: "新增子分类",
        content: (
          <Input
            placeholder="请输入子分类名称"
            onChange={(e) => {
              inputValue = e.target.value;
            }}
          />
        ),
        okText: "确认",
        cancelText: "取消",
        onOk: () => {
          const trimmed = inputValue.trim();
          if (!trimmed) {
            message.warning("请输入子分类名称");
            return Promise.reject();
          }

          const localCode = `LOCAL_${Date.now()}`;
          const childNode: CategoryTreeNode = {
            key: `local_${childLevel}_${Date.now()}`,
            title: `${localCode} - ${trimmed}`,
            dataRef: {
              key: `local_${childLevel}_${Date.now()}`,
              code: localCode,
              title: trimmed,
              hasChildren: childLevel !== "commodity" && childLevel !== "item",
              depth: (node.dataRef?.depth ?? 0) + 1,
            },
            level: childLevel,
            isLeaf: childLevel === "commodity" || childLevel === "item",
            icon: getDefaultIconByLevel(childLevel),
          };

          setTreeData((origin) =>
            updateNodeInTree(origin, node.key, (targetNode) => ({
              ...targetNode,
              isLeaf: false,
              children: [...(targetNode.children ?? []), childNode],
            })),
          );

          setLoadedKeys((keys) =>
            keys.includes(node.key) ? keys : [...keys, node.key],
          );
          message.success("子分类已新增");
          return Promise.resolve();
        },
      });
      return;
    }

    if (key === "rename") {
      let inputValue = node.dataRef?.title ?? "";
      Modal.confirm({
        title: "重命名分类",
        content: (
          <Input
            defaultValue={inputValue}
            placeholder="请输入新的分类名称"
            onChange={(e) => {
              inputValue = e.target.value;
            }}
          />
        ),
        okText: "确认",
        cancelText: "取消",
        onOk: () => {
          const trimmed = inputValue.trim();
          if (!trimmed) {
            message.warning("分类名称不能为空");
            return Promise.reject();
          }

          setTreeData((origin) =>
            updateNodeInTree(origin, node.key, (targetNode) => {
              const code = targetNode.dataRef?.code || "LOCAL";
              return {
                ...targetNode,
                title: `${code} - ${trimmed}`,
                dataRef: targetNode.dataRef
                  ? { ...targetNode.dataRef, title: trimmed }
                  : targetNode.dataRef,
              };
            }),
          );

          if (selectedKey === node.key && selectedNode) {
            setSelectedNode((prev) =>
              prev
                ? {
                    ...prev,
                    title: `${prev.dataRef?.code || "LOCAL"} - ${trimmed}`,
                    dataRef: prev.dataRef
                      ? { ...prev.dataRef, title: trimmed }
                      : prev.dataRef,
                  }
                : prev,
            );
          }
          message.success("重命名成功");
          return Promise.resolve();
        },
      });
      return;
    }

    if (key === "delete") {
      Modal.confirm({
        title: "确认删除",
        content: "删除后不可恢复，是否继续？",
        okType: "danger",
        okText: "删除",
        cancelText: "取消",
        onOk: () => {
          setTreeData((origin) => removeNodeFromTree(origin, node.key));
          if (selectedKey === node.key) {
            setSelectedKey("");
            setSelectedNode(undefined);
          }
          message.success("分类已删除");
        },
      });
    }
  };

  if (categoryId !== "2") {
    return (
      <div
        style={{
          height: "calc(100vh - 163px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--ant-color-bg-container, #fff)",
          borderRadius: 8,
          border: "1px solid var(--ant-color-border-secondary, #f0f0f0)",
        }}
      >
        <div style={{ color: "#999", fontSize: 16 }}>
          该分类下的数据能力建设功能正在开发中...
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "calc(100vh - 163px)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        overflow: "hidden",
      }}
    >
      <Splitter
        onCollapse={(collapsed) => setLeftCollapsed(collapsed[0] ?? false)}
        style={{
          flex: 1,
          minHeight: 0,
          background: "var(--ant-color-bg-container, #fff)",
          borderRadius: 8,
          border: "1px solid var(--ant-color-border-secondary, #f0f0f0)",
          boxShadow: "0 0 10px rgba(0, 0, 0, 0.05)",
          overflow: "hidden",
        }}
      >
        <Splitter.Panel
          defaultSize={450}
          min={350}
          max={600}
          collapsible={{
            end: true,
            showCollapsibleIcon: leftCollapsed ? true : "auto",
          }}
        >
          <CategoryTree
            onSelect={onSelect}
            treeData={treeData}
            loadData={onLoadData}
            loadedKeys={loadedKeys}
            onLoad={(keys) => setLoadedKeys(keys as React.Key[])}
            onMenuClick={handleMenuClick}
          />
        </Splitter.Panel>
        <Splitter.Panel>
          {selectedNode ? (
            <AttributeDesigner currentNode={selectedNode.dataRef} />
          ) : (
            <div
              style={{
                height: "100%",
                padding: "16px",
                color: "#999",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              请选择左侧分类节点
            </div>
          )}
        </Splitter.Panel>
      </Splitter>
    </div>
  );
};

export default CategoryManagementPage;
