import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Checkbox, Form, Input, InputNumber, Modal, Select, Switch, Tabs, Tag } from 'antd';
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { api } from '../api';
import { type CareRule, categoryNames, type Order, type Product } from '../types';
import { EmptyState, Feedback, formatDate, formatPrice, Loading, MediaImage, PageIntro } from '../ui';
import { OrderLine, OrderStatus } from './Orders';

const adminProductsKey = ['admin', 'products'] as const;
const adminCareKey = ['admin', 'care'] as const;
const adminOrdersKey = ['admin', 'orders'] as const;

export function Admin() {
  const [params, setParams] = useSearchParams();
  const allowed = ['products', 'care', 'orders', 'audit'];
  const sectionParam = params.get('section');
  const section = sectionParam && allowed.includes(sectionParam) ? sectionParam : 'products';
  return <main className="page-shell admin-page">
    <PageIntro title="运营后台" description="管理商品、照护内容和订单履约。" />
    <Tabs activeKey={section} onChange={active => setParams({ section: active }, { replace: true })} destroyOnHidden items={[
      { key: 'products', label: '商品管理', children: <AdminProducts /> },
      { key: 'care', label: '照护内容', children: <AdminCare /> },
      { key: 'orders', label: '订单与售后', children: <AdminOrders /> },
      { key: 'audit', label: '操作记录', children: <AdminAudit /> },
    ]} />
  </main>;
}

function AdminProducts() {
  const result = useQuery({ queryKey: adminProductsKey, queryFn: () => api<Product[]>('/admin/products') });
  const [current, setCurrent] = useState<Product | null | undefined>(undefined);
  return <section>
    <div className="admin-toolbar"><h2>商品</h2><Button type="primary" icon={<PlusOutlined />} onClick={() => setCurrent(null)}>新建商品</Button></div>
    <Feedback error={result.error} />{result.isPending && <Loading />}
    {result.data?.length === 0 && <EmptyState title="暂无商品" />}
    <div className="admin-records">{result.data?.map(product => <article key={product.id} className="admin-row">
      <MediaImage className="order-image" src={product.imageUrl} alt="" />
      <div><h3>{product.name}</h3><p>{categoryNames[product.category]} · {product.variants.length} 个规格 · 库存 {product.variants.reduce((stock, variant) => stock + variant.stock, 0)}</p></div>
      <Tag color={product.active ? 'green' : undefined}>{product.active ? '已上架' : '已下架'}</Tag>
      <Button onClick={() => setCurrent(product)}>编辑</Button>
    </article>)}</div>
    {current !== undefined && <ProductEditor product={current} close={() => setCurrent(undefined)} />}
  </section>;
}

