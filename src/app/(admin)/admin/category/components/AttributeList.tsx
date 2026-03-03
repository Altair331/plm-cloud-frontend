import React, { useState, useEffect, useRef } from "react";
import {
  SearchOutlined,
  MoreOutlined,
  NumberOutlined,
  FontColorsOutlined,
  CalendarOutlined,
  UnorderedListOutlined,
  CheckSquareOutlined,
  DeleteOutlined,
  CopyOutlined,
} from "@ant-design/icons";
import {
  List,
  Input,
  Button,
  Dropdown,
  MenuProps,
  Typography,
  theme,
  Tag,
  Checkbox,
} from "antd";
import {
  AddCircleOutline,
  DeleteOutline,
  ContentCopy,
  FileUploadOutlined,
  FileDownloadOutlined,
} from "@mui/icons-material";
import { AttributeItem, AttributeType } from "./types";

interface AttributeListProps {
  dataSource: AttributeItem[];
  setDataSource: (data: AttributeItem[]) => void;
  selectedAttributeId: string | null;
  onSelectAttribute: (id: string, item: AttributeItem) => void;
  searchText: string;
  onSearchTextChange: (text: string) => void;
  onAddAttribute?: () => void;
  onDeleteAttribute?: (item: AttributeItem) => void;
  onBatchRemoveAttributes?: (ids: string[]) => void;
}

const { Text } = Typography;
// ... existing getTypeIcon code ...
const getTypeIcon = (type: AttributeType) => {
  switch (type) {
    case "string":
      return <FontColorsOutlined style={{ color: "#1890ff" }} />;
    case "number":
      return <NumberOutlined style={{ color: "#52c41a" }} />;
    case "date":
      return <CalendarOutlined style={{ color: "#fa8c16" }} />;
    case "boolean":
      return <CheckSquareOutlined style={{ color: "#722ed1" }} />;
    case "enum":
      return <UnorderedListOutlined style={{ color: "#13c2c2" }} />;
    case "multi-enum":
      return <UnorderedListOutlined style={{ color: "#13c2c2" }} />;
    default:
      return <FontColorsOutlined />;
  }
};

const getTypeLabel = (type: AttributeType) => {
  switch (type) {
    case "string":
      return "文本型";
    case "number":
      return "数字型";
    case "date":
      return "日期型";
    case "boolean":
      return "布尔型";
    case "enum":
      return "枚举型（单选）";
    case "multi-enum":
      return "枚举型（多选）";
    default:
      return type;
  }
};

const LEFT_INDICATOR_WIDTH = 4;
const CHECKBOX_COL_WIDTH = 32;
const INDEX_COL_WIDTH = 30;
const TYPE_COL_WIDTH = 100;
const STATUS_COL_WIDTH = 44;
const HORIZONTAL_PADDING = 16;
const ACTION_COL_RESERVED_WIDTH = 40;
const COLUMN_GAP = 8;
const LIST_GRID_TEMPLATE_COLUMNS = `${CHECKBOX_COL_WIDTH}px ${INDEX_COL_WIDTH}px minmax(0, 1fr) minmax(0, 1fr) ${TYPE_COL_WIDTH}px ${STATUS_COL_WIDTH}px`;

