import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import en from "./locales/en.json";
import ru from "./locales/ru.json";

const LANG_KEY = "i18n_lang";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru },
  },
  lng: "ru",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

AsyncStorage.getItem(LANG_KEY).then((lang) => {
  if (lang && (lang === "en" || lang === "ru")) {
    i18n.changeLanguage(lang);
  }
});

export function toggleLanguage() {
  const next = i18n.language === "ru" ? "en" : "ru";
  i18n.changeLanguage(next);
  AsyncStorage.setItem(LANG_KEY, next);
}

export default i18n;
