import { NUMPAD_CELL_ORDER, OPPONENT_CELL_ORDER, BAZOOKA_AREAS, type GridCellState } from "@typelore/shared";
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

export function Grid({
  cells,
  opponent,
  label,
  highlightCellId,
  highlightAreaId,
}: {
  cells: GridCellState[];
  opponent?: boolean | undefined;
  label: string;
  highlightCellId?: number | undefined;
  highlightAreaId?: "A" | "B" | "C" | "D" | undefined;
}) {
  const { t } = useLanguage();
  const order = opponent ? OPPONENT_CELL_ORDER : NUMPAD_CELL_ORDER;
  const badges = opponent ? BAZOOKA_BADGES_OPPONENT : BAZOOKA_BADGES_SELF;
  const areaCells = highlightAreaId ? BAZOOKA_AREAS[highlightAreaId] : undefined;

  return (
    <div className={styles.grid} data-grid={opponent ? "opponent" : "self"} role="group" aria-label={t("arenaGroupLabel", { label })}>
      {order.map((id) => {
        const cell = cells.find((candidate) => candidate.id === id);
        const isHighlighted = highlightCellId === id || (areaCells ? (areaCells as readonly number[]).includes(id) : false);
        return cell ? <GridCell key={id} cell={cell} highlighted={isHighlighted} /> : null;
      })}
      {badges.map((badge) => (
        <span
          key={badge.id}
          className={`${styles.areaIntersectionBadge} ${
            highlightAreaId === badge.id ? styles.badgeHighlighted : ""
          }`}
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

