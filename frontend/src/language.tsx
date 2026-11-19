import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export const locales = {
  en: { label: 'English', short: 'EN', html: 'en' },
  'zh-CN': { label: '简体中文', short: '简', html: 'zh-CN' },
  'zh-HK': { label: '繁體中文（香港）', short: '繁', html: 'zh-HK' },
} as const;

export type Locale = keyof typeof locales;
export type Translate = (simplified: string, english: string, hongKong: string) => string;

const storageKey = 'fluffy-memory.language';
const isLocale = (value: string | null): value is Locale => Boolean(value && Object.hasOwn(locales, value));
const LanguageContext = createContext<{ locale: Locale; t: Translate; setLocale: (locale: Locale) => void } | null>(null);

function initialLocale(): Locale {
  const requested = new URLSearchParams(window.location.search).get('lang');
  if (isLocale(requested)) return requested;
  try {
    const stored = localStorage.getItem(storageKey);
    if (isLocale(stored)) return stored;
  } catch {
    // The selected language still applies for the current page when storage is disabled.
  }
  const browser = navigator.language.toLowerCase();
  if (/^zh-(hk|mo|tw|hant)(-|$)/.test(browser)) return 'zh-HK';
  return browser.startsWith('zh') ? 'zh-CN' : 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, select] = useState(initialLocale);
  useEffect(() => {
    document.documentElement.lang = locales[locale].html;
    try {
      localStorage.setItem(storageKey, locale);
    } catch {
      // Language switching is still available in this session.
    }
  }, [locale]);

  function setLocale(next: Locale) {
    select(next);
    const url = new URL(window.location.href);
    if (url.searchParams.has('lang')) {
      url.searchParams.set('lang', next);
      window.history.replaceState(window.history.state, '', url);
    }
  }

  const t: Translate = (simplified, english, hongKong) => ({ 'zh-CN': simplified, en: english, 'zh-HK': hongKong })[locale];
  return <LanguageContext.Provider value={{ locale, t, setLocale }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const language = useContext(LanguageContext);
  if (!language) throw new Error('LanguageProvider is required');
  return language;
}
