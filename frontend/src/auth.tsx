import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { ApiError, api } from './api';
import type { Account } from './types';
import { ButtonLink, EmptyState, Feedback, Loading } from './ui';

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
  const { data: account, isPending, error } = useSession();
  const location = useLocation();
  if (isPending) return <main className="page-shell"><Loading /></main>;
  if (error) return <main className="page-shell"><Feedback error={error} /></main>;
  if (!account) return <main className="page-shell"><EmptyState title="请先登录" description="登录后即可管理档案、纪念页和订单。">
    <ButtonLink to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}>登录或创建账号</ButtonLink>
  </EmptyState></main>;
  if (admin && account.role !== 'ADMIN') return <main className="page-shell"><EmptyState title="需要运营权限"><Link to="/">返回首页</Link></EmptyState></main>;
  return children;
}

export function loginLink(next: string) { return `/login?next=${encodeURIComponent(next)}`; }
