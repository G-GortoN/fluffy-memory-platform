import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Checkbox, Form, Input, Modal, Popconfirm, Tag } from 'antd';
import { DeleteOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons';
import { ApiError, api } from '../api';
import { sessionKey, useSession } from '../auth';
import { useLanguage } from '../language';
import { orderStatusLabels, productionLabels } from '../locales/commerce';
import { localizeSeedText } from '../localized-content';
import type { CartItem, DirectCheckout, Order, OrderItem } from '../types';
import { ButtonLink, EmptyState, Feedback, formatDate, formatPrice, Loading, MediaImage, PageIntro } from '../ui';
import { cartKey } from '../queries';

export const ordersKey = ['orders'] as const;

function useCart(enabled = true) {
  return useQuery({ queryKey: cartKey, queryFn: () => api<CartItem[]>('/cart'), enabled });
}

export function Cart() {
  const { t, locale } = useLanguage();
  const result = useCart();
  const [excluded, setExcluded] = useState<number[]>([]);
  const client = useQueryClient();
  const selected = result.data?.filter(item => item.active && item.stock >= item.quantity && !excluded.includes(item.id)) ?? [];
  const quantity = selected.reduce((sum, item) => sum + item.quantity, 0);
  const edit = useMutation({
    mutationFn: ({ id, quantity }: { id: number; quantity?: number }) => quantity === undefined ? api<void>(`/cart/${id}`, 'DELETE') : api<void>(`/cart/${id}`, 'PUT', { quantity }),
    onSuccess: () => client.invalidateQueries({ queryKey: cartKey }),
  });
  return <main className="page-shell">
    <PageIntro title={t('购物袋', 'Shopping bag', '購物袋')} description={t('在结算前核对规格、数量和定制内容。', 'Review your options, quantities and custom details before checkout.', '結帳前請核對規格、數量及訂製內容。')}><ButtonLink to="/shop" secondary>{t('继续逛商城', 'Continue shopping', '繼續購物')}</ButtonLink></PageIntro>
    <Feedback error={result.error || edit.error} />
    {result.isPending && <Loading />}
    {result.data?.length === 0 && <EmptyState title={t('购物袋空空的', 'Your bag is empty', '購物袋是空的')}><ButtonLink to="/shop">{t('去商城看看', 'Browse the shop', '瀏覽商店')}</ButtonLink></EmptyState>}
    {!!result.data?.length && <div className="checkout-layout">
      <section className="form-surface cart-items" aria-label={t('购物袋商品', 'Items in your bag', '購物袋商品')}>{result.data.map(item => {
        const available = item.active && item.stock >= item.quantity;
        const productName = localizeSeedText(item.productName, locale);
        return <article className="cart-row" key={item.id}>
          <Checkbox aria-label={t(`选择 ${productName} 结算`, `Select ${productName} for checkout`, `選擇 ${productName} 結帳`)} disabled={!available} checked={available && !excluded.includes(item.id)} onChange={event => setExcluded(ids => event.target.checked ? ids.filter(id => id !== item.id) : [...ids, item.id])} />
          <MediaImage src={item.imageUrl} alt="" className="order-image" />
          <div className="cart-description">
            <Link to={`/shop/${item.productId}`}><h2>{productName}</h2></Link><p>{localizeSeedText(item.variantName, locale)} · {formatPrice(item.priceCents, locale)}</p>
            {item.customText && <p className="prose">{t(`定制文字：${item.customText}`, `Custom text: ${item.customText}`, `訂製文字：${item.customText}`)}</p>}
            {item.customPhotoUrl && <MediaImage src={item.customPhotoUrl} alt={t('已选定制照片', 'Selected custom photo', '已選訂製相片')} className="custom-thumbnail" />}
            {!available && <Tag color="orange">{item.active ? t('库存不足', 'Insufficient stock', '庫存不足') : t('已下架', 'Unavailable', '已下架')}</Tag>}
          </div>
          <div className="cart-row-actions">
            <div className="quantity-stepper" aria-label={t('商品数量', 'Item quantity', '商品數量')}><Button aria-label={t('减少数量', 'Decrease quantity', '減少數量')} icon={<MinusOutlined />} disabled={edit.isPending || !item.active || item.quantity <= 1} onClick={() => edit.mutate({ id: item.id, quantity: item.quantity - 1 })} /><span>{item.quantity}</span><Button aria-label={t('增加数量', 'Increase quantity', '增加數量')} icon={<PlusOutlined />} disabled={edit.isPending || !available || item.quantity >= Math.min(99, item.stock)} onClick={() => edit.mutate({ id: item.id, quantity: item.quantity + 1 })} /></div>
            <Button type="text" aria-label={t(`移除 ${productName}`, `Remove ${productName}`, `移除 ${productName}`)} icon={<DeleteOutlined />} disabled={edit.isPending} onClick={() => edit.mutate({ id: item.id })} />
          </div>
        </article>;
      })}</section>
      <aside className="form-surface order-summary">
        <h2>{t('已选商品', 'Selected items', '已選商品')}</h2><p>{t(`${quantity} 件`, `${quantity} ${quantity === 1 ? 'item' : 'items'}`, `${quantity} 件`)}</p>
        <div className="summary-total"><span>{t('商品小计', 'Subtotal', '商品小計')}</span><strong>{formatPrice(selected.reduce((sum, item) => sum + item.quantity * item.priceCents, 0), locale)}</strong></div>
        {!!selected.length ? <Link className="button button-primary full-button" to={`/checkout?cart=${selected.map(item => item.id).join(',')}`}>{t('去结算', 'Check out', '前往結帳')}</Link> : <Button type="primary" disabled className="full-button">{t('去结算', 'Check out', '前往結帳')}</Button>}
      </aside>
    </div>}
  </main>;
}

type Address = { recipient: string; phone: string; address: string };
type Quote = Pick<Order, 'subtotalCents' | 'shippingCents' | 'totalCents'>;

export function Checkout() {
  const { t, locale } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const client = useQueryClient();
  const { data: account } = useSession();
  const directState = location.state as DirectCheckout | null;
  const direct = account && directState?.accountId === account.id ? directState : null;
  const cartIds = new URLSearchParams(location.search).get('cart')?.split(',').map(Number).filter(id => Number.isSafeInteger(id) && id > 0) ?? [];
  const result = useCart(!direct?.item && !!cartIds.length);
  const cartItems = result.data?.filter(item => cartIds.includes(item.id)) ?? [];
  const lines = direct?.item ? [{ ...direct.item, productName: direct.productName, variantName: direct.variantName }] : cartItems;
  const source = direct?.item ? { items: [direct.item] } : { cartIds };
  const hasSelection = !!direct?.item || (cartIds.length > 0 && cartItems.length === cartIds.length);
  // Requote if a cart row changes while this tab is open, even if its ID stays the same.
  const quoteKey = ['checkout-quote', account?.id, location.key, source, cartItems.map(item => [item.id, item.quantity, item.priceCents])] as const;
  const quote = useQuery({
    queryKey: quoteKey,
    queryFn: async () => {
      try {
        return await api<Quote>('/orders/quote', 'POST', source);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) void client.invalidateQueries({ queryKey: sessionKey });
        throw error;
      }
    },
    enabled: Boolean(account && hasSelection),
    refetchOnMount: 'always',
  });
  const quoted = quote.isSuccess && !quote.isFetching;
  const request = useRef<{ locationKey: string; id: string } | null>(null);
  const place = useMutation({
    mutationFn: ({ address, expectedTotalCents }: { address: Address; expectedTotalCents: number }) => {
      if (request.current?.locationKey !== location.key) request.current = { locationKey: location.key, id: crypto.randomUUID() };
      return api<Order>('/orders', 'POST', { ...source, ...address, requestId: request.current.id, expectedTotalCents });
    },
    onError: error => {
      if (error instanceof ApiError && error.status === 409) void client.invalidateQueries({ queryKey: quoteKey });
      if (error instanceof ApiError && error.status === 401) void client.invalidateQueries({ queryKey: sessionKey });
    },
    onSuccess: order => {
      void client.invalidateQueries({ queryKey: cartKey });
      void client.invalidateQueries({ queryKey: ordersKey });
      navigate(`/orders/${order.id}`, { replace: true });
    },
  });
  if (result.isLoading) return <main className="page-shell"><Loading /></main>;
  if (!direct?.item && cartIds.length && result.error) return <main className="page-shell"><Feedback error={result.error} /></main>;
  if (!hasSelection) return <main className="page-shell"><EmptyState title={t('找不到待结算的商品', 'No items found for checkout', '未找到待結帳的商品')}><ButtonLink to={cartIds.length ? '/cart' : '/shop'}>{cartIds.length ? t('返回购物袋', 'Back to bag', '返回購物袋') : t('返回商城', 'Back to shop', '返回商店')}</ButtonLink></EmptyState></main>;
  return <main className="page-shell">
    <PageIntro title={t('确认订单', 'Review your order', '確認訂單')} description={t('提交前确认收货信息和定制内容。', 'Confirm your delivery and custom details before placing the order.', '提交前請確認送貨資料及訂製內容。')} />
    <div className="checkout-layout">
      <section className="form-surface"><h2>{t('收货信息', 'Delivery details', '送貨資料')}</h2><Feedback error={place.error} />
        <Form layout="vertical" onFinish={address => {
          if (quoted && quote.data && !place.isPending) place.mutate({ address, expectedTotalCents: quote.data.totalCents });
        }}>
          <Form.Item label={t('收货人', 'Recipient', '收件人')} name="recipient" rules={[{ required: true, whitespace: true, message: t('请输入收货人', 'Enter the recipient’s name', '請輸入收件人姓名') }, { max: 60 }]}><Input autoComplete="name" /></Form.Item>
          <Form.Item label={t('联系电话', 'Phone number', '聯絡電話')} name="phone" rules={[{ required: true, whitespace: true, message: t('请输入联系电话', 'Enter a phone number', '請輸入聯絡電話') }, { max: 32 }]}><Input type="tel" autoComplete="tel" /></Form.Item>
          <Form.Item label={t('详细地址', 'Delivery address', '送貨地址')} name="address" rules={[{ required: true, whitespace: true, message: t('请输入详细地址', 'Enter the full delivery address', '請輸入完整送貨地址') }, { max: 300 }]}><Input.TextArea rows={3} autoComplete="street-address" /></Form.Item>
          <Button type="primary" htmlType="submit" loading={place.isPending} disabled={!quoted}>{t('提交订单', 'Place order', '提交訂單')}</Button>
        </Form>
      </section>
      <aside className="form-surface order-summary"><h2>{t('订单商品', 'Order items', '訂單商品')}</h2>
        <div className="summary-lines">{lines.map((item, index) => <div className="summary-line" key={`${item.variantId}-${index}`}>
          <strong>{localizeSeedText(item.productName, locale)}</strong><p>{localizeSeedText(item.variantName, locale)} · {t(`${item.quantity} 件`, `${item.quantity} ${item.quantity === 1 ? 'item' : 'items'}`, `${item.quantity} 件`)}</p>
          {item.customText && <p className="prose">{t(`定制文字：${item.customText}`, `Custom text: ${item.customText}`, `訂製文字：${item.customText}`)}</p>}
          {item.customPhotoUrl && <MediaImage src={item.customPhotoUrl} alt={t('已选定制照片', 'Selected custom photo', '已選訂製相片')} className="custom-thumbnail" />}
        </div>)}</div>
        <Feedback error={quote.error} />
        {quote.isFetching && <Loading />}
        {quote.isError && !quote.isFetching && <Button onClick={() => void quote.refetch()}>{t('重新核对金额', 'Recheck total', '重新核對金額')}</Button>}
        {quoted && quote.data && <>
          <div className="summary-total"><span>{t('商品小计', 'Subtotal', '商品小計')}</span><strong>{formatPrice(quote.data.subtotalCents, locale)}</strong></div>
          <div className="summary-total"><span>{t('运费', 'Shipping', '運費')}</span><strong>{formatPrice(quote.data.shippingCents, locale)}</strong></div>
          <div className="summary-total"><span>{t('合计', 'Total', '合計')}</span><strong>{formatPrice(quote.data.totalCents, locale)}</strong></div>
        </>}
      </aside>
    </div>
  </main>;
}

