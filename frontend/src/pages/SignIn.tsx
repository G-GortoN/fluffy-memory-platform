import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Form, Input } from 'antd';
import { api } from '../api';
import { useSession, useSetSession } from '../auth';
import { useLanguage } from '../language';
import type { Account } from '../types';
import { Feedback, PageIntro, PawMark } from '../ui';

interface Credentials { email: string; password: string; name?: string }

export function SignIn() {
  const { t } = useLanguage();
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
    <div className="auth-photo" role="img" aria-label={t('晒太阳的猫猫', 'A cat in the sunshine', '在陽光下休息的貓咪')} />
    <section className="auth-form">
      <PawMark />
      <PageIntro title={register ? t('欢迎和它一起加入', 'Join Fluffy Memory', '歡迎和牠一起加入') : t('欢迎回来', 'Welcome back', '歡迎回來')} description={register ? t('创建账号，开始记录和收藏。', 'Create an account for your pet profiles and memories.', '建立帳戶，開始記錄寵物資料和回憶。') : t('登录 Fluffy Memory 继续记录。', 'Sign in to Fluffy Memory.', '登入 Fluffy Memory 繼續記錄。')} />
      <Feedback error={error} />
      <Form key={String(register)} layout="vertical" requiredMark={false} onFinish={submit}>
        {register && <Form.Item name="name" label={t('昵称', 'Display name', '暱稱')} rules={[{ required: true, whitespace: true, message: t('请输入昵称', 'Enter a display name.', '請輸入暱稱') }, { max: 80 }]}><Input autoComplete="nickname" /></Form.Item>}
        <Form.Item name="email" label={t('邮箱', 'Email', '電郵地址')} rules={[{ required: true, type: 'email', message: t('请输入有效的邮箱', 'Enter a valid email address.', '請輸入有效的電郵地址') }]}><Input type="email" autoComplete="email" /></Form.Item>
        <Form.Item name="password" label={t('密码', 'Password', '密碼')} rules={[{ required: true, message: t('请输入密码', 'Enter your password.', '請輸入密碼') }, ...(register ? [{ min: 8, message: t('密码至少 8 个字符', 'Use at least 8 characters.', '密碼至少需要 8 個字元') }] : [])]}><Input.Password autoComplete={register ? 'new-password' : 'current-password'} /></Form.Item>
        <Button className="full-button" type="primary" htmlType="submit" loading={busy}>{register ? t('创建账号', 'Create an account', '建立帳戶') : t('登录', 'Sign in', '登入')}</Button>
      </Form>
      <button className="plain-link" type="button" onClick={() => {
        setError(undefined);
        setParams(previous => {
          const nextParams = new URLSearchParams(previous);
          if (register) nextParams.delete('mode'); else nextParams.set('mode', 'register');
          return nextParams;
        }, { replace: true });
      }}>{register ? t('已有账号？登录', 'Already have an account? Sign in', '已有帳戶？登入') : t('还没有账号？立即注册', 'New here? Create an account', '未有帳戶？立即註冊')}</button>
    </section>
  </main>;
}