function ProductEditor({ product, close }: { product: Product | null; close: () => void }) {
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: (values: Product) => api<Product>(product ? `/admin/products/${product.id}` : '/admin/products', product ? 'PUT' : 'POST', {
      ...values,
      variants: values.variants.map(variant => ({ ...variant, expectedStock: product?.variants.find(previous => previous.id === variant.id)?.stock })),
    }),
    onSuccess: async () => {
      await Promise.all([client.invalidateQueries({ queryKey: adminProductsKey }), client.invalidateQueries({ queryKey: ['products'] })]);
      close();
    },
  });
  return <Modal title={product ? `编辑 ${product.name}` : '新建商品'} open onCancel={close} footer={null} width={760}>
    <Feedback error={save.error} />
    <Form layout="vertical" onFinish={values => save.mutate(values)} initialValues={product || { active: false, custom: false, category: 'BOWLS', variants: [{ name: '标准款', stock: 0 }] }}>
      <div className="form-grid">
        <Form.Item label="商品名称" name="name" rules={[{ required: true, whitespace: true, message: '请输入名称' }, { max: 150 }]}><Input /></Form.Item>
        <Form.Item label="分类" name="category" rules={[{ required: true }]}><Select options={Object.entries(categoryNames).map(([value, label]) => ({ value, label }))} /></Form.Item>
        <Form.Item label="上架" name="active" valuePropName="checked"><Switch /></Form.Item>
        <Form.Item label="文字或照片定制" name="custom" valuePropName="checked"><Switch /></Form.Item>
      </div>
      <Form.Item label="商品介绍" name="description" rules={[{ required: true, whitespace: true, message: '请输入商品介绍' }]}><Input.TextArea rows={4} /></Form.Item>
      <Form.Item label="商品图片路径" name="imageUrl" extra="例如 /images/bowls.webp"><Input placeholder="/images/bowls.webp" /></Form.Item>
      <fieldset className="form-fieldset"><legend>商品规格</legend><Form.List name="variants" rules={[{ validator: async (_, variants) => {
        if (!variants?.length) throw new Error('至少添加一个规格');
      } }]}>{(fields, { add, remove }, { errors }) => <>
        {fields.map(field => <div key={field.key} className="variant-editor">
          <Form.Item name={[field.name, 'id']} hidden><Input /></Form.Item>
          <Form.Item label="规格" name={[field.name, 'name']} rules={[{ required: true, whitespace: true, message: '填写规格' }]}><Input /></Form.Item>
          <Form.Item label="价格（分）" name={[field.name, 'priceCents']} rules={[{ required: true, message: '填写价格' }]}><InputNumber min={0} precision={0} /></Form.Item>
          <Form.Item label="可售库存" name={[field.name, 'stock']} rules={[{ required: true, message: '填写库存' }]}><InputNumber min={0} precision={0} /></Form.Item>
          <Button type="text" htmlType="button" aria-label="移除规格" icon={<CloseOutlined />} onClick={() => remove(field.name)} />
        </div>)}
        <Form.ErrorList errors={errors} /><Button htmlType="button" icon={<PlusOutlined />} onClick={() => add({ stock: 0 })}>新增规格</Button>
      </>}</Form.List></fieldset>
      <Button type="primary" htmlType="submit" loading={save.isPending}>保存商品</Button>
    </Form>
  </Modal>;
}

const speciesNames = { ALL: '猫狗通用', CAT: '猫', DOG: '狗' };
const stageNames = { ALL: '全年龄', YOUNG: '幼年', ADULT: '成年', SENIOR: '老年' };

function AdminCare() {
  const result = useQuery({ queryKey: adminCareKey, queryFn: () => api<CareRule[]>('/admin/care') });
  const [current, setCurrent] = useState<CareRule | null | undefined>(undefined);
  return <section>
    <div className="admin-toolbar"><h2>照护卡片</h2><Button type="primary" icon={<PlusOutlined />} onClick={() => setCurrent(null)}>新建内容</Button></div>
    <Feedback error={result.error} />{result.isPending && <Loading />}
    {result.data?.length === 0 && <EmptyState title="暂无照护内容" />}
    <div className="admin-records">{result.data?.map(card => <article className="admin-row" key={card.id}>
      <div><h3>{card.title}</h3><p>{speciesNames[card.species]} · {stageNames[card.stage]}{card.breed && ` · ${card.breed}`}</p></div>
      <Tag color={card.published ? 'green' : undefined}>{card.published ? '已发布' : '草稿'}</Tag><Button onClick={() => setCurrent(card)}>编辑</Button>
    </article>)}</div>
    {current !== undefined && <CareEditor card={current} close={() => setCurrent(undefined)} />}
  </section>;
}

