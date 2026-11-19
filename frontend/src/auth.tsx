import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { ApiError, api } from './api';
import type { Account } from './types';
import { ButtonLink, EmptyState, Feedback, Loading } from './ui';
import { useLanguage } from './language';

export const sessionKey = ['session'] as const;

export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: async () => {
      try {
        return await api<Account>('/auth/me');
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
  });
}

export function useSetSession() {
  const client = useQueryClient();
  return async (account: Account | null) => {
    await client.cancelQueries({ predicate: query => query.queryKey[0] !== 'products' });
    client.removeQueries({ predicate: query => query.queryKey[0] !== 'products' && query.queryKey[0] !== 'session' });
    client.setQueryData(sessionKey, account);
  };
}

export function RequireSession({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { t } = useLanguage();
  const { data: account, isPending, error } = useSession();
  const location = useLocation();
  if (isPending) return <main className="page-shell"><Loading /></main>;
  if (error) return <main className="page-shell"><Feedback error={error} /></main>;
  if (!account) return <main className="page-shell"><EmptyState title={t('请先登录', 'Please sign in', '請先登入')} description={t('登录后即可管理档案、纪念页和订单。', 'Sign in to manage your pets, memory pages, and orders.', '登入後即可管理寵物檔案、紀念頁及訂單。')}>
    <ButtonLink to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}>{t('登录或创建账号', 'Sign in or create an account', '登入或建立帳戶')}</ButtonLink>
  </EmptyState></main>;
  if (admin && account.role !== 'ADMIN') return <main className="page-shell"><EmptyState title={t('需要运营权限', 'Admin account required', '需要管理員權限')}><Link to="/">{t('返回首页', 'Back to home', '返回主頁')}</Link></EmptyState></main>;
  return children;
}

export function loginLink(next: string) { return `/login?next=${encodeURIComponent(next)}`; }
