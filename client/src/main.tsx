import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";

import { App } from "./App";
import { LanguageProvider } from "./i18n/LanguageContext";
import "./index.css";

const rootElement = document.querySelector<HTMLDivElement>("#root");

if (rootElement === null) {
  throw new Error("The Typelore root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <LanguageProvider>
      <App />
      <Analytics />
    </LanguageProvider>
  </StrictMode>,
);
