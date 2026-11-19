import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import zhHK from 'antd/locale/zh_HK';
import enUS from 'antd/locale/en_US';
import { App } from './App';
import { ApiError } from './api';
import { LanguageProvider, useLanguage } from './language';
import './styles.css';

const client = new QueryClient({
  defaultOptions: { queries: { retry: (count, error) => count < 1 && !(error instanceof ApiError && error.status < 500) } },
});

function LocalizedApp() {
  const { locale } = useLanguage();
  return <ConfigProvider locale={{ 'zh-CN': zhCN, 'zh-HK': zhHK, en: enUS }[locale]} theme={{ token: {
    colorPrimary: '#335b46', colorLink: '#335b46', colorText: '#243b31', colorBorder: '#dbded3',
    borderRadius: 9, controlHeight: 42, fontSize: 15,
    fontFamily: '"DM Sans", "PingFang HK", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  } }}>
    <QueryClientProvider client={client}><BrowserRouter><App /></BrowserRouter></QueryClientProvider>
  </ConfigProvider>;
}

createRoot(document.getElementById('root')!).render(<StrictMode>
  <LanguageProvider><LocalizedApp /></LanguageProvider>
</StrictMode>);