export function Orders() {
  const { t, locale } = useLanguage();
  const result = useQuery({ queryKey: ordersKey, queryFn: () => api<Order[]>('/orders') });
  return <main className="page-shell">
    <PageIntro title={t('我的订单', 'My orders', '我的訂單')} description={t('查看付款、制作、物流与售后进度。', 'Track payment, production, delivery and refund requests.', '查看付款、製作、送貨及售後進度。')} />
    <Feedback error={result.error} />{result.isPending && <Loading />}
    {result.data?.length === 0 && <EmptyState title={t('暂无订单', 'No orders yet', '暫無訂單')}><ButtonLink to="/shop">{t('浏览商城', 'Browse the shop', '瀏覽商店')}</ButtonLink></EmptyState>}
    <div className="order-list">{result.data?.map(order => <Link className="order-list-item" key={order.id} to={`/orders/${order.id}`}>
      <div><strong>{new Intl.ListFormat(locale).format(order.items.map(item => localizeSeedText(item.productName, locale)))}</strong><p>{t(`订单 ${order.id}`, `Order ${order.id}`, `訂單 ${order.id}`)} · {formatDate(order.createdAt, locale)}</p></div><OrderStatus order={order} /><strong>{formatPrice(order.totalCents, locale)}</strong>
    </Link>)}</div>
  </main>;
}

