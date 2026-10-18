import { NUMPAD_CELL_ORDER, type GridCellState } from "@typelore/shared";
import { GridCell } from "./GridCell";
import styles from "./Battlefield.module.css";

export function Grid({ cells, opponent, label }: { cells: GridCellState[]; opponent?: boolean; label: string }) {
  const order = NUMPAD_CELL_ORDER;
  return <div className={styles.grid} data-grid={opponent ? "opponent" : "self"} role="group" aria-label={`Sân ${label}`}>
    {order.map((id) => {
      const cell = cells.find((candidate) => candidate.id === id);
      return cell ? <GridCell key={id} cell={cell} /> : null;
    })}
  </div>;
}
