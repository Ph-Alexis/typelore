import styles from "./Battlefield.module.css";

export interface CombatTextItem {
  id: string;
  text: string;
  type: "damage" | "heal" | "info";
  location: "opponent-castle" | "self-castle" | string;
}

export function FloatingCombatText({ items }: { items: CombatTextItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className={styles.floatingContainer} aria-hidden="true">
      {items.map((item) => (
        <span
          key={item.id}
          className={`${styles.floatingItem} ${
            item.type === "damage"
              ? styles.floatingDamage
              : item.type === "heal"
              ? styles.floatingHeal
              : styles.floatingInfo
          }`}
          data-location={item.location}
        >
          {item.text}
        </span>
      ))}
    </div>
  );
}