const AttributeList: React.FC<AttributeListProps> = ({
  dataSource,
  setDataSource,
  selectedAttributeId,
  onSelectAttribute,
  searchText,
  onSearchTextChange,
  onAddAttribute,
  onDeleteAttribute,
  onBatchRemoveAttributes,
}) => {
  const { token } = theme.useToken();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedAttributeId && listRef.current) {
      const element = document.getElementById(`attr-list-item-${selectedAttributeId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [selectedAttributeId, dataSource.length]);

  const filteredData = dataSource.filter(
    (item) =>
      item.name.toLowerCase().includes(searchText.toLowerCase()) ||
      item.code.toLowerCase().includes(searchText.toLowerCase()) ||
      item.attributeField?.toLowerCase().includes(searchText.toLowerCase()),
  );

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    const idSet = new Set(filteredData.map((item) => item.id));
    setSelectedRowKeys((prev) => {
      const next = prev.filter((key) => idSet.has(String(key)));
      if (next.length === prev.length && next.every((key, idx) => key === prev[idx])) {
        return prev;
      }
      return next;
    });
  }, [dataSource, searchText]);

  const handleSelectAll = (e: any) => {
    if (e.target.checked) {
      setSelectedRowKeys(filteredData.map(item => item.id));
    } else {
      setSelectedRowKeys([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedRowKeys(prev => [...prev, id]);
    } else {
      setSelectedRowKeys(prev => prev.filter(key => key !== id));
    }
  };

  const getMenuItems = (item: AttributeItem): MenuProps["items"] => [
    {
      key: "duplicate",
      label: "复制 (Duplicate)",
      icon: <CopyOutlined />,
      onClick: (e) => {
        e.domEvent.stopPropagation();
      },
    },
    {
      type: "divider",
    },
    {
      key: "delete",
      label: "删除 (Delete)",
      icon: <DeleteOutlined />,
      danger: true,
      onClick: (e) => {
        e.domEvent.stopPropagation();
        if (onDeleteAttribute) {
          onDeleteAttribute(item);
        } else {
          setDataSource(dataSource.filter((d) => d.id !== item.id));
        }
      },
    },
  ];

  const handleToolbarBatchDelete = () => {
    const ids = selectedRowKeys.map((key) => String(key));
    if (ids.length === 0) return;

    if (onBatchRemoveAttributes) {
      onBatchRemoveAttributes(ids);
    } else {
      setDataSource(dataSource.filter((d) => !ids.includes(d.id)));
    }
    setSelectedRowKeys([]);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: token.colorBgContainer,
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          height: 46,
          padding: "0 16px",
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <Button
              type="text"
              size="small"
              icon={<AddCircleOutline fontSize="small" />}
              style={{ color: token.colorPrimary }}
              onClick={() => onAddAttribute?.()}
            />
            <Button
              type="text"
              size="small"
              icon={<DeleteOutline fontSize="small" />}
              style={{ color: token.colorPrimary }}
              disabled={selectedRowKeys.length === 0}
              onClick={handleToolbarBatchDelete}
            />
            <Button
              type="text"
              size="small"
              icon={<ContentCopy fontSize="small" />}
              style={{ color: token.colorPrimary }}
            />
            <Button
              type="text"
              size="small"
              icon={<FileUploadOutlined fontSize="small" />}
              style={{ color: token.colorPrimary }}
            />
            <Button
              type="text"
              size="small"
              icon={<FileDownloadOutlined fontSize="small" />}
              style={{ color: token.colorPrimary }}
            />
          </div>

          <div style={{ flex: 1, minWidth: 180, maxWidth: 320 }}>
            <Input
              placeholder="筛选属性 . . ."
              prefix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
              value={searchText}
              onChange={(e) => onSearchTextChange(e.target.value)}
              allowClear
              size="small"
            />
          </div>
        </div>
      </div>

      {/* List Area */}
      <div style={{ flex: 1, overflowY: "auto" }} ref={listRef}>
        <div style={{
          padding: `8px ${HORIZONTAL_PADDING}px`,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          borderLeft: `${LEFT_INDICATOR_WIDTH}px solid transparent`,
          background: token.colorBgContainer,
          paddingRight: ACTION_COL_RESERVED_WIDTH,
          position: "sticky",
          top: 0,
          zIndex: 2,
        }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: LIST_GRID_TEMPLATE_COLUMNS,
              columnGap: COLUMN_GAP,
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Checkbox
                checked={filteredData.length > 0 && selectedRowKeys.length === filteredData.length}
                indeterminate={selectedRowKeys.length > 0 && selectedRowKeys.length < filteredData.length}
                onChange={handleSelectAll}
              />
            </div>
            <Text type="secondary" style={{ fontSize: 12, textAlign: "center", display: "block" }}>序号</Text>
            <Text type="secondary" style={{ fontSize: 12, textAlign: "center", display: "block" }}>属性名称</Text>
            <Text type="secondary" style={{ fontSize: 12, textAlign: "center", display: "block" }}>属性字段</Text>
            <Text type="secondary" style={{ fontSize: 12, textAlign: "center", display: "block" }}>数据类型</Text>
            <div />
          </div>
        </div>

        <List
          itemLayout="horizontal"
          dataSource={filteredData}
          split={false}
          renderItem={(item, index) => {
            const isSelected = selectedAttributeId === item.id;
            const isChecked = selectedRowKeys.includes(item.id);
            return (
              <div id={`attr-list-item-${item.id}`}>
                <List.Item
                style={{
                  padding: `12px ${HORIZONTAL_PADDING}px`,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  borderLeft: `${LEFT_INDICATOR_WIDTH}px solid ${isSelected ? token.colorPrimary : "transparent"}`,
                  background: isSelected
                    ? token.controlItemBgActive
                    : "transparent",
                  position: "relative",
                  paddingRight: `${ACTION_COL_RESERVED_WIDTH}px`
                }}
                className={!isSelected ? "hover:bg-gray-50" : ""} // Keep minimal tailwind for hover if not strict
                onClick={() => onSelectAttribute(item.id, item)}
              >
                <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)" }}>
                  <Dropdown
                    key="more"
                    menu={{ items: getMenuItems(item) }}
                    trigger={["click"]}
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={
                        <MoreOutlined
                          style={{ color: token.colorTextQuaternary }}
                        />
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Dropdown>
                </div>
                <div
                  style={{
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns: LIST_GRID_TEMPLATE_COLUMNS,
                    columnGap: COLUMN_GAP,
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Checkbox 
                      checked={isChecked} 
                      onChange={(e) => handleSelectRow(item.id, e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <Text type="secondary" style={{ fontSize: 12, textAlign: "center", display: "block" }}>
                    {index + 1}
                  </Text>

                  <Text
                    strong
                    style={{ fontSize: 14, minWidth: 0, textAlign: "center", display: "block" }}
                    ellipsis={{ tooltip: item.name || "未命名属性" }}
                  >
                    {item.name || (
                      <span
                        style={{
                          color: token.colorTextQuaternary,
                          fontStyle: "italic",
                        }}
                      >
                        未命名属性
                      </span>
                    )}
                  </Text>

                  <Text
                    type="secondary"
                    style={{ fontSize: 12, fontFamily: "monospace", minWidth: 0, textAlign: "center", display: "block" }}
                    ellipsis={{ tooltip: item.attributeField }}
                  >
                    {item.attributeField || '-'}
                  </Text>

                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      whiteSpace: "nowrap",
                      minWidth: 0,
                    }}
                    title={item.type}
                  >
                    {getTypeIcon(item.type)}
                    <span style={{ fontSize: 12 }}>
                      {getTypeLabel(item.type)}
                    </span>
                  </span>

                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {item.id.startsWith("new_attr_") ? (
                      <Tag
                        color="processing"
                        style={{ marginInlineEnd: 0, paddingInline: 6, lineHeight: "18px", height: 20 }}
                      >
                        NEW
                      </Tag>
                    ) : item.required ? (
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: token.colorError,
                        }}
                        title="必填"
                      ></div>
                    ) : null}
                  </div>
                </div>
                </List.Item>
              </div>
            );
          }}
        />
      </div>

      {/* Footer Info */}
      <div
        style={{
          padding: 8,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgLayout,
          textAlign: "center",
          fontSize: 12,
          color: token.colorTextQuaternary,
        }}
      >
        共 {dataSource.length} 个属性
      </div>
    </div>
  );
};

export default AttributeList;
