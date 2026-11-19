import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { App } from './App';
import { ApiError } from './api';
import './styles.css';

const client = new QueryClient({
  defaultOptions: { queries: { retry: (count, error) => count < 1 && !(error instanceof ApiError && error.status < 500) } },
});

createRoot(document.getElementById('root')!).render(<StrictMode>
  <ConfigProvider locale={zhCN} theme={{ token: {
    colorPrimary: '#335b46', colorLink: '#335b46', colorText: '#243b31', colorBorder: '#dbded3',
    borderRadius: 9, controlHeight: 42, fontSize: 15,
    fontFamily: '"DM Sans", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  } }}>
    <QueryClientProvider client={client}><BrowserRouter><App /></BrowserRouter></QueryClientProvider>
  </ConfigProvider>
</StrictMode>);