export function OrderStatus({ order }: { order: Order }) {
  const { t } = useLanguage();
  const color = order.status === 'PENDING_PAYMENT' || order.status === 'REFUND_REQUESTED' ? 'gold' : ['PAID', 'PARTIALLY_SHIPPED', 'SHIPPED', 'COMPLETED'].includes(order.status) ? 'green' : undefined;
  return <Tag color={color}>{orderStatusLabels(t)[order.status] || order.status}</Tag>;
}

export function OrderLine({ item }: { item: OrderItem }) {
  const { t, locale } = useLanguage();
  const production = item.productionStatus && productionLabels(t)[item.productionStatus];
  return <article className="summary-line">
    <strong>{localizeSeedText(item.productName, locale)}</strong><p>{localizeSeedText(item.variantName, locale)} · {t(`${item.quantity} 件`, `${item.quantity} ${item.quantity === 1 ? 'item' : 'items'}`, `${item.quantity} 件`)} · {formatPrice(item.priceCents * item.quantity, locale)}</p>
    {production && <Tag>{production}</Tag>}
    {item.customText && <p className="prose">{t(`定制文字：${item.customText}`, `Custom text: ${item.customText}`, `訂製文字：${item.customText}`)}</p>}
    {item.customPhotoUrl && <MediaImage src={item.customPhotoUrl} alt={t('订单定制照片', 'Custom order photo', '訂單的訂製相片')} className="custom-thumbnail" />}
  </article>;
}

