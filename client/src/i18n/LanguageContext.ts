import { createContext } from "react";
import type { Language, TranslationKey } from "./translations";

export interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

export const LanguageContext = createContext<LanguageContextType | null>(null);

export { useLanguage } from "./useLanguage";
export { LanguageProvider } from "./LanguageProvider";

