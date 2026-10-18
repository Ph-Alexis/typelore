import { PROTOCOL_VERSION, type ProtocolWelcome } from "@typelore/shared";
import { useEffect, useState } from "react";

import styles from "./App.module.css";
import { socket } from "./socket/client";
import { Lobby } from "./components/lobby/Lobby";
import { useLanguage } from "./i18n/LanguageContext";
import { LanguageToggle } from "./components/common/LanguageToggle";

type ConnectionState =
  | "CONNECTING"
  | "CONNECTED"
  | "INCOMPATIBLE"
  | "DISCONNECTED";

export function App() {
  const { t } = useLanguage();
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("CONNECTING");
  const [serverInfo, setServerInfo] = useState<ProtocolWelcome | null>(null);

  useEffect(() => {
    let connectionGeneration = 0;
    let active = true;
    function handleConnect(): void {
      const generation = ++connectionGeneration;
      setConnectionState("CONNECTING");
      setServerInfo(null);
      socket.emit(
        "protocol:hello",
        { protocolVersion: PROTOCOL_VERSION },
        (response) => {
          if (!active || generation !== connectionGeneration || !socket.connected) return;
          if (!response.ok) {
            setConnectionState(
              response.error.code === "PROTOCOL_MISMATCH"
                ? "INCOMPATIBLE"
                : "DISCONNECTED",
            );
            return;
          }

          setServerInfo(response.data);
          setConnectionState("CONNECTED");
        },
      );
    }

    function handleDisconnect(): void {
      connectionGeneration += 1;
      setConnectionState("DISCONNECTED");
      setServerInfo(null);
    }

    function handleWelcome(payload: ProtocolWelcome): void {
      setServerInfo(payload);
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleDisconnect);
    socket.on("protocol:welcome", handleWelcome);
    socket.connect();

    return () => {
      active = false;
      connectionGeneration += 1;
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleDisconnect);
      socket.off("protocol:welcome", handleWelcome);
      socket.disconnect();
    };
  }, []);

  const isConnected = connectionState === "CONNECTED";
  const statusLabel = isConnected
    ? t("statusConnected")
    : connectionState === "CONNECTING"
    ? t("statusConnecting")
    : connectionState === "INCOMPATIBLE"
    ? t("statusIncompatible")
    : t("statusDisconnected");

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="typelore-title">
        <div className={styles.topBar}>
          <p className={styles.eyebrow}>{t("appEyebrow")}</p>
          <LanguageToggle />
        </div>
        <h1 id="typelore-title">{t("appTitle")}</h1>
        <p className={styles.subtitle}>{t("appSubtitle")}</p>

        <div className={styles.statusRow} aria-live="polite">
          <span
            className={isConnected ? styles.statusOnline : styles.statusOffline}
            aria-hidden="true"
          />
          <span>{statusLabel}</span>
        </div>

        <dl className={styles.details}>
          <div>
            <dt>{t("clientProtocol")}</dt>
            <dd>{PROTOCOL_VERSION}</dd>
          </div>
          <div>
            <dt>{t("serverProtocol")}</dt>
            <dd>{serverInfo?.protocolVersion ?? t("waiting")}</dd>
          </div>
        </dl>

        <Lobby online={isConnected} connectionId={serverInfo?.connectionId} />
      </section>
    </main>
  );
}
