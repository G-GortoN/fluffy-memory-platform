import { lazy, Suspense, useEffect } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Badge, Dropdown, type MenuProps } from 'antd';
import { DownOutlined, GlobalOutlined, LogoutOutlined, SettingOutlined, ShoppingOutlined, UnorderedListOutlined, UserOutlined } from '@ant-design/icons';
import { api } from './api';
import { RequireSession, useSession, useSetSession } from './auth';
import type { CartItem } from './types';
import { Brand, ButtonLink, EmptyState, Feedback, Loading } from './ui';
import { cartKey } from './queries';
import { Home } from './pages/Home';
import { locales, useLanguage, type Locale, type Translate } from './language';

const Admin = lazy(() => import('./pages/Admin').then(module => ({ default: module.Admin })));
const Memories = lazy(() => import('./pages/Memories').then(module => ({ default: module.Memories })));
const MemorialDetail = lazy(() => import('./pages/Memories').then(module => ({ default: module.MemorialDetail })));
const MemorialEditor = lazy(() => import('./pages/Memories').then(module => ({ default: module.MemorialEditor })));
const Cart = lazy(() => import('./pages/Orders').then(module => ({ default: module.Cart })));
const Checkout = lazy(() => import('./pages/Orders').then(module => ({ default: module.Checkout })));
const Orders = lazy(() => import('./pages/Orders').then(module => ({ default: module.Orders })));
const UserOrder = lazy(() => import('./pages/Orders').then(module => ({ default: module.UserOrder })));
const Pets = lazy(() => import('./pages/Pets').then(module => ({ default: module.Pets })));
const PetDetail = lazy(() => import('./pages/Pets').then(module => ({ default: module.PetDetail })));
const PetEditor = lazy(() => import('./pages/Pets').then(module => ({ default: module.PetEditor })));
const ProductDetail = lazy(() => import('./pages/Shop').then(module => ({ default: module.ProductDetail })));
const Shop = lazy(() => import('./pages/Shop').then(module => ({ default: module.Shop })));
const SignIn = lazy(() => import('./pages/SignIn').then(module => ({ default: module.SignIn })));

const navigation = (t: Translate) => [
  { to: '/', label: t('首页', 'Home', '主頁') },
  { to: '/pets', label: t('宠物照护', 'Pet care', '寵物護理') },
  { to: '/memories', label: t('纪念空间', 'Memories', '紀念空間') },
  { to: '/shop', label: t('周边商城', 'Shop', '網上商店') },
];

function LanguageMenu() {
  const { locale, setLocale, t } = useLanguage();
  const items: MenuProps['items'] = (Object.keys(locales) as Locale[]).map(key => ({
    key, label: <span lang={locales[key].html}>{locales[key].label}</span>, onClick: () => setLocale(key),
  }));
  return <Dropdown menu={{ items, selectable: true, selectedKeys: [locale] }} trigger={['click']} placement="bottomRight">
    <button type="button" className="nav-language" aria-label={t('切换语言', 'Change language', '切換語言')}>
      <GlobalOutlined /><span>{locales[locale].short}</span>
    </button>
  </Dropdown>;
}

