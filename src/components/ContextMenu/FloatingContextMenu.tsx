"use client";

import React from "react";
import { createPortal } from "react-dom";
import { Dropdown } from "antd";
import type { MenuProps } from "antd";

interface FloatingContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  items: MenuProps["items"];
  onMenuClick?: MenuProps["onClick"];
  onClose?: () => void;
}

const FloatingContextMenu: React.FC<FloatingContextMenuProps> = ({
  open,
  x,
  y,
  items,
  onMenuClick,
  onClose,
}) => {
  if (typeof document === "undefined") return null;

  return createPortal(
    <Dropdown
      key={`${x}-${y}`}
      menu={{
        items,
        onClick: onMenuClick,
      }}
      open={open}
      onOpenChange={(visible) => {
        if (!visible) {
          onClose?.();
        }
      }}
      trigger={["click"]}
      destroyOnHidden
    >
      <div
        style={{
          position: "fixed",
          left: x,
          top: y,
          width: 1,
          height: 1,
          pointerEvents: "none",
        }}
      />
    </Dropdown>,
    document.body,
  );
};

export default FloatingContextMenu;
