import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Checkbox, Form, Input, Modal, Popconfirm, Tag } from 'antd';
import { DeleteOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons';
import { ApiError, api } from '../api';
import { sessionKey, useSession } from '../auth';
import { orderStatusNames, type CartItem, type DirectCheckout, type Order, type OrderItem } from '../types';
import { ButtonLink, EmptyState, Feedback, formatDate, formatPrice, Loading, MediaImage, PageIntro } from '../ui';
import { cartKey } from '../queries';

export const ordersKey = ['orders'] as const;
const productionNames = { AWAITING_PAYMENT: '付款后制作', QUEUED: '等待制作', IN_PRODUCTION: '制作中', READY: '制作完成', CANCELLED: '已取消制作', NOT_REQUIRED: '' };

function useCart(enabled = true) {
  return useQuery({ queryKey: cartKey, queryFn: () => api<CartItem[]>('/cart'), enabled });
}

export function Cart() {
  const result = useCart();
  const [excluded, setExcluded] = useState<number[]>([]);
  const client = useQueryClient();
  const selected = result.data?.filter(item => item.active && item.stock >= item.quantity && !excluded.includes(item.id)) ?? [];
  const edit = useMutation({
    mutationFn: ({ id, quantity }: { id: number; quantity?: number }) => quantity === undefined ? api<void>(`/cart/${id}`, 'DELETE') : api<void>(`/cart/${id}`, 'PUT', { quantity }),
    onSuccess: () => client.invalidateQueries({ queryKey: cartKey }),
  });
  return <main className="page-shell">
    <PageIntro title="购物袋" description="在结算前核对规格、数量和定制内容。"><ButtonLink to="/shop" secondary>继续逛商城</ButtonLink></PageIntro>
    <Feedback error={result.error || edit.error} />
    {result.isPending && <Loading />}
    {result.data?.length === 0 && <EmptyState title="购物袋空空的"><ButtonLink to="/shop">去商城看看</ButtonLink></EmptyState>}
    {!!result.data?.length && <div className="checkout-layout">
      <section className="form-surface cart-items" aria-label="购物袋商品">{result.data.map(item => {
        const available = item.active && item.stock >= item.quantity;
        return <article className="cart-row" key={item.id}>
          <Checkbox aria-label={`选择 ${item.productName} 结算`} disabled={!available} checked={available && !excluded.includes(item.id)} onChange={event => setExcluded(ids => event.target.checked ? ids.filter(id => id !== item.id) : [...ids, item.id])} />
          <MediaImage src={item.imageUrl} alt="" className="order-image" />
          <div className="cart-description">
            <Link to={`/shop/${item.productId}`}><h2>{item.productName}</h2></Link><p>{item.variantName} · {formatPrice(item.priceCents)}</p>
            {item.customText && <p className="prose">定制文字：{item.customText}</p>}
            {item.customPhotoUrl && <MediaImage src={item.customPhotoUrl} alt="已选定制照片" className="custom-thumbnail" />}
            {!available && <Tag color="orange">{item.active ? '库存不足' : '已下架'}</Tag>}
          </div>
          <div className="cart-row-actions">
            <div className="quantity-stepper" aria-label="商品数量"><Button aria-label="减少数量" icon={<MinusOutlined />} disabled={edit.isPending || !item.active || item.quantity <= 1} onClick={() => edit.mutate({ id: item.id, quantity: item.quantity - 1 })} /><span>{item.quantity}</span><Button aria-label="增加数量" icon={<PlusOutlined />} disabled={edit.isPending || !available || item.quantity >= Math.min(99, item.stock)} onClick={() => edit.mutate({ id: item.id, quantity: item.quantity + 1 })} /></div>
            <Button type="text" aria-label={`移除 ${item.productName}`} icon={<DeleteOutlined />} disabled={edit.isPending} onClick={() => edit.mutate({ id: item.id })} />
          </div>
        </article>;
      })}</section>
      <aside className="form-surface order-summary">
        <h2>已选商品</h2><p>{selected.reduce((sum, item) => sum + item.quantity, 0)} 件</p>
        <div className="summary-total"><span>商品小计</span><strong>{formatPrice(selected.reduce((sum, item) => sum + item.quantity * item.priceCents, 0))}</strong></div>
        {!!selected.length ? <Link className="button button-primary full-button" to={`/checkout?cart=${selected.map(item => item.id).join(',')}`}>去结算</Link> : <Button type="primary" disabled className="full-button">去结算</Button>}
      </aside>
    </div>}
  </main>;
}

type Address = { recipient: string; phone: string; address: string };
type Quote = Pick<Order, 'subtotalCents' | 'shippingCents' | 'totalCents'>;

export function Checkout() {
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
  if (!hasSelection) return <main className="page-shell"><EmptyState title="找不到待结算的商品"><ButtonLink to={cartIds.length ? '/cart' : '/shop'}>{cartIds.length ? '返回购物袋' : '返回商城'}</ButtonLink></EmptyState></main>;
  return <main className="page-shell">
    <PageIntro title="确认订单" description="提交前确认收货信息和定制内容。" />
    <div className="checkout-layout">
      <section className="form-surface"><h2>收货信息</h2><Feedback error={place.error} />
        <Form layout="vertical" onFinish={address => {
          if (quoted && quote.data && !place.isPending) place.mutate({ address, expectedTotalCents: quote.data.totalCents });
        }}>
          <Form.Item label="收货人" name="recipient" rules={[{ required: true, whitespace: true, message: '请输入收货人' }, { max: 60 }]}><Input autoComplete="name" /></Form.Item>
          <Form.Item label="联系电话" name="phone" rules={[{ required: true, whitespace: true, message: '请输入联系电话' }, { max: 32 }]}><Input type="tel" autoComplete="tel" /></Form.Item>
          <Form.Item label="详细地址" name="address" rules={[{ required: true, whitespace: true, message: '请输入详细地址' }, { max: 300 }]}><Input.TextArea rows={3} autoComplete="street-address" /></Form.Item>
          <Button type="primary" htmlType="submit" loading={place.isPending} disabled={!quoted}>提交订单</Button>
        </Form>
      </section>
      <aside className="form-surface order-summary"><h2>订单商品</h2>
        <div className="summary-lines">{lines.map((item, index) => <div className="summary-line" key={`${item.variantId}-${index}`}>
          <strong>{item.productName}</strong><p>{item.variantName} · {item.quantity} 件</p>
          {item.customText && <p className="prose">定制文字：{item.customText}</p>}
          {item.customPhotoUrl && <MediaImage src={item.customPhotoUrl} alt="已选定制照片" className="custom-thumbnail" />}
        </div>)}</div>
        <Feedback error={quote.error} />
        {quote.isFetching && <Loading />}
        {quote.isError && !quote.isFetching && <Button onClick={() => void quote.refetch()}>重新核对金额</Button>}
        {quoted && quote.data && <>
          <div className="summary-total"><span>商品小计</span><strong>{formatPrice(quote.data.subtotalCents)}</strong></div>
          <div className="summary-total"><span>运费</span><strong>{formatPrice(quote.data.shippingCents)}</strong></div>
          <div className="summary-total"><span>合计</span><strong>{formatPrice(quote.data.totalCents)}</strong></div>
        </>}
      </aside>
    </div>
  </main>;
}

export function Orders() {
  const result = useQuery({ queryKey: ordersKey, queryFn: () => api<Order[]>('/orders') });
  return <main className="page-shell">
    <PageIntro title="我的订单" description="查看付款、制作、物流与售后进度。" />
    <Feedback error={result.error} />{result.isPending && <Loading />}
    {result.data?.length === 0 && <EmptyState title="暂无订单"><ButtonLink to="/shop">浏览商城</ButtonLink></EmptyState>}
    <div className="order-list">{result.data?.map(order => <Link className="order-list-item" key={order.id} to={`/orders/${order.id}`}>
      <div><strong>{order.items.map(item => item.productName).join('、')}</strong><p>订单 {order.id} · {formatDate(order.createdAt)}</p></div><OrderStatus order={order} /><strong>{formatPrice(order.totalCents)}</strong>
    </Link>)}</div>
  </main>;
}

export function OrderStatus({ order }: { order: Order }) {
  const color = order.status === 'PENDING_PAYMENT' || order.status === 'REFUND_REQUESTED' ? 'gold' : ['PAID', 'PARTIALLY_SHIPPED', 'SHIPPED', 'COMPLETED'].includes(order.status) ? 'green' : undefined;
  return <Tag color={color}>{orderStatusNames[order.status] || order.status}</Tag>;
}

export function OrderLine({ item }: { item: OrderItem }) {
  return <article className="summary-line">
    <strong>{item.productName}</strong><p>{item.variantName} · {item.quantity} 件 · {formatPrice(item.priceCents * item.quantity)}</p>
    {item.productionStatus && productionNames[item.productionStatus] && <Tag>{productionNames[item.productionStatus]}</Tag>}
    {item.customText && <p className="prose">定制文字：{item.customText}</p>}
    {item.customPhotoUrl && <MediaImage src={item.customPhotoUrl} alt="订单定制照片" className="custom-thumbnail" />}
  </article>;
}

export function UserOrder() {
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
  if (result.error) return <main className="page-shell"><Feedback error={result.error} /><ButtonLink to="/orders" secondary>返回我的订单</ButtonLink></main>;
  const order = result.data;
  return <main className="page-shell">
    <Link className="back-link" to="/orders">返回我的订单</Link>
    <PageIntro title={`订单 ${order.id}`} description={formatDate(order.createdAt)}><OrderStatus order={order} /></PageIntro>
    <Feedback error={action.error} />
    <div className="checkout-layout">
      <section className="form-surface"><h2>订单商品</h2><div className="summary-lines">{order.items.map(item => <OrderLine item={item} key={item.id} />)}</div>
        {!!order.shipments.length && <div className="shipment-list"><h2>包裹物流</h2>{order.shipments.map(shipment => <div key={shipment.id}><strong>{shipment.carrier} · {shipment.trackingNo}</strong><p>{formatDate(shipment.shippedAt)}</p><p>{order.items.filter(item => item.shipmentId === shipment.id).map(item => item.productName).join('、')}</p></div>)}</div>}
      </section>
      <aside className="form-surface order-summary"><h2>收货信息</h2><p>{order.recipient} · {order.phone}</p><p className="prose">{order.address}</p>
        <div className="summary-total"><span>商品</span><strong>{formatPrice(order.subtotalCents)}</strong></div>
        <div className="summary-total"><span>运费</span><strong>{formatPrice(order.shippingCents)}</strong></div>
        <div className="summary-total"><span>订单合计</span><strong>{formatPrice(order.totalCents)}</strong></div>
        {order.expiresAt && order.status === 'PENDING_PAYMENT' && <p className="form-hint">请在 {formatDate(order.expiresAt)} 前完成付款。</p>}
        {order.refundReason && <p className="prose">退款申请：{order.refundReason}</p>}
        <div className="order-actions">
          {order.status === 'PENDING_PAYMENT' && <><Button type="primary" loading={action.isPending} onClick={() => action.mutate({ kind: 'pay' })}>模拟支付</Button><Popconfirm title="取消这笔订单？" okText="取消订单" cancelText="返回" onConfirm={() => action.mutate({ kind: 'cancel' })}><Button disabled={action.isPending}>取消订单</Button></Popconfirm></>}
          {order.status === 'SHIPPED' && <Popconfirm title="确认所有包裹已经收到？" okText="确认收货" cancelText="返回" onConfirm={() => action.mutate({ kind: 'receive' })}><Button type="primary" loading={action.isPending}>确认收货</Button></Popconfirm>}
          {['PAID', 'PARTIALLY_SHIPPED', 'SHIPPED', 'COMPLETED'].includes(order.status) && <Button disabled={action.isPending} onClick={() => { action.reset(); setRefundOpen(true); }}>申请退款</Button>}
        </div>
      </aside>
    </div>
    <Modal title="申请退款" open={refundOpen} onCancel={() => setRefundOpen(false)} footer={null} destroyOnHidden>
      <Feedback error={action.error} />
      <Form layout="vertical" onFinish={values => action.mutate({ kind: 'refund', reason: values.reason })}>
        <Form.Item name="reason" label="退款原因" rules={[{ required: true, whitespace: true, message: '请填写退款原因' }, { max: 500 }]}><Input.TextArea rows={3} /></Form.Item>
        <Button type="primary" htmlType="submit" loading={action.isPending}>提交申请</Button>
      </Form>
    </Modal>
  </main>;
}