function Header() {
  const { t } = useLanguage();
  const { data: account } = useSession();
  const setSession = useSetSession();
  const navigate = useNavigate();
  const logout = useMutation({
    mutationFn: () => api<void>('/auth/logout', 'POST'),
    onSuccess: async () => { await setSession(null); navigate('/'); },
  });
  const cart = useQuery({ queryKey: cartKey, queryFn: () => api<CartItem[]>('/cart'), enabled: Boolean(account) });
  const quantity = account ? cart.data?.reduce((sum, item) => sum + item.quantity, 0) : 0;
  const accountMenu: MenuProps['items'] = [
    { key: 'pets', label: <Link to="/pets">{t('我的宠物', 'My pets', '我的寵物')}</Link>, icon: <UserOutlined /> },
    { key: 'orders', label: <Link to="/orders">{t('我的订单', 'My orders', '我的訂單')}</Link>, icon: <UnorderedListOutlined /> },
    ...(account?.role === 'ADMIN' ? [{ key: 'admin', label: <Link to="/admin">{t('运营后台', 'Admin', '管理後台')}</Link>, icon: <SettingOutlined /> }] : []),
    { type: 'divider' },
    { key: 'logout', label: t('退出登录', 'Sign out', '登出'), icon: <LogoutOutlined />, onClick: () => logout.mutate(), disabled: logout.isPending },
  ];
  return <header className="site-header">
    <div className="nav-inner">
      <Brand />
      <nav className="primary-nav" aria-label={t('主导航', 'Main navigation', '主導覽')}>{navigation(t).map(item => <NavLink key={item.to} to={item.to} end={item.to === '/'}>{item.label}</NavLink>)}</nav>
      <div className="nav-actions">
        <LanguageMenu />
        <Link to="/cart" className="nav-bag" aria-label={t('购物袋', 'Shopping bag', '購物袋')}><Badge count={quantity}><ShoppingOutlined /></Badge></Link>
        {account ? <Dropdown menu={{ items: accountMenu }} trigger={['click']} placement="bottomRight">
          <button type="button" className="nav-account" aria-label={t('我的账号', 'My account', '我的帳戶')}><UserOutlined /><span>{account.name}</span><DownOutlined className="nav-chevron" /></button>
        </Dropdown> : <Link to="/login" className="nav-account" aria-label={t('登录', 'Sign in', '登入')}><UserOutlined /><span>{t('登录', 'Sign in', '登入')}</span></Link>}
      </div>
    </div>
    {logout.error && <div className="nav-error"><Feedback error={logout.error} /></div>}
  </header>;
}

function Footer() {
  const { t } = useLanguage();
  return <footer className="site-footer"><div className="footer-inner"><Brand /><nav aria-label={t('页脚导航', 'Footer navigation', '頁尾導覽')}>
    {navigation(t).slice(1).map(item => <Link to={item.to} key={item.to}>{item.label}</Link>)}
  </nav></div></footer>;
}

export function App() {
  const { locale, t } = useLanguage();
  const location = useLocation();
  const shared = location.pathname.startsWith('/memories/shared/');
  const title = location.pathname === '/' ? t('Fluffy Memory · 宠物照护与纪念', 'Fluffy Memory · Pet care and remembrance', 'Fluffy Memory · 寵物護理與紀念') : 'Fluffy Memory';
  const description = t('记录宠物的日常照护，收藏回忆，选购用品。', 'Look after your pets, keep their memories close, and shop for everyday essentials.', '記錄寵物的日常護理，珍藏回憶，選購用品。');
  useEffect(() => {
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  }, [title, description]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return <div className="site-shell" lang={locale}>
    {shared ? <div className="shared-language"><LanguageMenu /></div> : <Header />}
    <Suspense fallback={<main className="page-shell"><Loading /></main>}><Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<SignIn />} />
      <Route path="/pets" element={<Pets />} />
      <Route path="/pets/new" element={<RequireSession><PetEditor /></RequireSession>} />
      <Route path="/pets/:petId" element={<RequireSession><PetDetail /></RequireSession>} />
      <Route path="/pets/:petId/edit" element={<RequireSession><PetEditor /></RequireSession>} />
      <Route path="/memories" element={<Memories />} />
      <Route path="/memories/new" element={<RequireSession><MemorialEditor /></RequireSession>} />
      <Route path="/memories/:memoryId" element={<RequireSession><MemorialDetail /></RequireSession>} />
      <Route path="/memories/:memoryId/edit" element={<RequireSession><MemorialEditor /></RequireSession>} />
      <Route path="/memories/shared/:token" element={<MemorialDetail shared />} />
      <Route path="/shop" element={<Shop />} />
      <Route path="/shop/:productId" element={<ProductDetail />} />
      <Route path="/cart" element={<RequireSession><Cart /></RequireSession>} />
      <Route path="/checkout" element={<RequireSession><Checkout /></RequireSession>} />
      <Route path="/orders" element={<RequireSession><Orders /></RequireSession>} />
      <Route path="/orders/:orderId" element={<RequireSession><UserOrder /></RequireSession>} />
      <Route path="/admin" element={<RequireSession admin><Admin /></RequireSession>} />
      <Route path="*" element={<main className="page-shell"><EmptyState title={t('找不到这个页面', 'Page not found', '找不到這個頁面')}><ButtonLink to="/">{t('返回首页', 'Back to home', '返回主頁')}</ButtonLink></EmptyState></main>} />
    </Routes></Suspense>
    {!shared && <Footer />}
  </div>;
}
