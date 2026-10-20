import type { GridCellState } from "@typelore/shared";
import { useLanguage } from "../../i18n/LanguageContext";
import styles from "./Battlefield.module.css";

export function GridCell({
  cell,
  highlighted,
  isOpponent,
}: {
  cell: GridCellState;
  highlighted?: boolean | undefined;
  isOpponent?: boolean | undefined;
}) {
  const { t } = useLanguage();
  const { id, object } = cell;
  const tutorialCellId = isOpponent ? `bot-${id}` : `player-${id}`;

  if (!object) {
    return (
      <div
        className={`${styles.cell} ${highlighted ? styles.cellHighlighted : ""}`}
        data-cell-id={id}
        data-tutorial-cell={tutorialCellId}
        role="gridcell"
        aria-label={`Cell ${id}, ${t("emptyCell")}`}
      >
        <strong>{id}</strong>
        <span>{t("emptyCell")}</span>
      </div>
    );
  }

  if (object.type === "PISTOL") {
    return (
      <div
        className={`${styles.cell} ${styles.pistolCell} ${highlighted ? styles.cellHighlighted : ""}`}
        data-cell-id={id}
        data-tutorial-cell={tutorialCellId}
        role="gridcell"
        aria-label={`Cell ${id}, Pistol, ${object.hp}/${object.maxHp} HP, ${object.ammo}/${object.maxAmmo} ${t("ammo").toLowerCase()}`}
      >
        <span className={styles.cellId}>{id}</span>
        <strong className={styles.objectName}>Pistol</strong>
        <span className={styles.hpText}>HP {object.hp}/{object.maxHp}</span>
        <span className={`${styles.ammoText} ${object.ammo > 0 ? styles.hasAmmo : styles.noAmmo}`}>
          {t("ammo")}: {object.ammo}/{object.maxAmmo}
        </span>
      </div>
    );
  }

  if (object.type === "PROTECTOR") {
    return (
      <div
        className={`${styles.cell} ${styles.protectorCell} ${highlighted ? styles.cellHighlighted : ""}`}
        data-cell-id={id}
        data-tutorial-cell={tutorialCellId}
        role="gridcell"
        aria-label={`Cell ${id}, Protector, ${object.hp}/${object.maxHp} HP`}
      >
        <span className={styles.cellId}>{id}</span>
        <strong className={styles.objectName}>Protector</strong>
        <span className={styles.hpText}>HP {object.hp}/{object.maxHp}</span>
        <span className={styles.tankText}>{t("tanker")}</span>
      </div>
    );
  }

  if (object.type === "WATER") {
    return (
      <div
        className={`${styles.cell} ${styles.waterCell} ${highlighted ? styles.cellHighlighted : ""}`}
        data-cell-id={id}
        data-tutorial-cell={tutorialCellId}
        role="gridcell"
        aria-label={`Cell ${id}, Water, ${object.hp}/${object.maxHp} HP`}
      >
        <span className={styles.cellId}>{id}</span>
        <strong className={styles.objectName}>Water</strong>
        <span className={styles.hpText}>HP {object.hp}/{object.maxHp}</span>
        <span className={styles.materialText}>{t("material")}</span>
      </div>
    );
  }

  if (object.type === "CLAY") {
    return (
      <div
        className={`${styles.cell} ${styles.clayCell} ${highlighted ? styles.cellHighlighted : ""}`}
        data-cell-id={id}
        data-tutorial-cell={tutorialCellId}
        role="gridcell"
        aria-label={`Cell ${id}, Clay, ${object.hp}/${object.maxHp} HP`}
      >
        <span className={styles.cellId}>{id}</span>
        <strong className={styles.objectName}>Clay</strong>
        <span className={styles.hpText}>HP {object.hp}/{object.maxHp}</span>
        <span className={styles.materialText}>{t("material")}</span>
      </div>
    );
  }

  if (object.type === "BRICK") {
    return (
      <div
        className={`${styles.cell} ${styles.brickCell} ${highlighted ? styles.cellHighlighted : ""}`}
        data-cell-id={id}
        data-tutorial-cell={tutorialCellId}
        role="gridcell"
        aria-label={`Cell ${id}, Brick, ${object.hp}/${object.maxHp} HP`}
      >
        <span className={styles.cellId}>{id}</span>
        <strong className={styles.objectName}>Brick</strong>
        <span className={styles.hpText}>HP {object.hp}/{object.maxHp}</span>
        <span className={styles.healText}>{t("heal")}</span>
      </div>
    );
  }

  return (
    <div
      className={styles.cell}
      data-cell-id={id}
      data-tutorial-cell={tutorialCellId}
      role="gridcell"
      aria-label={`Cell ${id}`}
    >
      <strong>{id}</strong>
    </div>
  );
}