function CareEditor({ card, close }: { card: CareRule | null; close: () => void }) {
  const client = useQueryClient();
  const products = useQuery({ queryKey: adminProductsKey, queryFn: () => api<Product[]>('/admin/products') });
  const save = useMutation({
    mutationFn: (values: CareRule) => api<CareRule>(card ? `/admin/care/${card.id}` : '/admin/care', card ? 'PUT' : 'POST', values),
    onSuccess: async () => {
      await Promise.all([client.invalidateQueries({ queryKey: adminCareKey }), client.invalidateQueries({ queryKey: ['care'] })]);
      close();
    },
  });
  return <Modal title={card ? '编辑照护内容' : '新建照护内容'} open onCancel={close} width={740} footer={null}>
    <Feedback error={save.error || products.error} />
    <Form layout="vertical" onFinish={values => save.mutate(values)} initialValues={card || { species: 'ALL', stage: 'ALL', published: false }}>
      <Form.Item label="标题" name="title" rules={[{ required: true, whitespace: true, message: '请输入标题' }, { max: 150 }]}><Input /></Form.Item>
      <Form.Item label="简要说明" name="summary" rules={[{ required: true, whitespace: true, message: '请输入说明' }, { max: 500 }]}><Input /></Form.Item>
      <Form.Item label="正文" name="body" rules={[{ required: true, whitespace: true, message: '请输入正文' }, { max: 6000 }]}><Input.TextArea rows={4} /></Form.Item>
      <div className="form-grid">
        <Form.Item label="物种" name="species"><Select options={Object.entries(speciesNames).map(([value, label]) => ({ value, label }))} /></Form.Item>
        <Form.Item label="生命阶段" name="stage"><Select options={Object.entries(stageNames).map(([value, label]) => ({ value, label }))} /></Form.Item>
        <Form.Item label="品种" name="breed"><Input placeholder="留空则适用于该物种所有品种" /></Form.Item>
        <Form.Item label="关联商品" name="productId" normalize={value => value ?? null}><Select allowClear showSearch optionFilterProp="label" options={products.data?.map(product => ({ value: product.id, label: `${product.name}${product.active ? '' : ' · 已下架'}` }))} /></Form.Item>
      </div>
      <Form.Item label="参考资料链接" name="sourceUrl" rules={[{ required: true, type: 'url', message: '请输入有效的参考资料链接' }, { max: 1000 }]}><Input type="url" placeholder="https://" /></Form.Item>
      <Form.Item label="发布" name="published" valuePropName="checked"><Switch /></Form.Item>
      <Button type="primary" htmlType="submit" loading={save.isPending}>保存内容</Button>
    </Form>
  </Modal>;
}

function AdminOrders() {
  const result = useQuery({ queryKey: adminOrdersKey, queryFn: () => api<Order[]>('/admin/orders') });
  const [current, setCurrent] = useState<number>();
  const order = result.data?.find(item => item.id === current);
  return <section>
    <div className="admin-toolbar"><h2>订单</h2></div>
    <Feedback error={result.error} />{result.isPending && <Loading />}
    {result.data?.length === 0 && <EmptyState title="暂无订单" />}
    <div className="admin-records">{result.data?.map(item => <article className="admin-row" key={item.id}>
      <div><h3>订单 {item.id} · {item.recipient}</h3><p>{formatDate(item.createdAt)} · {formatPrice(item.totalCents)}</p></div>
      <OrderStatus order={item} /><Button onClick={() => setCurrent(item.id)}>查看详情</Button>
    </article>)}</div>
    {order && <AdminOrderDetail key={order.id} order={order} close={() => setCurrent(undefined)} />}
  </section>;
}

