import { useCallback, useEffect, useState, type ReactNode } from "react";
import { translations, type Language, type TranslationKey } from "./translations";
import { LanguageContext } from "./LanguageContext";

const STORAGE_KEY = "typelore_lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === "vi" || saved === "en") return saved;
      } catch {
        // Fallback to default
      }
    }
    return "vi";
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, lang);
      }
    } catch {
      // LocalStorage error handled
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => {
      const next = prev === "vi" ? "en" : "vi";
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(STORAGE_KEY, next);
        }
      } catch {
        // LocalStorage error handled
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      const dict = translations[language] || translations.vi;
      let text: string = dict[key] || translations.vi[key] || key;
      if (params) {
        for (const [paramKey, paramVal] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(paramVal));
        }
      }
      return text;
    },
    [language],
  );

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

