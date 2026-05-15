// src/i18n/index.ts

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import frTranslations from "./locales/fr.json";
import enTranslations from "./locales/en.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: {
        translation: frTranslations,
      },
      en: {
        translation: enTranslations,
      },
    },

    // Langue par défaut
    lng: "fr",

    // Si langue introuvable
    fallbackLng: "fr",

    // Langues autorisées
    supportedLngs: ["fr", "en"],

    debug: false,

    interpolation: {
      escapeValue: false,
    },

    detection: {
      // priorité
      order: ["localStorage", "navigator"],

      // sauvegarde
      caches: ["localStorage"],

      // clé utilisée
      lookupLocalStorage: "i18nextLng",
    },

    react: {
      useSuspense: false,
    },
  });

export default i18n;