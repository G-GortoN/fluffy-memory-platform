import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Checkbox, Form, Input, InputNumber, Modal, Select, Switch, Tabs, Tag } from 'antd';
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { api } from '../api';
import { useLanguage } from '../language';
import { careLabels, categoryLabels } from '../locales/commerce';
import { localizeSeedText } from '../localized-content';
import type { CareRule, Order, Product } from '../types';
import { EmptyState, Feedback, formatDate, formatPrice, Loading, MediaImage, PageIntro } from '../ui';
import { OrderLine, OrderStatus } from './Orders';

const adminProductsKey = ['admin', 'products'] as const;
const adminCareKey = ['admin', 'care'] as const;
const adminOrdersKey = ['admin', 'orders'] as const;

export function Admin() {
  const { t } = useLanguage();
  const [params, setParams] = useSearchParams();
  const allowed = ['products', 'care', 'orders', 'audit'];
  const sectionParam = params.get('section');
  const section = sectionParam && allowed.includes(sectionParam) ? sectionParam : 'products';
  return <main className="page-shell admin-page">
    <PageIntro title={t('运营后台', 'Admin dashboard', '管理後台')} description={t('管理商品、照护内容和订单履约。', 'Manage the catalog, care guidance and order fulfillment.', '管理商品、照顧內容及訂單處理。')} />
    <Tabs activeKey={section} onChange={active => setParams({ section: active }, { replace: true })} destroyOnHidden items={[
      { key: 'products', label: t('商品管理', 'Products', '商品管理'), children: <AdminProducts /> },
      { key: 'care', label: t('照护内容', 'Care guidance', '照顧內容'), children: <AdminCare /> },
      { key: 'orders', label: t('订单与售后', 'Orders and refunds', '訂單及售後'), children: <AdminOrders /> },
      { key: 'audit', label: t('操作记录', 'Activity log', '操作記錄'), children: <AdminAudit /> },
    ]} />
  </main>;
}

function AdminProducts() {
  const { t, locale } = useLanguage();
  const labels = categoryLabels(t);
  const result = useQuery({ queryKey: adminProductsKey, queryFn: () => api<Product[]>('/admin/products') });
  const [current, setCurrent] = useState<Product | null | undefined>(undefined);
  return <section>
    <div className="admin-toolbar"><h2>{t('商品', 'Products', '商品')}</h2><Button type="primary" icon={<PlusOutlined />} onClick={() => setCurrent(null)}>{t('新建商品', 'New product', '新增商品')}</Button></div>
    <Feedback error={result.error} />{result.isPending && <Loading />}
    {result.data?.length === 0 && <EmptyState title={t('暂无商品', 'No products yet', '暫無商品')} />}
    <div className="admin-records">{result.data?.map(product => {
      const options = product.variants.length;
      const stock = product.variants.reduce((total, variant) => total + variant.stock, 0);
      return <article key={product.id} className="admin-row">
        <MediaImage className="order-image" src={product.imageUrl} alt="" />
        <div><h3>{localizeSeedText(product.name, locale)}</h3><p>{labels[product.category]} · {t(`${options} 个规格`, `${options} ${options === 1 ? 'option' : 'options'}`, `${options} 個規格`)} · {t(`库存 ${stock}`, `${stock} in stock`, `庫存 ${stock}`)}</p></div>
        <Tag color={product.active ? 'green' : undefined}>{product.active ? t('已上架', 'Listed', '已上架') : t('已下架', 'Unlisted', '已下架')}</Tag>
        <Button onClick={() => setCurrent(product)}>{t('编辑', 'Edit', '編輯')}</Button>
      </article>;
    })}</div>
    {current !== undefined && <ProductEditor product={current} close={() => setCurrent(undefined)} />}
  </section>;
}

