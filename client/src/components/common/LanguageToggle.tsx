import { useLanguage } from "../../i18n/LanguageContext";
import styles from "./LanguageToggle.module.css";

interface Props {
  className?: string;
}

export function LanguageToggle({ className }: Props) {
  const { language, toggleLanguage } = useLanguage();

  return (
    <button
      type="button"
      className={`${styles.toggleBtn} ${className ?? ""}`}
      onClick={toggleLanguage}
      title={language === "vi" ? "Chuyển sang tiếng Anh (English)" : "Switch to Vietnamese (Tiếng Việt)"}
      aria-label={`Ngôn ngữ hiện tại: ${language.toUpperCase()}. Bấm để đổi ngôn ngữ.`}
    >
      <span className={styles.globeIcon} aria-hidden="true">🌐</span>
      <span className={`${styles.opt} ${language === "vi" ? styles.active : styles.inactive}`}>VI</span>
      <span className={styles.slash}>/</span>
      <span className={`${styles.opt} ${language === "en" ? styles.active : styles.inactive}`}>EN</span>
    </button>
  );
}

