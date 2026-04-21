import React, { useEffect, useRef, useState } from 'react';
import { App, Form, Input, Select, Button, Row, Col, Space, Card, theme } from 'antd';
import dynamic from 'next/dynamic';
import DraggableModal from '@/components/DraggableModal';
import { metaCategoryApi } from '@/services/metaCategory';
import { useDictionary } from '@/contexts/DictionaryContext';
import {
  CATEGORY_BUSINESS_DOMAIN_DICT_CODE,
  getCategoryBusinessDomainLabel,
} from '@/features/category/businessDomains';

const { Option } = Select;
const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });
const EMPTY_QUILL_DELTA_JSON = '{"ops":[{"insert":"\\n"}]}'

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    [{ font: [] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ align: [] }],
    ['blockquote', 'code-block'],
    ['link', 'image'],
    ['clean'],
  ],
};

const quillFormats = [
  'header',
  'font',
  'bold',
  'italic',
  'underline',
  'strike',
  'color',
  'background',
  'list',
  'align',
  'blockquote',
  'code-block',
  'link',
  'image',
];

export interface CreateCategoryModalProps {
  open: boolean;
  onCancel: () => void;
  onOk: (values: CreateCategorySubmitValues) => Promise<void> | void;
  parentNode?: {
    id?: string | null;
    code?: string;
    name?: string;
    level?: number;
    path?: string;
    businessDomain?: string;
    rootCode?: string;
    rootName?: string;
  } | null;
  submitLoading?: boolean;
  defaultBusinessDomain?: string;
}

interface CreateCategorySubmitValues {
  code?: string;
  name: string;
  businessDomain: string;
  parentId?: string | null;
  status: 'CREATED' | 'EFFECTIVE' | 'INVALID';
  description?: string;
  generationMode?: 'MANUAL';
  freezeCode?: undefined;
  parentDisplay?: string;
  rootDisplay?: string;
}

interface ErrorWithMessage {
  message?: string;
  error?: string;
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object') {
    const candidate = error as ErrorWithMessage;
    return candidate.message || candidate.error || fallback;
  }
  return fallback;
};

