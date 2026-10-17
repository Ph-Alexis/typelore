import type { GridCellState } from "@typelore/shared";
import styles from "./Battlefield.module.css";

export function GridCell({ cell }: { cell: GridCellState }) {
  return <div className={styles.cell} aria-label={`Ô ${cell.id}, trống`}>
    <strong>{cell.id}</strong><span>Trống</span>
  </div>;
}
