import { useState } from "react";
import styles from "./CommandHud.module.css";

interface CommandItem {
  syntax: string;
  desc: string;
  tag?: string;
}

interface CommandGroup {
  category: string;
  icon: string;
  colorClass: string;
  commands: CommandItem[];
}

const COMMAND_GROUPS: CommandGroup[] = [
  {
    category: "Bộ binh & Đạn",
    icon: "⚔️",
    colorClass: styles.groupOffense ?? "",
    commands: [
      { syntax: "pistol <1–9>", desc: "Đặt súng lục (15 HP)" },
      { syntax: "load ammo <1–9>", desc: "Nạp +5 đạn (tối đa 10)" },
    ],
  },
  {
    category: "Phòng thủ & Hồi máu",
    icon: "🛡️",
    colorClass: styles.groupDefense ?? "",
    commands: [
      { syntax: "protector <1–9>", desc: "Dựng tường chắn (20 HP)" },
      { syntax: "add water <1–9>", desc: "Đổ nước (10 HP)" },
      { syntax: "add clay <1–9>", desc: "Đất sét (gặp nước đúc Gạch)" },
      { syntax: "add brick", desc: "Dùng gạch hồi +15 HP Castle" },
    ],
  },
  {
    category: "Bazooka hạng nặng",
    icon: "💥",
    colorClass: styles.groupHeavy ?? "",
    commands: [
      { syntax: "boost", desc: "Tích 1 nấc Bazooka (cần 10 nấc)" },
      { syntax: "bazooka <1–4>", desc: "Bắn nổ lan 4 ô (sát thương 10)" },
    ],
  },
  {
    category: "Không chiến",
    icon: "🦅",
    colorClass: styles.groupAir ?? "",
    commands: [
      { syntax: "bird and bomb", desc: "Thả chim ném bom Castle (-20 HP)" },
      { syntax: "arrow", desc: "Bắn cung hạ chim gần nhất (-5 HP)" },
    ],
  },
];

export function CommandHud() {
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
    <section className={styles.hudContainer} aria-label="Bảng tra cứu lệnh chiến đấu">
      <div className={styles.hudHeader}>
        <div className={styles.hudTitle}>
          <span className={styles.hudIcon} aria-hidden="true">📖</span>
          <span className={styles.hudHeading}>COMMANDS</span>
        </div>
        <button
          type="button"
          className={styles.toggleBtn}
          onClick={handleToggle}
          aria-expanded={isOpen}
          aria-controls="hud-content-panel"
        >
          {isOpen ? "Thu gọn ▾" : "Hiện lệnh ▴"}
        </button>
      </div>

      {isOpen && (
        <div id="hud-content-panel" className={styles.hudBody}>
          <div className={styles.groupsGrid}>
            {COMMAND_GROUPS.map((group) => (
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

