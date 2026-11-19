import { lazy, Suspense, useEffect } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Badge, Dropdown, type MenuProps } from 'antd';
import { DownOutlined, LogoutOutlined, SettingOutlined, ShoppingOutlined, UnorderedListOutlined, UserOutlined } from '@ant-design/icons';
import { api } from './api';
import { RequireSession, useSession, useSetSession } from './auth';
import type { CartItem } from './types';
import { Brand, ButtonLink, EmptyState, Feedback, Loading } from './ui';
import { cartKey } from './queries';
import { Home } from './pages/Home';

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

const navigation = [
  { to: '/', label: '首页' },
  { to: '/pets', label: '宠物照护' },
  { to: '/memories', label: '纪念空间' },
  { to: '/shop', label: '周边商城' },
];

function Header() {
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
    { key: 'pets', label: <Link to="/pets">我的宠物</Link>, icon: <UserOutlined /> },
    { key: 'orders', label: <Link to="/orders">我的订单</Link>, icon: <UnorderedListOutlined /> },
    ...(account?.role === 'ADMIN' ? [{ key: 'admin', label: <Link to="/admin">运营后台</Link>, icon: <SettingOutlined /> }] : []),
    { type: 'divider' },
    { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, onClick: () => logout.mutate(), disabled: logout.isPending },
  ];
  return <header className="site-header">
    <div className="nav-inner">
      <Brand />
      <nav className="primary-nav" aria-label="主导航">{navigation.map(item => <NavLink key={item.to} to={item.to} end={item.to === '/'}>{item.label}</NavLink>)}</nav>
      <div className="nav-actions">
        <Link to="/cart" className="nav-bag" aria-label="购物袋"><Badge count={quantity}><ShoppingOutlined /></Badge></Link>
        {account ? <Dropdown menu={{ items: accountMenu }} trigger={['click']} placement="bottomRight">
          <button type="button" className="nav-account" aria-label="我的账号"><UserOutlined /><span>{account.name}</span><DownOutlined className="nav-chevron" /></button>
        </Dropdown> : <Link to="/login" className="nav-account" aria-label="登录"><UserOutlined /><span>登录</span></Link>}
      </div>
    </div>
    {logout.error && <div className="nav-error"><Feedback error={logout.error} /></div>}
  </header>;
}

function Footer() {
  return <footer className="site-footer"><div className="footer-inner"><Brand /><nav aria-label="页脚导航">
    <Link to="/pets">宠物照护</Link><Link to="/memories">纪念空间</Link><Link to="/shop">周边商城</Link>
  </nav></div></footer>;
}

export function App() {
  const location = useLocation();
  const shared = location.pathname.startsWith('/memories/shared/');
  useEffect(() => {
    document.title = location.pathname === '/' ? 'Fluffy Memory · 宠物照护与纪念' : 'Fluffy Memory';
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return <div className="site-shell">
    {!shared && <Header />}
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
      <Route path="*" element={<main className="page-shell"><EmptyState title="找不到这个页面"><ButtonLink to="/">返回首页</ButtonLink></EmptyState></main>} />
    </Routes></Suspense>
    {!shared && <Footer />}
  </div>;
}
