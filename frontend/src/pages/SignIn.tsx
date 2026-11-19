import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Form, Input } from 'antd';
import { api } from '../api';
import { useSession, useSetSession } from '../auth';
import type { Account } from '../types';
import { Feedback, PageIntro, PawMark } from '../ui';

interface Credentials { email: string; password: string; name?: string }

export function SignIn() {
  const [params, setParams] = useSearchParams();
  const register = params.get('mode') === 'register';
  const next = params.get('next');
  const target = next?.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : '/pets';
  const { data: account } = useSession();
  const setSession = useSetSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();

  if (account) return <Navigate to={target} replace />;
  async function submit(values: Credentials) {
    setError(undefined);
    setBusy(true);
    try {
      const signedIn = await api<Account>(register ? '/auth/register' : '/auth/login', 'POST', values);
      await setSession(signedIn);
      navigate(target, { replace: true });
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }

  return <main className="page-shell auth-page">
    <div className="auth-photo" role="img" aria-label="晒太阳的猫猫" />
    <section className="auth-form">
      <PawMark />
      <PageIntro title={register ? '欢迎和它一起加入' : '欢迎回来'} description={register ? '创建账号，开始记录和收藏。' : '登录 Fluffy Memory 继续记录。'} />
      <Feedback error={error} />
      <Form key={String(register)} layout="vertical" requiredMark={false} onFinish={submit}>
        {register && <Form.Item name="name" label="昵称" rules={[{ required: true, whitespace: true, message: '请输入昵称' }, { max: 80 }]}><Input autoComplete="nickname" /></Form.Item>}
        <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email', message: '请输入有效的邮箱' }]}><Input type="email" autoComplete="email" /></Form.Item>
        <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }, ...(register ? [{ min: 8, message: '密码至少 8 个字符' }] : [])]}><Input.Password autoComplete={register ? 'new-password' : 'current-password'} /></Form.Item>
        <Button className="full-button" type="primary" htmlType="submit" loading={busy}>{register ? '创建账号' : '登录'}</Button>
      </Form>
      <button className="plain-link" type="button" onClick={() => {
        setError(undefined);
        setParams(previous => {
          const nextParams = new URLSearchParams(previous);
          if (register) nextParams.delete('mode'); else nextParams.set('mode', 'register');
          return nextParams;
        }, { replace: true });
      }}>{register ? '已有账号？登录' : '还没有账号？立即注册'}</button>
    </section>
  </main>;
}
