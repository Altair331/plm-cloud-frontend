import React, { useState, useRef } from 'react';
import { Modal, type ModalProps, Button } from 'antd';
import { FullscreenOutlined, FullscreenExitOutlined, CloseOutlined } from '@ant-design/icons';
import { lightPalette } from '../../styles/colors';

interface DraggableModalProps extends ModalProps {
  children: React.ReactNode;
}

type ModalCancelEvent = Parameters<NonNullable<ModalProps['onCancel']>>[0];
type ResolvedModalStyles = Exclude<ModalProps['styles'], undefined | ((info: { props: ModalProps }) => unknown)>;

const DraggableModal: React.FC<DraggableModalProps> = ({ title, children, destroyOnClose, ...props }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragStartPos = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const modalStyles: ResolvedModalStyles = (
    typeof props.styles === 'function' ? props.styles({ props }) : props.styles
  ) ?? {};

  const handleAfterOpenChange = (open: boolean) => {
    props.afterOpenChange?.(open);

    if (open) {
      setPosition({ x: 0, y: 0 });
      setIsFullScreen(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isFullScreen) return;
    if (e.button !== 0) return;
    
    isDragging.current = true;
    dragStartPos.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return;
    const newX = e.clientX - dragStartPos.current.x;
    const newY = e.clientY - dragStartPos.current.y;
    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const renderTitle = () => (
    <div 
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        cursor: isFullScreen ? 'default' : 'move',
        userSelect: 'none',
        width: '100%',
      }}
      onMouseDown={handleMouseDown}
    >
      <div style={{ flex: 1 }}>{title}</div>
      <div 
        style={{ display: 'flex', alignItems: 'center', gap: 4 }} 
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Button
          type="text"
          icon={isFullScreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            setPosition({ x: 0, y: 0 });
            setIsFullScreen((prev) => !prev);
          }}
          style={{ color: lightPalette.iconColor }}
        />
        {(props.closable ?? true) && (
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              props.onCancel?.(e as ModalCancelEvent);
            }}
            style={{ color: lightPalette.iconColor }}
          />
        )}
      </div>
    </div>
  );

  return (
    <Modal
      centered={isFullScreen ? false : (props.centered ?? true)}
      destroyOnHidden={destroyOnClose}
      {...props}
      afterOpenChange={handleAfterOpenChange}
      closable={false}
      title={renderTitle()}
      mask={{ blur: false }}
      width={isFullScreen ? '100%' : props.width}
      style={isFullScreen ? { ...props.style, top: 0, margin: 0, padding: 0, maxWidth: '100vw', height: '100vh' } : props.style}
      styles={{
        ...modalStyles,
        wrapper: {
          ...(modalStyles.wrapper ?? {}),
          ...(isFullScreen ? { padding: 0 } : {}),
        },
        container: {
          ...(modalStyles.container ?? {}),
          ...(isFullScreen
            ? {
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                overflow: 'hidden',
              }
            : {}),
        },
        body: {
          ...(modalStyles.body ?? {}),
          ...(isFullScreen ? { 
            flex: 1, 
            minHeight: 0,
            overflow: 'auto'
          } : {})
        }
      }}
      modalRender={(modal) => (
        <div style={{ 
            transform: isFullScreen ? 'none' : `translate(${position.x}px, ${position.y}px)`, 
            transition: isDragging.current ? 'none' : 'transform 0.1s' 
        }}>
          {modal}
        </div>
      )}
    >
      {children}
    </Modal>
  );
};

export default DraggableModal;