const CreateCategoryModal: React.FC<CreateCategoryModalProps> = ({
  open,
  onCancel,
  onOk,
  parentNode,
  submitLoading,
  defaultBusinessDomain,
}) => {
  const [form] = Form.useForm();
  const { token } = theme.useToken();
  const { modal } = App.useApp();
  const { ensureScene, getEntries } = useDictionary();
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewRequestIdRef = useRef(0);
  const suggestedCodeRef = useRef('');
  const allowManualOverrideRef = useRef(false);
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);

  useEffect(() => {
    void ensureScene('category-admin');
  }, [ensureScene]);

  const watchedBusinessDomain = Form.useWatch('businessDomain', form) as string | undefined;
  const watchedParentId = Form.useWatch('parentId', form) as string | undefined;
  const watchedCode = Form.useWatch('code', form) as string | undefined;
  const hasManualCode = codeManuallyEdited && String(watchedCode || '').trim().length > 0;

  const businessDomainEntries = getEntries(CATEGORY_BUSINESS_DOMAIN_DICT_CODE);
  const statusEntries = getEntries('META_CATEGORY_STATUS').filter((entry) =>
    ['CREATED', 'EFFECTIVE', 'INVALID'].includes(String(entry.value).toUpperCase()),
  );
  const activeBusinessDomain = parentNode?.businessDomain || defaultBusinessDomain || '';
  const activeBusinessDomainDisplay = activeBusinessDomain
    ? `${getCategoryBusinessDomainLabel(businessDomainEntries, activeBusinessDomain, activeBusinessDomain)} (${activeBusinessDomain})`
    : '-';

  useEffect(() => {
    if (!open) return;
    suggestedCodeRef.current = '';
    form.setFieldsValue({
      code: '',
      name: '',
      businessDomain: activeBusinessDomain,
      parentId: parentNode?.id || null,
      parentDisplay: parentNode?.code || parentNode?.name
        ? `${parentNode?.code || '-'} - ${parentNode?.name || '未命名分类'}`
        : '根分类（无父级）',
      rootDisplay: (() => {
        if (!parentNode) return '当前创建为根分类';
        if (parentNode.rootCode) {
          return `${parentNode.rootCode} - ${parentNode.rootName || '未命名根分类'}`;
        }
        if (parentNode.level === 1) {
          return `${parentNode.code || '-'} - ${parentNode.name || '未命名分类'}`;
        }
        return '根分类信息加载中...';
      })(),
      status: 'CREATED',
      description: EMPTY_QUILL_DELTA_JSON,
    });
    allowManualOverrideRef.current = false;
  }, [activeBusinessDomain, form, open, parentNode]);

  useEffect(() => {
    if (!open) {
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }
      return;
    }

    const businessDomain = String(watchedBusinessDomain || '').trim();
    if (!businessDomain) {
      return;
    }

    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
    }

    previewTimerRef.current = setTimeout(async () => {
      const requestId = ++previewRequestIdRef.current;
      const currentCode = String(watchedCode || '').trim();
      const manualCode = hasManualCode ? currentCode : '';

      try {
        const preview = await metaCategoryApi.previewCreateCode({
          businessDomain,
          parentId: watchedParentId || undefined,
          manualCode: hasManualCode ? manualCode : undefined,
          count: 1,
        });
        if (requestId !== previewRequestIdRef.current) {
          return;
        }

        allowManualOverrideRef.current = Boolean(preview.allowManualOverride);

        if (!hasManualCode) {
          suggestedCodeRef.current = preview.suggestedCode || '';
          setCodeManuallyEdited(false);
          form.setFieldValue('code', preview.suggestedCode || '');
        }

        if (hasManualCode && !preview.allowManualOverride) {
          form.setFieldValue('code', suggestedCodeRef.current || preview.suggestedCode || '');
          setCodeManuallyEdited(false);
        }
      } catch (error) {
        if (requestId !== previewRequestIdRef.current) {
          return;
        }
        if (!hasManualCode) {
          form.setFieldValue('code', '');
        }
        modal.warning({
          title: '分类编码预计算失败',
          content: getErrorMessage(error, '分类编码预计算失败'),
        });
      }
    }, hasManualCode ? 300 : 0);

    return () => {
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }
    };
  }, [form, hasManualCode, modal, open, watchedBusinessDomain, watchedCode, watchedParentId]);

  const handleFinish = async (values: CreateCategorySubmitValues) => {
    const normalizedCode = String(values.code || '').trim();
    const manualOverride = hasManualCode && normalizedCode.length > 0 && allowManualOverrideRef.current;
    await onOk({
      ...values,
      code: manualOverride ? normalizedCode : undefined,
      generationMode: manualOverride ? 'MANUAL' : undefined,
      freezeCode: undefined,
    });
    form.resetFields();
    allowManualOverrideRef.current = false;
    suggestedCodeRef.current = '';
  };

  const handleRequestClose = () => {
    if (!form.isFieldsTouched(true)) {
      form.resetFields();
      onCancel();
      return;
    }

    modal.confirm({
      title: '存在未保存内容',
      content: '当前表单内容尚未保存，确认关闭并放弃本次编辑吗？',
      okText: '放弃并关闭',
      cancelText: '继续编辑',
      okType: 'danger',
      onOk: () => {
        form.resetFields();
        allowManualOverrideRef.current = false;
        suggestedCodeRef.current = '';
        onCancel();
      },
    });
  };

  const readOnlyStyle = {
    color: token.colorTextDisabled,
    backgroundColor: token.colorBgContainerDisabled,
    cursor: 'not-allowed',
  };

  return (
    <DraggableModal
      title="新增分类"
      open={open}
      width={800}
      onCancel={handleRequestClose}
      maskClosable={false}
      keyboard={false}
      footer={null}
      destroyOnHidden
    >
      <div style={{ padding: '0 0 16px 0' }}>
        <Space size="middle" style={{ marginBottom: 16 }}>
          <Button type="primary" loading={submitLoading} onClick={() => form.submit()}>保存</Button>
          <Button disabled>复制新增</Button>
        </Space>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleFinish}
        >
          <Card 
            size="small" 
            variant="outlined"
            style={{ 
              borderRadius: token.borderRadiusLG,
              backgroundColor: token.colorFillAlter,
              marginBottom: 16
            }}
          >
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  label="分类编码"
                  name="code"
                  rules={[{ required: true, message: '请输入分类编码' }]}
                >
                  <Input
                    onChange={(event) => {
                      const nextCode = event.target.value.trim();
                      setCodeManuallyEdited(
                        nextCode.length > 0 && nextCode !== suggestedCodeRef.current,
                      );
                    }}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="分类名称" name="name" rules={[{ required: true }]}>
                  <Input placeholder="请输入分类名称" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={24}>
              <Col span={12}>
                <Form.Item label="业务领域">
                  <Input readOnly value={activeBusinessDomainDisplay} style={readOnlyStyle} />
                </Form.Item>
                <Form.Item name="businessDomain" hidden>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="父级分类" name="parentDisplay">
                  <Input readOnly style={readOnlyStyle} />
                </Form.Item>
                <Form.Item name="parentId" hidden>
                  <Input />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={24}>
              <Col span={12}>
                <Form.Item label="分类状态" name="status">
                  <Select>
                    {statusEntries.length > 0
                      ? statusEntries.map((entry) => (
                          <Option key={entry.value} value={entry.value}>
                            {entry.label}
                          </Option>
                        ))
                      : (
                        <>
                          <Option value="CREATED">创建</Option>
                          <Option value="EFFECTIVE">生效</Option>
                          <Option value="INVALID">失效</Option>
                        </>
                      )}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="根分类" name="rootDisplay">
                  <Input readOnly style={readOnlyStyle} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={24}>
              <Col span={24}>
                <Form.Item label="详细描述">
                  <div
                    className="category-description-editor"
                    style={{
                      border: `1px solid ${token.colorBorder}`,
                      borderRadius: token.borderRadius,
                      overflow: 'hidden',
                      background: token.colorBgContainer,
                    }}
                  >
                    <Form.Item
                      name="description"
                      noStyle
                      trigger="onChange"
                      getValueFromEvent={(_content, _delta, _source, editor) => {
                        if (!editor || typeof editor.getContents !== 'function') {
                          return EMPTY_QUILL_DELTA_JSON;
                        }
                        return JSON.stringify(editor.getContents());
                      }}
                      getValueProps={(value) => {
                        if (!value || typeof value !== 'string') {
                          return { value: undefined };
                        }
                        try {
                          return { value: JSON.parse(value) };
                        } catch {
                          return { value: undefined };
                        }
                      }}
                    >
                      <ReactQuill
                        theme="snow"
                        modules={quillModules}
                        formats={quillFormats}
                        placeholder="请输入详细描述..."
                        style={{ minHeight: 180 }}
                      />
                    </Form.Item>
                  </div>
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Card 
            size="small" 
            style={{ 
              backgroundColor: token.colorInfoBg, 
              borderColor: token.colorInfoBorder,
              borderRadius: token.borderRadiusLG
            }}
          >
            <div style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>
              状态说明：创建（默认），生效（允许业务调用），失效（停止业务调用）
            </div>
          </Card>
        </Form>
      </div>
    </DraggableModal>
  );
};

export default CreateCategoryModal; 