function ProductEditor({ product, close }: { product: Product | null; close: () => void }) {
  const { t, locale } = useLanguage();
  const productName = product ? localizeSeedText(product.name, locale) : '';
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
  return <Modal title={product ? t(`编辑 ${productName}`, `Edit ${productName}`, `編輯 ${productName}`) : t('新建商品', 'New product', '新增商品')} open onCancel={close} footer={null} width={760}>
    <Feedback error={save.error} />
    <Form layout="vertical" onFinish={values => save.mutate(values)} initialValues={product || { active: false, custom: false, category: 'BOWLS', variants: [{ name: t('标准款', 'Standard', '標準款'), stock: 0 }] }}>
      <div className="form-grid">
        <Form.Item label={t('商品名称', 'Product name', '商品名稱')} name="name" rules={[{ required: true, whitespace: true, message: t('请输入名称', 'Enter a name', '請輸入名稱') }, { max: 150 }]}><Input /></Form.Item>
        <Form.Item label={t('分类', 'Category', '分類')} name="category" rules={[{ required: true }]}><Select options={Object.entries(categoryLabels(t)).map(([value, label]) => ({ value, label }))} /></Form.Item>
        <Form.Item label={t('上架', 'List in the shop', '上架')} name="active" valuePropName="checked"><Switch /></Form.Item>
        <Form.Item label={t('文字或照片定制', 'Allow custom text or photos', '接受訂製文字或相片')} name="custom" valuePropName="checked"><Switch /></Form.Item>
      </div>
      <Form.Item label={t('商品介绍', 'Product description', '商品介紹')} name="description" rules={[{ required: true, whitespace: true, message: t('请输入商品介绍', 'Enter a product description', '請輸入商品介紹') }]}><Input.TextArea rows={4} /></Form.Item>
      <Form.Item label={t('商品图片路径', 'Product image path', '商品圖片路徑')} name="imageUrl" extra={t('例如 /images/bowls.webp', 'For example, /images/bowls.webp', '例如 /images/bowls.webp')}><Input placeholder="/images/bowls.webp" /></Form.Item>
      <fieldset className="form-fieldset"><legend>{t('商品规格', 'Product options', '商品規格')}</legend><Form.List name="variants" rules={[{ validator: async (_, variants) => {
        if (!variants?.length) throw new Error(t('至少添加一个规格', 'Add at least one option', '請新增至少一個規格'));
      } }]}>{(fields, { add, remove }, { errors }) => <>
        {fields.map(field => <div key={field.key} className="variant-editor">
          <Form.Item name={[field.name, 'id']} hidden><Input /></Form.Item>
          <Form.Item label={t('规格', 'Option', '規格')} name={[field.name, 'name']} rules={[{ required: true, whitespace: true, message: t('填写规格', 'Enter an option', '請輸入規格') }]}><Input /></Form.Item>
          <Form.Item label={t('价格（分）', 'Price (CNY cents)', '價格（人民幣分）')} name={[field.name, 'priceCents']} rules={[{ required: true, message: t('填写价格', 'Enter a price', '請輸入價格') }]}><InputNumber min={0} precision={0} /></Form.Item>
          <Form.Item label={t('可售库存', 'Available stock', '可售庫存')} name={[field.name, 'stock']} rules={[{ required: true, message: t('填写库存', 'Enter available stock', '請輸入庫存') }]}><InputNumber min={0} precision={0} /></Form.Item>
          <Button type="text" htmlType="button" aria-label={t('移除规格', 'Remove option', '移除規格')} icon={<CloseOutlined />} onClick={() => remove(field.name)} />
        </div>)}
        <Form.ErrorList errors={errors} /><Button htmlType="button" icon={<PlusOutlined />} onClick={() => add({ stock: 0 })}>{t('新增规格', 'Add option', '新增規格')}</Button>
      </>}</Form.List></fieldset>
      <Button type="primary" htmlType="submit" loading={save.isPending}>{t('保存商品', 'Save product', '儲存商品')}</Button>
    </Form>
  </Modal>;
}

