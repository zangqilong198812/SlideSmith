import { useEffect, useState } from 'react';

export type Language = 'zh' | 'en';

const KEY = 'slidesmith.language';
const EVENT = 'slidesmith-language-change';

export function getLanguage(): Language {
  if (typeof window === 'undefined') return 'zh';
  return window.localStorage.getItem(KEY) === 'en' ? 'en' : 'zh';
}

export function setLanguage(language: Language) {
  window.localStorage.setItem(KEY, language);
  window.dispatchEvent(new Event(EVENT));
}

export function useLanguage() {
  const [language, setCurrent] = useState<Language>(() => getLanguage());

  useEffect(() => {
    const update = () => setCurrent(getLanguage());
    window.addEventListener(EVENT, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);

  return language;
}

export function useT() {
  const language = useLanguage();
  return (en: string, zh: string) => (language === 'zh' ? zh : en);
}
