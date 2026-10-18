import { useLanguage } from "../../i18n/useLanguage";
import type { TranslationKey } from "../../i18n/translations";

export function CommandFeedback({ id, message, error }: { id: string; message: string; error: boolean }) {
  const { t } = useLanguage();
  const displayMessage = message ? t(message as TranslationKey) || message : "";
  return <p id={id} role={error ? "alert" : "status"}>{displayMessage}</p>;
}