function AdminOrderDetail({ order, close }: { order: Order; close: () => void }) {
  const client = useQueryClient();
  const canShip = ['PAID', 'PARTIALLY_SHIPPED'].includes(order.status);
  const shippable = order.items.filter(item => !item.shipmentId && (!item.productionStatus || item.productionStatus === 'NOT_REQUIRED' || item.productionStatus === 'READY'));
  const [shipVersion, setShipVersion] = useState(0);
  const change = useMutation({
    mutationFn: ({ kind, payload }: { kind: 'ship' | 'production' | 'refund'; payload: unknown }) => api<Order>(`/admin/orders/${order.id}/${kind}`, 'POST', payload),
    onSuccess: async (_, variables) => {
      if (variables.kind === 'ship') setShipVersion(version => version + 1);
      await Promise.all([client.invalidateQueries({ queryKey: adminOrdersKey }), client.invalidateQueries({ queryKey: ['orders'] }), client.invalidateQueries({ queryKey: ['products'] })]);
    },
  });
  return <Modal title={`订单 ${order.id}`} open onCancel={close} footer={null} width={740}>
    <Feedback error={change.error} /><OrderStatus order={order} />
    <p className="admin-recipient">{order.recipient} · {order.phone} · {order.address}</p>
    <div className="summary-lines">{order.items.map(item => <div key={item.id}><OrderLine item={item} />
      <div className="order-actions product-action-row">
        <Link className="text-link" to={`/shop/${item.productId}`}>查看原商品</Link>
        {canShip && item.productionStatus === 'QUEUED' && <Button disabled={change.isPending} onClick={() => change.mutate({ kind: 'production', payload: { itemId: item.id, status: 'IN_PRODUCTION' } })}>开始制作</Button>}
        {canShip && item.productionStatus === 'IN_PRODUCTION' && <Button disabled={change.isPending} onClick={() => change.mutate({ kind: 'production', payload: { itemId: item.id, status: 'READY' } })}>确认制作完成</Button>}
      </div>
    </div>)}</div>
    {!!order.shipments.length && <div className="shipment-list"><h3>包裹</h3>{order.shipments.map(shipment => <div key={shipment.id}>{shipment.carrier} · {shipment.trackingNo}</div>)}</div>}
    {canShip && !!shippable.length && <section className="admin-order-action"><h3>录入发货信息</h3>
      <Form key={shipVersion} initialValues={{ itemIds: shippable.map(item => item.id) }} layout="vertical" onFinish={payload => change.mutate({ kind: 'ship', payload })}>
        <Form.Item label="本包裹商品" name="itemIds" rules={[{ required: true, message: '请选择至少一件商品' }]}><Checkbox.Group options={shippable.map(item => ({ label: `${item.productName} · ${item.variantName}`, value: item.id }))} /></Form.Item>
        <div className="form-grid"><Form.Item label="承运方" name="carrier" rules={[{ required: true, whitespace: true, message: '请输入承运方' }]}><Input /></Form.Item>
        <Form.Item label="运单号" name="trackingNo" rules={[{ required: true, whitespace: true, message: '请输入运单号' }]}><Input /></Form.Item></div>
        <Button type="primary" htmlType="submit" loading={change.isPending}>确认发货</Button>
      </Form>
    </section>}
    {order.status === 'REFUND_REQUESTED' && <section className="admin-order-action"><h3>退款申请</h3><p className="prose">{order.refundReason}</p><div className="order-actions">
      <Button type="primary" loading={change.isPending} onClick={() => change.mutate({ kind: 'refund', payload: { approve: true } })}>通过退款</Button>
      <Button disabled={change.isPending} onClick={() => change.mutate({ kind: 'refund', payload: { approve: false } })}>拒绝退款</Button>
    </div></section>}
  </Modal>;
}

const auditActionNames: Record<string, string> = {
  CREATE: '新建照护内容', UPDATE: '更新照护内容', CREATE_PRODUCT: '新建商品', UPDATE_PRODUCT: '更新商品',
  SHIP_ORDER: '录入发货', UPDATE_PRODUCTION: '更新制作进度', APPROVE_REFUND: '通过退款', REJECT_REFUND: '拒绝退款',
};
const auditSubjects: Record<string, string> = { CARE_CARD: '照护卡片', PRODUCT: '商品', ORDER: '订单' };

function AdminAudit() {
  const result = useQuery({ queryKey: ['admin', 'audit'], queryFn: () => api<{
    id: number; operatorName: string; action: string; subjectType: string; subjectId: number; createdAt: string;
  }[]>('/admin/audit') });
  return <section>
    <div className="admin-toolbar"><h2>最近操作</h2></div>
    <Feedback error={result.error} />{result.isPending && <Loading />}
    {result.data?.length === 0 && <EmptyState title="暂无操作记录" />}
    {!!result.data?.length && <div className="admin-records">{result.data.map(event => <article className="admin-row" key={event.id}><div>
      <h3>{auditActionNames[event.action] || event.action}</h3><p>{event.operatorName} · {auditSubjects[event.subjectType] || event.subjectType} {event.subjectId}</p>
    </div><time dateTime={event.createdAt}>{formatDate(event.createdAt)}</time></article>)}</div>}
  </section>;
}