function AdminCare() {
  const { t, locale } = useLanguage();
  const { species, stages } = careLabels(t);
  const result = useQuery({ queryKey: adminCareKey, queryFn: () => api<CareRule[]>('/admin/care') });
  const [current, setCurrent] = useState<CareRule | null | undefined>(undefined);
  return <section>
    <div className="admin-toolbar"><h2>{t('照护卡片', 'Care cards', '照顧卡片')}</h2><Button type="primary" icon={<PlusOutlined />} onClick={() => setCurrent(null)}>{t('新建内容', 'New care card', '新增卡片')}</Button></div>
    <Feedback error={result.error} />{result.isPending && <Loading />}
    {result.data?.length === 0 && <EmptyState title={t('暂无照护内容', 'No care guidance yet', '暫無照顧內容')} />}
    <div className="admin-records">{result.data?.map(card => <article className="admin-row" key={card.id}>
      <div><h3>{localizeSeedText(card.title, locale)}</h3><p>{species[card.species]} · {stages[card.stage]}{card.breed && ` · ${card.breed}`}</p></div>
      <Tag color={card.published ? 'green' : undefined}>{card.published ? t('已发布', 'Published', '已發佈') : t('草稿', 'Draft', '草稿')}</Tag><Button onClick={() => setCurrent(card)}>{t('编辑', 'Edit', '編輯')}</Button>
    </article>)}</div>
    {current !== undefined && <CareEditor card={current} close={() => setCurrent(undefined)} />}
  </section>;
}

function CareEditor({ card, close }: { card: CareRule | null; close: () => void }) {
  const { t, locale } = useLanguage();
  const { species, stages } = careLabels(t);
  const client = useQueryClient();
  const products = useQuery({ queryKey: adminProductsKey, queryFn: () => api<Product[]>('/admin/products') });
  const save = useMutation({
    mutationFn: (values: CareRule) => api<CareRule>(card ? `/admin/care/${card.id}` : '/admin/care', card ? 'PUT' : 'POST', values),
    onSuccess: async () => {
      await Promise.all([client.invalidateQueries({ queryKey: adminCareKey }), client.invalidateQueries({ queryKey: ['care'] })]);
      close();
    },
  });
  return <Modal title={card ? t('编辑照护内容', 'Edit care guidance', '編輯照顧內容') : t('新建照护内容', 'New care guidance', '新增照顧內容')} open onCancel={close} width={740} footer={null}>
    <Feedback error={save.error || products.error} />
    <Form layout="vertical" onFinish={values => save.mutate(values)} initialValues={card || { species: 'ALL', stage: 'ALL', published: false }}>
      <Form.Item label={t('标题', 'Title', '標題')} name="title" rules={[{ required: true, whitespace: true, message: t('请输入标题', 'Enter a title', '請輸入標題') }, { max: 150 }]}><Input /></Form.Item>
      <Form.Item label={t('简要说明', 'Summary', '簡要說明')} name="summary" rules={[{ required: true, whitespace: true, message: t('请输入说明', 'Enter a summary', '請輸入說明') }, { max: 500 }]}><Input /></Form.Item>
      <Form.Item label={t('正文', 'Body', '內文')} name="body" rules={[{ required: true, whitespace: true, message: t('请输入正文', 'Enter the main text', '請輸入內文') }, { max: 6000 }]}><Input.TextArea rows={4} /></Form.Item>
      <div className="form-grid">
        <Form.Item label={t('物种', 'Species', '物種')} name="species"><Select options={Object.entries(species).map(([value, label]) => ({ value, label }))} /></Form.Item>
        <Form.Item label={t('生命阶段', 'Life stage', '生命階段')} name="stage"><Select options={Object.entries(stages).map(([value, label]) => ({ value, label }))} /></Form.Item>
        <Form.Item label={t('品种', 'Breed', '品種')} name="breed"><Input placeholder={t('留空则适用于该物种所有品种', 'Leave blank to apply to all breeds of this species', '留空即適用於此物種的所有品種')} /></Form.Item>
        <Form.Item label={t('关联商品', 'Related product', '相關商品')} name="productId" normalize={value => value ?? null}><Select allowClear showSearch optionFilterProp="label" options={products.data?.map(product => ({ value: product.id, label: `${localizeSeedText(product.name, locale)}${product.active ? '' : ` · ${t('已下架', 'Unlisted', '已下架')}`}` }))} /></Form.Item>
      </div>
      <Form.Item label={t('参考资料链接', 'Reference URL', '參考資料連結')} name="sourceUrl" rules={[{ required: true, type: 'url', message: t('请输入有效的参考资料链接', 'Enter a valid reference URL', '請輸入有效的參考資料連結') }, { max: 1000 }]}><Input type="url" placeholder="https://" /></Form.Item>
      <Form.Item label={t('发布', 'Publish', '發佈')} name="published" valuePropName="checked"><Switch /></Form.Item>
      <Button type="primary" htmlType="submit" loading={save.isPending}>{t('保存内容', 'Save guidance', '儲存內容')}</Button>
    </Form>
  </Modal>;
}

