import { useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import styles from "./CommandHud.module.css";

interface CommandItem {
  syntax: string;
  desc: string;
}

interface CommandGroup {
  category: string;
  icon: string;
  colorClass: string;
  commands: CommandItem[];
}

export function CommandHud() {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("typelore_hud_open");
        if (saved !== null) return saved === "true";
      } catch {
        // Fallback to default
      }
    }
    return true;
  });

  const commandGroups: CommandGroup[] = [
    {
      category: t("groupInfantry"),
      icon: "⚔️",
      colorClass: styles.groupOffense ?? "",
      commands: [
        { syntax: "pistol <1–9>", desc: t("cmdPistolDesc") },
        { syntax: "load ammo <1–9>", desc: t("cmdLoadDesc") },
      ],
    },
    {
      category: t("groupDefense"),
      icon: "🛡️",
      colorClass: styles.groupDefense ?? "",
      commands: [
        { syntax: "protector <1–9>", desc: t("cmdProtectorDesc") },
        { syntax: "add water <1–9>", desc: t("cmdWaterDesc") },
        { syntax: "add clay <1–9>", desc: t("cmdClayDesc") },
        { syntax: "add brick <1–9>", desc: t("cmdBrickDesc") },
      ],
    },
    {
      category: t("groupHeavy"),
      icon: "💥",
      colorClass: styles.groupHeavy ?? "",
      commands: [
        { syntax: "boost", desc: t("cmdBoostDesc") },
        { syntax: "bazooka <A–D>", desc: t("cmdBazookaDesc") },
      ],
    },
    {
      category: t("groupAir"),
      icon: "🦅",
      colorClass: styles.groupAir ?? "",
      commands: [
        { syntax: "bird and bomb", desc: t("cmdBirdDesc") },
        { syntax: "type letters", desc: t("cmdArrowDesc") },
      ],
    },
  ];

  const handleToggle = () => {
    setIsOpen((prev) => {
      const next = !prev;
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("typelore_hud_open", String(next));
        }
      } catch {
        // LocalStorage access fails gracefully
      }
      return next;
    });
  };

  return (
    <section className={styles.hudContainer} aria-label={t("hudTitle")}>
      <div className={styles.hudHeader}>
        <div className={styles.hudTitle}>
          <span className={styles.hudIcon} aria-hidden="true">📖</span>
          <span className={styles.hudHeading}>{t("hudTitle")}</span>
        </div>
        <button
          type="button"
          className={styles.toggleBtn}
          onClick={handleToggle}
          aria-expanded={isOpen}
          aria-controls="hud-content-panel"
        >
          {isOpen ? t("hudCollapse") : t("hudExpand")}
        </button>
      </div>

      {isOpen && (
        <div id="hud-content-panel" className={styles.hudBody}>
          <div className={styles.groupsGrid}>
            {commandGroups.map((group) => (
              <div key={group.category} className={`${styles.groupCard} ${group.colorClass}`}>
                <h4 className={styles.groupHeader}>
                  <span aria-hidden="true">{group.icon}</span> {group.category}
                </h4>
                <ul className={styles.commandList}>
                  {group.commands.map((cmd) => (
                    <li key={cmd.syntax} className={styles.commandItem}>
                      <code className={styles.syntaxCode}>{cmd.syntax}</code>
                      <span className={styles.descText}>{cmd.desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

