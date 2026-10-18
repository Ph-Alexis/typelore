import type { GridCellState } from "@typelore/shared";
import styles from "./Battlefield.module.css";

export function GridCell({ cell }: { cell: GridCellState }) {
  const { id, object } = cell;

  if (!object) {
    return (
      <div className={styles.cell} role="gridcell" aria-label={`Ô ${id}, trống`}>
        <strong>{id}</strong>
        <span>Trống</span>
      </div>
    );
  }

  if (object.type === "PISTOL") {
    return (
      <div
        className={`${styles.cell} ${styles.pistolCell}`}
        role="gridcell"
        aria-label={`Ô ${id}, Pistol, ${object.hp}/${object.maxHp} HP, ${object.ammo}/${object.maxAmmo} đạn`}
      >
        <span className={styles.cellId}>{id}</span>
        <strong className={styles.objectName}>Pistol</strong>
        <span className={styles.hpText}>HP {object.hp}/{object.maxHp}</span>
        <span className={`${styles.ammoText} ${object.ammo > 0 ? styles.hasAmmo : styles.noAmmo}`}>
          Đạn: {object.ammo}/{object.maxAmmo}
        </span>
      </div>
    );
  }

  if (object.type === "PROTECTOR") {
    return (
      <div
        className={`${styles.cell} ${styles.protectorCell}`}
        role="gridcell"
        aria-label={`Ô ${id}, Protector (Tanker), ${object.hp}/${object.maxHp} HP`}
      >
        <span className={styles.cellId}>{id}</span>
        <strong className={styles.objectName}>Protector</strong>
        <span className={styles.hpText}>HP {object.hp}/{object.maxHp}</span>
        <span className={styles.tankText}>Tanker</span>
      </div>
    );
  }

  if (object.type === "WATER") {
    return (
      <div
        className={`${styles.cell} ${styles.waterCell}`}
        role="gridcell"
        aria-label={`Ô ${id}, Water, ${object.hp}/${object.maxHp} HP`}
      >
        <span className={styles.cellId}>{id}</span>
        <strong className={styles.objectName}>Water</strong>
        <span className={styles.hpText}>HP {object.hp}/{object.maxHp}</span>
        <span className={styles.materialText}>Nguyên liệu</span>
      </div>
    );
  }

  if (object.type === "CLAY") {
    return (
      <div
        className={`${styles.cell} ${styles.clayCell}`}
        role="gridcell"
        aria-label={`Ô ${id}, Clay, ${object.hp}/${object.maxHp} HP`}
      >
        <span className={styles.cellId}>{id}</span>
        <strong className={styles.objectName}>Clay</strong>
        <span className={styles.hpText}>HP {object.hp}/{object.maxHp}</span>
        <span className={styles.materialText}>Nguyên liệu</span>
      </div>
    );
  }

  if (object.type === "BRICK") {
    return (
      <div
        className={`${styles.cell} ${styles.brickCell}`}
        role="gridcell"
        aria-label={`Ô ${id}, Brick, ${object.hp}/${object.maxHp} HP`}
      >
        <span className={styles.cellId}>{id}</span>
        <strong className={styles.objectName}>Brick</strong>
        <span className={styles.hpText}>HP {object.hp}/{object.maxHp}</span>
        <span className={styles.healText}>Hồi máu</span>
      </div>
    );
  }

  return (
    <div className={styles.cell} role="gridcell" aria-label={`Ô ${id}`}>
      <strong>{id}</strong>
    </div>
  );
}
