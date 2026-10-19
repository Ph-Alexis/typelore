import { NUMPAD_CELL_ORDER, OPPONENT_CELL_ORDER, type GridCellState } from "@typelore/shared";
import { GridCell } from "./GridCell";
import { useLanguage } from "../../i18n/LanguageContext";
import styles from "./Battlefield.module.css";

const BAZOOKA_BADGES_SELF = [
  { id: "A", top: "33.33%", left: "33.33%" },
  { id: "B", top: "33.33%", left: "66.67%" },
  { id: "C", top: "66.67%", left: "33.33%" },
  { id: "D", top: "66.67%", left: "66.67%" },
] as const;

const BAZOOKA_BADGES_OPPONENT = [
  { id: "B", top: "33.33%", left: "33.33%" },
  { id: "A", top: "33.33%", left: "66.67%" },
  { id: "D", top: "66.67%", left: "33.33%" },
  { id: "C", top: "66.67%", left: "66.67%" },
] as const;

export function Grid({ cells, opponent, label }: { cells: GridCellState[]; opponent?: boolean; label: string }) {
  const { t } = useLanguage();
  const order = opponent ? OPPONENT_CELL_ORDER : NUMPAD_CELL_ORDER;
  const badges = opponent ? BAZOOKA_BADGES_OPPONENT : BAZOOKA_BADGES_SELF;
  return (
    <div className={styles.grid} data-grid={opponent ? "opponent" : "self"} role="group" aria-label={t("arenaGroupLabel", { label })}>
      {order.map((id) => {
        const cell = cells.find((candidate) => candidate.id === id);
        return cell ? <GridCell key={id} cell={cell} /> : null;
      })}
      {badges.map((badge) => (
        <span
          key={badge.id}
          className={styles.areaIntersectionBadge}
          style={{ top: badge.top, left: badge.left }}
          title={t("bazookaAreaBadgeTitle", { id: badge.id })}
          aria-hidden="true"
        >
          {badge.id}
        </span>
      ))}
    </div>
  );
}