function AdminOrders() {
  const { t, locale } = useLanguage();
  const result = useQuery({ queryKey: adminOrdersKey, queryFn: () => api<Order[]>('/admin/orders') });
  const [current, setCurrent] = useState<number>();
  const order = result.data?.find(item => item.id === current);
  return <section>
    <div className="admin-toolbar"><h2>{t('订单', 'Orders', '訂單')}</h2></div>
    <Feedback error={result.error} />{result.isPending && <Loading />}
    {result.data?.length === 0 && <EmptyState title={t('暂无订单', 'No orders yet', '暫無訂單')} />}
    <div className="admin-records">{result.data?.map(item => <article className="admin-row" key={item.id}>
      <div><h3>{t(`订单 ${item.id}`, `Order ${item.id}`, `訂單 ${item.id}`)} · {item.recipient}</h3><p>{formatDate(item.createdAt, locale)} · {formatPrice(item.totalCents, locale)}</p></div>
      <OrderStatus order={item} /><Button onClick={() => setCurrent(item.id)}>{t('查看详情', 'View details', '查看詳情')}</Button>
    </article>)}</div>
    {order && <AdminOrderDetail key={order.id} order={order} close={() => setCurrent(undefined)} />}
  </section>;
}

function AdminOrderDetail({ order, close }: { order: Order; close: () => void }) {
  const { t, locale } = useLanguage();
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
  return <Modal title={t(`订单 ${order.id}`, `Order ${order.id}`, `訂單 ${order.id}`)} open onCancel={close} footer={null} width={740}>
    <Feedback error={change.error} /><OrderStatus order={order} />
    <p className="admin-recipient">{order.recipient} · {order.phone} · {order.address}</p>
    <div className="summary-lines">{order.items.map(item => <div key={item.id}><OrderLine item={item} />
      <div className="order-actions product-action-row">
        <Link className="text-link" to={`/shop/${item.productId}`}>{t('查看原商品', 'View product', '查看商品')}</Link>
        {canShip && item.productionStatus === 'QUEUED' && <Button disabled={change.isPending} onClick={() => change.mutate({ kind: 'production', payload: { itemId: item.id, status: 'IN_PRODUCTION' } })}>{t('开始制作', 'Start production', '開始製作')}</Button>}
        {canShip && item.productionStatus === 'IN_PRODUCTION' && <Button disabled={change.isPending} onClick={() => change.mutate({ kind: 'production', payload: { itemId: item.id, status: 'READY' } })}>{t('确认制作完成', 'Mark production complete', '確認製作完成')}</Button>}
      </div>
    </div>)}</div>
    {!!order.shipments.length && <div className="shipment-list"><h3>{t('包裹', 'Shipments', '貨件')}</h3>{order.shipments.map(shipment => <div key={shipment.id}>{shipment.carrier} · {shipment.trackingNo}</div>)}</div>}
    {canShip && !!shippable.length && <section className="admin-order-action"><h3>{t('录入发货信息', 'Enter shipment details', '輸入寄件資料')}</h3>
      <Form key={shipVersion} initialValues={{ itemIds: shippable.map(item => item.id) }} layout="vertical" onFinish={payload => change.mutate({ kind: 'ship', payload })}>
        <Form.Item label={t('本包裹商品', 'Items in this shipment', '此貨件的商品')} name="itemIds" rules={[{ required: true, message: t('请选择至少一件商品', 'Select at least one item', '請選擇至少一件商品') }]}><Checkbox.Group options={shippable.map(item => ({ label: `${localizeSeedText(item.productName, locale)} · ${localizeSeedText(item.variantName, locale)}`, value: item.id }))} /></Form.Item>
        <div className="form-grid"><Form.Item label={t('承运方', 'Carrier', '物流公司')} name="carrier" rules={[{ required: true, whitespace: true, message: t('请输入承运方', 'Enter the carrier', '請輸入物流公司名稱') }]}><Input /></Form.Item>
        <Form.Item label={t('运单号', 'Tracking number', '物流追蹤編號')} name="trackingNo" rules={[{ required: true, whitespace: true, message: t('请输入运单号', 'Enter the tracking number', '請輸入物流追蹤編號') }]}><Input /></Form.Item></div>
        <Button type="primary" htmlType="submit" loading={change.isPending}>{t('确认发货', 'Confirm shipment', '確認寄出')}</Button>
      </Form>
    </section>}
    {order.status === 'REFUND_REQUESTED' && <section className="admin-order-action"><h3>{t('退款申请', 'Refund request', '退款申請')}</h3><p className="prose">{order.refundReason}</p><div className="order-actions">
      <Button type="primary" loading={change.isPending} onClick={() => change.mutate({ kind: 'refund', payload: { approve: true } })}>{t('通过退款', 'Approve refund', '批准退款')}</Button>
      <Button disabled={change.isPending} onClick={() => change.mutate({ kind: 'refund', payload: { approve: false } })}>{t('拒绝退款', 'Decline refund', '拒絕退款')}</Button>
    </div></section>}
  </Modal>;
}

