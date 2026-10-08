import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../locales/en.json';
import hi from '../locales/hi.json';
import or from '../locales/or.json';
import te from '../locales/te.json';

const savedLang = localStorage.getItem('nexcampus_language') || 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      or: { translation: or },
      te: { translation: te },
    },
    lng: savedLang,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already safes from XSS
    },
  });

// Synchronize document lang attribute
document.documentElement.lang = savedLang;

export default i18n;