export function UserOrder() {
  const { t, locale } = useLanguage();
  const { orderId } = useParams();
  const client = useQueryClient();
  const [refundOpen, setRefundOpen] = useState(false);
  const result = useQuery({ queryKey: [ordersKey[0], orderId], queryFn: () => api<Order>(`/orders/${orderId}`) });
  const action = useMutation({
    mutationFn: ({ kind, reason }: { kind: 'pay' | 'cancel' | 'receive' | 'refund'; reason?: string }) => api<Order>(`/orders/${orderId}/${kind}`, 'POST', reason === undefined ? undefined : { reason }),
    onSuccess: async () => {
      await Promise.all([client.invalidateQueries({ queryKey: ordersKey }), client.invalidateQueries({ queryKey: ['products'] })]);
      setRefundOpen(false);
    },
  });
  if (result.isPending) return <main className="page-shell"><Loading /></main>;
  if (result.error) return <main className="page-shell"><Feedback error={result.error} /><ButtonLink to="/orders" secondary>{t('返回我的订单', 'Back to my orders', '返回我的訂單')}</ButtonLink></main>;
  const order = result.data;
  const paymentDeadline = order.expiresAt && formatDate(order.expiresAt, locale);
  return <main className="page-shell">
    <Link className="back-link" to="/orders">{t('返回我的订单', 'Back to my orders', '返回我的訂單')}</Link>
    <PageIntro title={t(`订单 ${order.id}`, `Order ${order.id}`, `訂單 ${order.id}`)} description={formatDate(order.createdAt, locale)}><OrderStatus order={order} /></PageIntro>
    <Feedback error={action.error} />
    <div className="checkout-layout">
      <section className="form-surface"><h2>{t('订单商品', 'Order items', '訂單商品')}</h2><div className="summary-lines">{order.items.map(item => <OrderLine item={item} key={item.id} />)}</div>
        {!!order.shipments.length && <div className="shipment-list"><h2>{t('包裹物流', 'Shipment tracking', '貨件追蹤')}</h2>{order.shipments.map(shipment => <div key={shipment.id}><strong>{shipment.carrier} · {shipment.trackingNo}</strong><p>{formatDate(shipment.shippedAt, locale)}</p><p>{new Intl.ListFormat(locale).format(order.items.filter(item => item.shipmentId === shipment.id).map(item => localizeSeedText(item.productName, locale)))}</p></div>)}</div>}
      </section>
      <aside className="form-surface order-summary"><h2>{t('收货信息', 'Delivery details', '送貨資料')}</h2><p>{order.recipient} · {order.phone}</p><p className="prose">{order.address}</p>
        <div className="summary-total"><span>{t('商品', 'Items', '商品')}</span><strong>{formatPrice(order.subtotalCents, locale)}</strong></div>
        <div className="summary-total"><span>{t('运费', 'Shipping', '運費')}</span><strong>{formatPrice(order.shippingCents, locale)}</strong></div>
        <div className="summary-total"><span>{t('订单合计', 'Order total', '訂單合計')}</span><strong>{formatPrice(order.totalCents, locale)}</strong></div>
        {paymentDeadline && order.status === 'PENDING_PAYMENT' && <p className="form-hint">{t(`请在 ${paymentDeadline} 前完成付款。`, `Please complete payment by ${paymentDeadline}.`, `請在 ${paymentDeadline} 前完成付款。`)}</p>}
        {order.refundReason && <p className="prose">{t(`退款申请：${order.refundReason}`, `Refund request: ${order.refundReason}`, `退款申請：${order.refundReason}`)}</p>}
        <div className="order-actions">
          {order.status === 'PENDING_PAYMENT' && <><Button type="primary" loading={action.isPending} onClick={() => action.mutate({ kind: 'pay' })}>{t('模拟支付', 'Simulate payment', '模擬付款')}</Button><Popconfirm title={t('取消这笔订单？', 'Cancel this order?', '取消這張訂單？')} okText={t('取消订单', 'Cancel order', '取消訂單')} cancelText={t('返回', 'Go back', '返回')} onConfirm={() => action.mutate({ kind: 'cancel' })}><Button disabled={action.isPending}>{t('取消订单', 'Cancel order', '取消訂單')}</Button></Popconfirm></>}
          {order.status === 'SHIPPED' && <Popconfirm title={t('确认所有包裹已经收到？', 'Have you received all packages?', '確認已收到所有包裹？')} okText={t('确认收货', 'Confirm delivery', '確認收貨')} cancelText={t('返回', 'Go back', '返回')} onConfirm={() => action.mutate({ kind: 'receive' })}><Button type="primary" loading={action.isPending}>{t('确认收货', 'Confirm delivery', '確認收貨')}</Button></Popconfirm>}
          {['PAID', 'PARTIALLY_SHIPPED', 'SHIPPED', 'COMPLETED'].includes(order.status) && <Button disabled={action.isPending} onClick={() => { action.reset(); setRefundOpen(true); }}>{t('申请退款', 'Request a refund', '申請退款')}</Button>}
        </div>
      </aside>
    </div>
    <Modal title={t('申请退款', 'Request a refund', '申請退款')} open={refundOpen} onCancel={() => setRefundOpen(false)} footer={null} destroyOnHidden>
      <Feedback error={action.error} />
      <Form layout="vertical" onFinish={values => action.mutate({ kind: 'refund', reason: values.reason })}>
        <Form.Item name="reason" label={t('退款原因', 'Reason for the refund', '退款原因')} rules={[{ required: true, whitespace: true, message: t('请填写退款原因', 'Enter a reason for the refund', '請輸入退款原因') }, { max: 500 }]}><Input.TextArea rows={3} /></Form.Item>
        <Button type="primary" htmlType="submit" loading={action.isPending}>{t('提交申请', 'Submit request', '提交申請')}</Button>
      </Form>
    </Modal>
  </main>;
}