function AdminAudit() {
  const { t, locale } = useLanguage();
  const auditActionNames: Record<string, string> = {
    CREATE: t('新建照护内容', 'Created care guidance', '新增照顧內容'), UPDATE: t('更新照护内容', 'Updated care guidance', '更新照顧內容'),
    CREATE_PRODUCT: t('新建商品', 'Created product', '新增商品'), UPDATE_PRODUCT: t('更新商品', 'Updated product', '更新商品'),
    SHIP_ORDER: t('录入发货', 'Recorded shipment', '記錄寄件'), UPDATE_PRODUCTION: t('更新制作进度', 'Updated production status', '更新製作進度'),
    APPROVE_REFUND: t('通过退款', 'Approved refund', '批准退款'), REJECT_REFUND: t('拒绝退款', 'Declined refund', '拒絕退款'),
  };
  const auditSubjects: Record<string, string> = { CARE_CARD: t('照护卡片', 'Care card', '照顧卡片'), PRODUCT: t('商品', 'Product', '商品'), ORDER: t('订单', 'Order', '訂單') };
  const result = useQuery({ queryKey: ['admin', 'audit'], queryFn: () => api<{
    id: number; operatorName: string; action: string; subjectType: string; subjectId: number; createdAt: string;
  }[]>('/admin/audit') });
  return <section>
    <div className="admin-toolbar"><h2>{t('最近操作', 'Recent activity', '最近操作')}</h2></div>
    <Feedback error={result.error} />{result.isPending && <Loading />}
    {result.data?.length === 0 && <EmptyState title={t('暂无操作记录', 'No activity yet', '暫無操作記錄')} />}
    {!!result.data?.length && <div className="admin-records">{result.data.map(event => <article className="admin-row" key={event.id}><div>
      <h3>{auditActionNames[event.action] || event.action}</h3><p>{event.operatorName} · {auditSubjects[event.subjectType] || event.subjectType} {event.subjectId}</p>
    </div><time dateTime={event.createdAt}>{formatDate(event.createdAt, locale)}</time></article>)}</div>}
  </section>;
}
