import { useState, useRef, useEffect, useCallback } from "react";
import type { BirdState, GridCellState, PlayerBattlefieldState, TutorialStepDef } from "@typelore/shared";
import {
  CASTLE_HP,
  PISTOL_HP,
  PISTOL_MAX_AMMO,
  PROTECTOR_HP,
  WATER_HP,
  CLAY_HP,
  BRICK_HP,
  BIRD_HP,
  BIRD_FLIGHT_TIME_MS,
  TUTORIAL_STEPS,
} from "@typelore/shared";
import { CastleTower } from "../game/CastleTower";
import { Grid } from "../game/Grid";
import { CombatCorridor } from "../game/CombatCorridor";
import { CombatAnimationLayer } from "../game/CombatAnimationLayer";
import { FloatingCombatText, type CombatTextItem } from "../game/FloatingCombatText";
import { CommandHud } from "../game/CommandHud";
import { LanguageToggle } from "../common/LanguageToggle";
import { sound } from "../../audio/SoundEffects";
import { useLanguage } from "../../i18n/LanguageContext";
import styles from "./TutorialBattlefield.module.css";
import bStyles from "../game/Battlefield.module.css";

const BIRD_DEFENSE_WORD = "typelorebird";

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // fallback
    }
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    try {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6]! & 0x0f) | 0x40;
      bytes[8] = (bytes[8]! & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    } catch {
      // fallback
    }
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function createEmptyGrid(): GridCellState[] {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9].map((id) => ({ id, object: null }));
}

interface BulletAnim {
  id: string;
  fromOpponent: boolean;
  shooterCellId: number;
  hitCellId: number | null;
  lane: 1 | 2 | 3;
}

interface RocketAnim {
  id: string;
  fromOpponent: boolean;
  targetCellId?: number;
}

export function TutorialBattlefield({ onExit }: { onExit: () => void }) {
  const { language, t } = useLanguage();
  const isEn = language === "en";

  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState("");
  const [hasError, setHasError] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [muted, setMuted] = useState(sound.muted);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  // Animation states
  const [combatTexts, setCombatTexts] = useState<CombatTextItem[]>([]);
  const [bullets, setBullets] = useState<BulletAnim[]>([]);
  const [rockets, setRockets] = useState<RocketAnim[]>([]);
  const [activeBirdLock, setActiveBirdLock] = useState<{
    active: boolean;
    targetBirdId: string | null;
    typedChars: string;
  } | null>(null);

  // Player state
  const [playerGrid, setPlayerGrid] = useState<GridCellState[]>(createEmptyGrid);
  const [playerCastleHp, setPlayerCastleHp] = useState(CASTLE_HP);
  const [playerBoost] = useState(0);
  const [playerBazookaCooldown, setPlayerBazookaCooldown] = useState(0);
  const [playerBirdCooldown, setPlayerBirdCooldown] = useState(0);
  const [playerBirds, setPlayerBirds] = useState<BirdState[]>([]);

  // Bot state
  const [botGrid, setBotGrid] = useState<GridCellState[]>(createEmptyGrid);
  const [botCastleHp, setBotCastleHp] = useState(CASTLE_HP);
  const [botBoost] = useState(0);
  const [botBazookaCooldown] = useState(0);
  const [botBirdCooldown] = useState(0);
  const [botBirds, setBotBirds] = useState<BirdState[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const isBotRunningRef = useRef(false);
  const currentStep: TutorialStepDef = TUTORIAL_STEPS[stepIndex] ?? TUTORIAL_STEPS[0]!;

  const goToStep = useCallback((newIndex: number) => {
    isBotRunningRef.current = false;
    setDraft("");
    setFeedback("");
    setHasError(false);
    setStepIndex(newIndex);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, [stepIndex]);

  const handleToggleMute = () => {
    setMuted(sound.toggleMute());
  };

  const addCombatText = useCallback((text: string, type: "damage" | "heal" | "info", location: string) => {
    const item: CombatTextItem = {
      id: Math.random().toString(),
      text,
      type,
      location,
    };
    setCombatTexts((prev) => [...prev, item]);
  }, []);

  const runBotStep = useCallback((step: number) => {
    if (isBotRunningRef.current) return;
    isBotRunningRef.current = true;

    if (step === 3) {
      // Step 3 (B4): Bot load ammo 2 - Shot 1
      sound.playPistol();
      setBullets([{ id: Math.random().toString(), fromOpponent: true, shooterCellId: 2, hitCellId: 1, lane: 3 }]);
      addCombatText("BOT: LOAD & FIRE!", "damage", "cell-2-opp");

      setTimeout(() => {
        sound.playHit();
        setPlayerGrid((grid) =>
          grid.map((c) =>
            c.id === 1 && c.object?.type === "PROTECTOR"
              ? { id: 1, object: { ...c.object, hp: Math.max(0, c.object.hp - 5) } }
              : c,
          ),
        );
        addCombatText("-5 HP (CHẶN ĐẠN!)", "info", "cell-1-self");
        setBullets([]);

        setTimeout(() => {
          goToStep(4);
        }, 1000);
      }, 500);
    } else if (step === 4) {
      // Step 4 (B5): Bot load ammo 2 - Shot 2
      sound.playPistol();
      setBullets([{ id: Math.random().toString(), fromOpponent: true, shooterCellId: 2, hitCellId: 1, lane: 3 }]);
      addCombatText("BOT: SHOT 2!", "damage", "cell-2-opp");

      setTimeout(() => {
        sound.playHit();
        setPlayerGrid((grid) =>
          grid.map((c) =>
            c.id === 1 && c.object?.type === "PROTECTOR"
              ? { id: 1, object: { ...c.object, hp: Math.max(0, c.object.hp - 5) } }
              : c,
          ),
        );
        addCombatText("-5 HP (CHẶN ĐẠN!)", "info", "cell-1-self");
        setBullets([]);

        setTimeout(() => {
          goToStep(5);
        }, 1000);
      }, 500);
    } else if (step === 5) {
      // Step 5 (B6): Bot load ammo 2 - Shot 3, followed by 5 more shots breaking shield and damaging castle!
      // Shot 3 (Protector 20 -> 15 HP)
      sound.playPistol();
      setBullets([{ id: Math.random().toString(), fromOpponent: true, shooterCellId: 2, hitCellId: 1, lane: 3 }]);
      addCombatText("BOT: PHÁT 3/8!", "damage", "cell-2-opp");

      setTimeout(() => {
        sound.playHit();
        setPlayerGrid((grid) =>
          grid.map((c) =>
            c.id === 1 && c.object?.type === "PROTECTOR"
              ? { id: 1, object: { ...c.object, hp: 15 } }
              : c,
          ),
        );
        addCombatText("-5 HP (15/30)", "info", "cell-1-self");
        setBullets([]);

        // Shot 4 (Protector 15 -> 10 HP)
        setTimeout(() => {
          sound.playPistol();
          setBullets([{ id: Math.random().toString(), fromOpponent: true, shooterCellId: 2, hitCellId: 1, lane: 3 }]);
          addCombatText("BOT: PHÁT 4/8!", "damage", "cell-2-opp");

          setTimeout(() => {
            sound.playHit();
            setPlayerGrid((grid) =>
              grid.map((c) =>
                c.id === 1 && c.object?.type === "PROTECTOR"
                  ? { id: 1, object: { ...c.object, hp: 10 } }
                  : c,
              ),
            );
            addCombatText("-5 HP (10/30)", "info", "cell-1-self");
            setBullets([]);

            // Shot 5 (Protector 10 -> 5 HP)
            setTimeout(() => {
              sound.playPistol();
              setBullets([{ id: Math.random().toString(), fromOpponent: true, shooterCellId: 2, hitCellId: 1, lane: 3 }]);
              addCombatText("BOT: PHÁT 5/8!", "damage", "cell-2-opp");

              setTimeout(() => {
                sound.playHit();
                setPlayerGrid((grid) =>
                  grid.map((c) =>
                    c.id === 1 && c.object?.type === "PROTECTOR"
                      ? { id: 1, object: { ...c.object, hp: 5 } }
                      : c,
                  ),
                );
                addCombatText("-5 HP (5/30)", "info", "cell-1-self");
                setBullets([]);

                // Shot 6 (Protector 5 -> 0 HP: BỂ KHIÊN!)
                setTimeout(() => {
                  sound.playPistol();
                  setBullets([{ id: Math.random().toString(), fromOpponent: true, shooterCellId: 2, hitCellId: 1, lane: 3 }]);
                  addCombatText("BOT: PHÁT 6/8!", "damage", "cell-2-opp");

                  setTimeout(() => {
                    sound.playHit();
                    // Shield shatters completely
                    setPlayerGrid((grid) => grid.map((c) => (c.id === 1 ? { id: 1, object: null } : c)));
                    addCombatText("💥 BỂ KHIÊN!", "damage", "cell-1-self");
                    setBullets([]);

                    // Shot 7 (No shield left! Bullet flies straight to Castle: 200 -> 195 HP)
                    setTimeout(() => {
                      sound.playPistol();
                      setBullets([{ id: Math.random().toString(), fromOpponent: true, shooterCellId: 2, hitCellId: null, lane: 3 }]);
                      addCombatText("BOT: PHÁT 7/8!", "damage", "cell-2-opp");

                      setTimeout(() => {
                        sound.playHit();
                        setPlayerCastleHp(190);
                        addCombatText("-10 HP (TRÚNG THÀNH!)", "damage", "self-castle");
                        setBullets([]);

                        // Shot 8 (Castle damaged further: 190 -> 175 HP, -25 HP total!)
                        setTimeout(() => {
                          sound.playPistol();
                          setBullets([{ id: Math.random().toString(), fromOpponent: true, shooterCellId: 2, hitCellId: null, lane: 3 }]);
                          addCombatText("BOT: PHÁT 8/8!", "damage", "cell-2-opp");

                          setTimeout(() => {
                            sound.playHit();
                            setPlayerCastleHp(175);
                            addCombatText("-15 HP (LÂU ĐÀI HƯ HẠI!)", "damage", "self-castle");
                            setBullets([]);

                            setTimeout(() => {
                              goToStep(6);
                            }, 800);
                          }, 400);
                        }, 500);
                      }, 400);
                    }, 500);
                  }, 400);
                }, 500);
              }, 400);
            }, 500);
          }, 400);
        }, 500);
      }, 400);
    } else if (step === 9) {
      // Step 9 (B10): Bazooka ready & Bot deploys Area C obstacles
      sound.playHeal();
      addCombatText("BAZOOKA READY! (1 MIN COOLDOWN)", "heal", "self-castle");
      setBotGrid((grid) =>
        grid.map((c) => {
          if (c.id === 1) return { id: 1, object: { type: "PROTECTOR", hp: 10, maxHp: PROTECTOR_HP } };
          if (c.id === 2) return { id: 2, object: { type: "PISTOL", hp: 10, maxHp: PISTOL_HP, ammo: 0, maxAmmo: PISTOL_MAX_AMMO } };
          if (c.id === 4) return { id: 4, object: { type: "CLAY", hp: 10, maxHp: CLAY_HP } };
          if (c.id === 5) return { id: 5, object: { type: "WATER", hp: 5, maxHp: WATER_HP } };
          return c;
        }),
      );
      addCombatText("BOT: AREA C DEFENSES READY", "info", "cell-5-opp");
      setTimeout(() => {
        goToStep(10);
      }, 1500);
    } else if (step === 12) {
      // Step 12 (B13): Bot bird and bomb
      sound.playBirdSpawn();
      const newBotBird: BirdState = {
        id: generateUUID(),
        hp: BIRD_HP,
        maxHp: BIRD_HP,
        createdAt: Date.now(),
        flightDurationMs: BIRD_FLIGHT_TIME_MS,
        ticksRemaining: 5,
        word: BIRD_DEFENSE_WORD,
      };
      setBotBirds([newBotBird]);
      setActiveBirdLock({
        active: true,
        targetBirdId: newBotBird.id,
        typedChars: "",
      });
      addCombatText("BOT: BIRD INCOMING!", "damage", "opponent-castle");

      setTimeout(() => {
        goToStep(13);
      }, 1500);
    }
  }, [addCombatText, goToStep]);

  useEffect(() => {
    if (!currentStep.isBotAction) return;

    const timer = setTimeout(() => {
      runBotStep(stepIndex);
    }, 1200);

    return () => clearTimeout(timer);
  }, [stepIndex, currentStep.isBotAction, runBotStep]);

  const triggerBotActionNow = () => {
    if (currentStep.isBotAction && !isBotRunningRef.current) {
      runBotStep(stepIndex);
    } else if (stepIndex === 5 && isBotRunningRef.current) {
      // Fast forward the multi-shot barrage immediately
      setPlayerGrid((grid) => grid.map((c) => (c.id === 1 ? { id: 1, object: null } : c)));
      setPlayerCastleHp(185);
      setBullets([]);
      addCombatText("💥 BỂ KHIÊN & HƯ HẠI LÂU ĐÀI (185/200 HP)", "damage", "self-castle");
      goToStep(6);
    } else if (stepIndex === 9) {
      setBotGrid((grid) =>
        grid.map((c) => {
          if (c.id === 1) return { id: 1, object: { type: "PROTECTOR", hp: 10, maxHp: PROTECTOR_HP } };
          if (c.id === 2) return { id: 2, object: { type: "PISTOL", hp: 10, maxHp: PISTOL_HP, ammo: 0, maxAmmo: PISTOL_MAX_AMMO } };
          if (c.id === 4) return { id: 4, object: { type: "CLAY", hp: 10, maxHp: CLAY_HP } };
          if (c.id === 5) return { id: 5, object: { type: "WATER", hp: 5, maxHp: WATER_HP } };
          return c;
        }),
      );
      goToStep(10);
    }
  };

  const executeCommandStep = (cmd: string) => {
    setFeedback("");
    setHasError(false);

    // Step 0 (B1: pistol 5)
    if (stepIndex === 0 && cmd === "pistol 5") {
      setPlayerGrid((grid) =>
        grid.map((c) =>
          c.id === 5
            ? {
                id: 5,
                object: {
                  type: "PISTOL",
                  hp: PISTOL_HP,
                  maxHp: PISTOL_HP,
                  ammo: 0,
                  maxAmmo: PISTOL_MAX_AMMO,
                },
              }
            : c,
        ),
      );
      sound.playPistol();
      addCombatText("+PISTOL (0 AMMO)", "info", "cell-5-self");
      goToStep(1);
      return;
    }

    // Step 1 (B2: load ammo 5)
    if (stepIndex === 1 && cmd === "load ammo 5") {
      setPlayerGrid((grid) =>
        grid.map((c) =>
          c.id === 5 && c.object?.type === "PISTOL"
            ? { id: 5, object: { ...c.object, ammo: Math.min(PISTOL_MAX_AMMO, c.object.ammo + 2) } }
            : c,
        ),
      );
      sound.playPistol();
      setBullets([{ id: Math.random().toString(), fromOpponent: false, shooterCellId: 5, hitCellId: null, lane: 2 }]);
      setTimeout(() => {
        sound.playHit();
        setBotCastleHp((hp) => Math.max(0, hp - 5));
        addCombatText("-5 HP", "damage", "opponent-castle");
        setBullets([]);
      }, 500);
      goToStep(2);
      return;
    }

    // Step 2 (B3: protector 1) -> places protector at cell 1, bot places pistol at cell 2
    if (stepIndex === 2 && cmd === "protector 1") {
      setPlayerGrid((grid) =>
        grid.map((c) =>
          c.id === 1 ? { id: 1, object: { type: "PROTECTOR", hp: PROTECTOR_HP, maxHp: PROTECTOR_HP } } : c,
        ),
      );
      sound.playHit();
      addCombatText(`+PROTECTOR (${PROTECTOR_HP} HP)`, "info", "cell-1-self");

      // Bot reacts immediately: places pistol at cell 2!
      setBotGrid((grid) =>
        grid.map((c) =>
          c.id === 2
            ? {
                id: 2,
                object: {
                  type: "PISTOL",
                  hp: PISTOL_HP,
                  maxHp: PISTOL_HP,
                  ammo: 10,
                  maxAmmo: PISTOL_MAX_AMMO,
                },
              }
            : c,
        ),
      );
      addCombatText("BOT: +PISTOL", "info", "cell-2-opp");

      goToStep(3);
      return;
    }

    // Step 6 (B7: add water 9)
    if (stepIndex === 6 && cmd === "add water 9") {
      setPlayerGrid((grid) =>
        grid.map((c) =>
          c.id === 9 ? { id: 9, object: { type: "WATER", hp: WATER_HP, maxHp: WATER_HP } } : c,
        ),
      );
      sound.playHit();
      addCombatText(`+WATER (${WATER_HP} HP)`, "info", "cell-9-self");
      goToStep(7);
      return;
    }

    // Step 7 (B8: add clay 9) -> combines with water at cell 9 into Brick
    if (stepIndex === 7 && cmd === "add clay 9") {
      setPlayerGrid((grid) =>
        grid.map((c) =>
          c.id === 9
            ? {
                id: 9,
                object: {
                  type: "BRICK",
                  hp: BRICK_HP,
                  maxHp: BRICK_HP,
                },
              }
            : c,
        ),
      );
      sound.playHeal();
      addCombatText(`+BRICK (${BRICK_HP} HP)`, "info", "cell-9-self");
      goToStep(8);
      return;
    }

    // Step 8 (B9: use brick 9) -> heals player castle +25 HP
    if (
      stepIndex === 8 &&
      (cmd === "use brick 9" || cmd === "add brick 9")
    ) {
      setPlayerGrid((grid) =>
        grid.map((c) => (c.id === 9 ? { id: 9, object: null } : c)),
      );
      setPlayerCastleHp(CASTLE_HP);
      sound.playHeal();
      addCombatText("+25 HP HEAL!", "heal", "self-castle");
      goToStep(9);
      return;
    }

    // Step 10 (B11: bazooka c) -> fires rockets into Area C, wiping out obstacles and starts 1-min cooldown
    if (stepIndex === 10 && cmd === "bazooka c") {
      sound.playBazooka();
      setRockets([
        { id: Math.random().toString(), fromOpponent: false, targetCellId: 5 },
        { id: Math.random().toString(), fromOpponent: false, targetCellId: 2 },
      ]);
      setPlayerBazookaCooldown(Date.now() + 60000);

      setTimeout(() => {
        sound.playHit();
        setBotGrid((grid) =>
          grid.map((c) => ([1, 2, 4, 5].includes(c.id) ? { id: c.id, object: null } : c)),
        );
        addCombatText("AREA C DESTROYED! (-10 AOE)", "damage", "cell-5-opp");
        setRockets([]);
      }, 700);

      goToStep(11);
      return;
    }

    // Step 11 (B12: bird and bomb) -> player launches bird, inflicts 20 dmg to bot castle, triggers 60s cooldown
    if (stepIndex === 11 && cmd === "bird and bomb") {
      sound.playBirdSpawn();
      setPlayerBirdCooldown(Date.now() + 60000);
      const birdId = generateUUID();
      const newBird: BirdState = {
        id: birdId,
        hp: BIRD_HP,
        maxHp: BIRD_HP,
        createdAt: Date.now(),
        flightDurationMs: BIRD_FLIGHT_TIME_MS,
        ticksRemaining: 5,
        word: "typelorebomb",
      };
      setPlayerBirds([newBird]);

      setTimeout(() => {
        setPlayerBirds((birds) => birds.map((b) => (b.id === birdId ? { ...b, ticksRemaining: 3 } : b)));
      }, 400);

      setTimeout(() => {
        setPlayerBirds((birds) => birds.map((b) => (b.id === birdId ? { ...b, ticksRemaining: 1 } : b)));
      }, 800);

      setTimeout(() => {
        setPlayerBirds((birds) => birds.map((b) => (b.id === birdId ? { ...b, ticksRemaining: 0 } : b)));
      }, 1200);

      setTimeout(() => {
        sound.playHit();
        setPlayerBirds([]);
        setBotCastleHp((hp) => Math.max(0, hp - 20));
        addCombatText("-20 HP (BIRD BOMB!)", "damage", "opponent-castle");
        goToStep(12);
      }, 1500);

      return;
    }

    // Step 14 (B15: load ammo 5) -> final shot finishes 15 HP of bot castle, victory!
    if (stepIndex === 14 && cmd === "load ammo 5") {
      sound.playPistol();
      setBullets([{ id: Math.random().toString(), fromOpponent: false, shooterCellId: 5, hitCellId: null, lane: 2 }]);

      setTimeout(() => {
        sound.playHit();
        setBotCastleHp(0);
        addCombatText("-15 HP (VICTORY!)", "damage", "opponent-castle");
        setBullets([]);
        sound.playVictory();
        setIsCompleted(true);
      }, 500);

      return;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (currentStep.isBotAction) return;

    const val = e.target.value;

    if (currentStep.isBirdDefense) {
      // In bird defense step, typing matches the bird's 12-char word
      const nextChar = val.slice(-1).toLowerCase();
      if (!/^[a-z]$/.test(nextChar)) return;

      const currentTyped = activeBirdLock?.typedChars ?? "";
      const expectedChar = BIRD_DEFENSE_WORD[currentTyped.length];

      if (nextChar === expectedChar) {
        const nextTyped = currentTyped + nextChar;
        sound.playTyping();
        setFeedback("");
        setHasError(false);

        // Every 4 chars: fire arrow and damage bird
        if (nextTyped.length === 4 || nextTyped.length === 8 || nextTyped.length === 12) {
          sound.playArrow();
          addCombatText("-5 HP (ARROW)", "damage", "opponent-castle");
          setBotBirds((birds) =>
            birds.map((b) => ({ ...b, hp: Math.max(0, b.hp - 5) })),
          );
        }

        if (nextTyped.length >= BIRD_DEFENSE_WORD.length) {
          sound.playHit();
          setBotBirds([]);
          setActiveBirdLock(null);
          // Set Bot castle HP to exactly 15 as requested for Step 15!
          setBotCastleHp(15);
          addCombatText("BIRD DESTROYED!", "info", "opponent-castle");
          goToStep(14);
        } else {
          setActiveBirdLock((prev) => (prev ? { ...prev, typedChars: nextTyped } : null));
        }
      } else {
        sound.playError();
        setHasError(true);
        setFeedback(isEn ? `⚠️ Type letter: "${expectedChar}"` : `⚠️ Ký tự cần gõ tiếp theo: "${expectedChar}"`);
      }
      return;
    }

    const typedLower = val.toLowerCase();

    // Special handling for Step 8 (B9: use brick 9)
    if (stepIndex === 8) {
      if (typedLower === "use brick 9" || typedLower === "add brick 9") {
        setDraft("");
        executeCommandStep("use brick 9");
        return;
      }
      if ("use brick 9".startsWith(typedLower) || "add brick 9".startsWith(typedLower)) {
        setDraft(val);
        setHasError(false);
        setFeedback("");
        sound.playTyping();
      } else {
        sound.playError();
        setHasError(true);
        setFeedback(isEn ? `⚠️ Step requires: "use brick 9"` : `⚠️ Bước này yêu cầu gõ: "use brick 9"`);
      }
      return;
    }

    const req = currentStep.requiredCommand.toLowerCase().trim();
    const typedTrimmed = typedLower.trim();

    // Check if what user typed matches the required command
    if (typedLower === req || typedTrimmed === req) {
      setDraft("");
      executeCommandStep(req);
      return;
    }

    // Check if what user typed is a valid prefix of the required command
    if (req.startsWith(typedLower)) {
      setDraft(val);
      setHasError(false);
      setFeedback("");
      sound.playTyping();
    } else {
      // Block invalid keys that deviate from the tutorial command
      sound.playError();
      setHasError(true);
      setFeedback(isEn ? `⚠️ Tutorial requires: "${currentStep.requiredCommand}"` : `⚠️ Bước này yêu cầu gõ: "${currentStep.requiredCommand}"`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (currentStep.isBotAction) {
        triggerBotActionNow();
        return;
      }
      const trimmed = draft.trim().toLowerCase();
      const req = currentStep.requiredCommand.toLowerCase().trim();
      if (
        trimmed === req ||
        (stepIndex === 8 &&
          (trimmed === "use brick 9" || trimmed === "add brick 9"))
      ) {
        setDraft("");
        executeCommandStep(req);
      } else {
        sound.playError();
        setHasError(true);
        setFeedback(
          stepIndex === 8
            ? (isEn ? `⚠️ Step requires: "use brick 9"` : `⚠️ Bước này yêu cầu gõ: "use brick 9"`)
            : (isEn ? `⚠️ Tutorial requires: "${currentStep.requiredCommand}"` : `⚠️ Bước này yêu cầu gõ: "${currentStep.requiredCommand}"`)
        );
      }
    }
  };

  // Mock GameState objects for sub-components
  const mockPlayer: PlayerBattlefieldState = {
    slot: "PLAYER_1",
    connectionId: "player",
    castle: { hp: playerCastleHp, maxHp: CASTLE_HP },
    bazookaCooldownUntil: playerBazookaCooldown,
    bazookaBoost: playerBoost,
    birdCooldownUntil: playerBirdCooldown,
    birds: playerBirds,
    grid: playerGrid,
  };

  const mockBot: PlayerBattlefieldState = {
    slot: "PLAYER_2",
    connectionId: "bot",
    castle: { hp: botCastleHp, maxHp: CASTLE_HP },
    bazookaCooldownUntil: botBazookaCooldown,
    bazookaBoost: botBoost,
    birdCooldownUntil: botBirdCooldown,
    birds: botBirds,
    grid: botGrid,
  };

  const progressPercent = Math.round(((stepIndex + 1) / TUTORIAL_STEPS.length) * 100);

  return (
    <section
      className={styles.tutorialContainer}
      data-screen="tutorial"
      aria-label="Battlefield"
    >
      {/* 1. Tutorial Top Guide Banner */}
      <header className={styles.tutorialBanner} aria-label={isEn ? "Tutorial Guide" : "Bảng hướng dẫn"}>
        <div className={styles.bannerTopRow}>
          <span className={styles.stepBadge}>
            {isEn ? `Step ${stepIndex + 1}/${TUTORIAL_STEPS.length}` : `Bước ${stepIndex + 1}/${TUTORIAL_STEPS.length}`}
          </span>
          <div className={styles.bannerActions}>
            <LanguageToggle />
            <button
              type="button"
              className={styles.muteBtn}
              onClick={handleToggleMute}
              aria-label={muted ? t("soundMuted") : t("soundOn")}
            >
              {muted ? t("soundMuted") : t("soundOn")}
            </button>
            <button
              type="button"
              className={styles.exitBtn}
              onClick={onExit}
              title={isEn ? "Exit Tutorial" : "Dừng hướng dẫn"}
            >
              ❌ {isEn ? "Exit Tutorial" : "Dừng hướng dẫn"}
            </button>
          </div>
        </div>

        <div className={styles.stepProgressBar} aria-hidden="true">
          <div className={styles.stepProgressFill} style={{ width: `${progressPercent}%` }} />
        </div>

        <div className={styles.stepContentRow}>
          <div className={styles.stepTextContainer}>
            <h2 className={styles.stepTitle}>
              {isEn ? currentStep.titleEn : currentStep.titleVi}
            </h2>
            <p className={styles.stepDesc}>
              {isEn ? currentStep.descEn : currentStep.descVi}
            </p>
          </div>

          <div className={styles.stepCommandPill}>
            <span className={styles.commandLabel}>{isEn ? "Target Command:" : "Lệnh cần gõ:"}</span>
            <span className={styles.commandText}>
              {currentStep.isBotAction
                ? (isEn ? "BOT ACTION" : "BOT THỰC HIỆN")
                : currentStep.isBirdDefense
                ? (isEn ? "Type Bird Letters" : "Gõ 12 chữ cái trên chim")
                : currentStep.requiredCommand}
            </span>
          </div>
        </div>
      </header>

      {/* 2. Main Arena & Command Input */}
      <div className={styles.stageWrapper}>
        <div className={styles.mainColumn}>
          {/* Top HUD Bar */}
          <header className={bStyles.topHud} aria-label="HUD">
            <div className={bStyles.hudOpponent}>
              <span className={bStyles.hudLabel}>BOT (AI)</span>
              <div className={bStyles.hudHpRow}>
                <span className={bStyles.hudHpText}>HP {mockBot.castle.hp}/{CASTLE_HP}</span>
                <progress
                  className={bStyles.hudHpBarOpponent}
                  value={mockBot.castle.hp}
                  max={CASTLE_HP}
                  aria-label="Bot HP"
                />
              </div>
              <div className={bStyles.hudBirdRow}>
                <span className={bStyles.hudBirdIcon} aria-hidden="true">🦅</span>
                <span className={`${bStyles.hudBirdText} ${mockBot.birds.length > 0 ? bStyles.hudBirdCooldown : bStyles.hudBirdReady}`}>
                  BIRD {mockBot.birds.length > 0 ? "ATTACKING!" : "READY"}
                </span>
              </div>
              <div className={bStyles.hudBazookaRow}>
                <span className={bStyles.hudBazookaIcon} aria-hidden="true">🚀</span>
                <span className={`${bStyles.hudBazookaText} ${bStyles.hudBazookaReady}`}>
                  BAZOOKA READY
                </span>
              </div>
            </div>

            <div className={bStyles.hudCenter}>
              <span className={bStyles.vsCenterBadge}>VS</span>
            </div>

            <div className={bStyles.hudSelf}>
              <span className={bStyles.hudLabel}>{isEn ? "YOU (TRAINEE)" : "BẠN (HỌC VIÊN)"}</span>
              <div className={bStyles.hudHpRow}>
                <span className={bStyles.hudHpText}>HP {mockPlayer.castle.hp}/{CASTLE_HP}</span>
                <progress
                  className={bStyles.hudHpBarSelf}
                  value={mockPlayer.castle.hp}
                  max={CASTLE_HP}
                  aria-label="Player HP"
                />
              </div>
              <div className={bStyles.hudBirdRow}>
                <span className={`${bStyles.hudBirdText} ${playerBirdCooldown > now ? bStyles.hudBirdCooldown : bStyles.hudBirdReady}`}>
                  BIRD {playerBirdCooldown > now ? "COOLDOWN (60s)" : "READY"}
                </span>
                <span className={bStyles.hudBirdIcon} aria-hidden="true">🦅</span>
              </div>
              <div className={bStyles.hudBazookaRow}>
                <span className={`${bStyles.hudBazookaText} ${playerBazookaCooldown > now ? bStyles.hudBazookaCooldown : bStyles.hudBazookaReady}`}>
                  BAZOOKA {playerBazookaCooldown > now ? `${Math.max(0, Math.ceil((playerBazookaCooldown - now) / 1000))}s` : "READY"}
                </span>
                <span className={bStyles.hudBazookaIcon} aria-hidden="true">🚀</span>
              </div>
            </div>
          </header>

          {/* 5-Column Arena Container */}
          <div className={bStyles.arenaContainer}>
            <FloatingCombatText items={combatTexts} />
            <CombatAnimationLayer
              selfBirds={mockPlayer.birds}
              opponentBirds={mockBot.birds}
              bullets={bullets}
              rockets={rockets}
              activeBirdLock={activeBirdLock}
            />

            <div className={bStyles.arenaStage}>
              {/* Bot Castle Tower */}
              <CastleTower
                castle={mockBot.castle}
                bazookaCooldownUntil={mockBot.bazookaCooldownUntil}
                birdCooldownUntil={mockBot.birdCooldownUntil}
                opponent={true}
              />

              {/* Bot Grid (Opponent) */}
              <div className={`${bStyles.gridSection} ${bStyles.gridOpponent}`}>
                <div className={bStyles.gridSectionHeader}>BOT GRID</div>
                <Grid
                  cells={mockBot.grid}
                  opponent={true}
                  label="Bot"
                  highlightAreaId={currentStep.targetAreaId}
                />
              </div>

              {/* Central Neutral Corridor */}
              <CombatCorridor
                selfBirds={mockPlayer.birds}
                opponentBirds={mockBot.birds}
                selfGrid={mockPlayer.grid}
                opponentGrid={mockBot.grid}
              />

              {/* Player Grid (Self) */}
              <div className={`${bStyles.gridSection} ${bStyles.gridSelf}`}>
                <div className={bStyles.gridSectionHeader}>{isEn ? "YOUR GRID" : "LƯỚI CỦA BẠN"}</div>
                <Grid
                  cells={mockPlayer.grid}
                  opponent={false}
                  label="Player"
                  highlightCellId={currentStep.targetCellId}
                />
              </div>

              {/* Player Castle Tower */}
              <CastleTower
                castle={mockPlayer.castle}
                bazookaCooldownUntil={mockPlayer.bazookaCooldownUntil}
                birdCooldownUntil={mockPlayer.birdCooldownUntil}
                opponent={false}
              />
            </div>

            <div className={bStyles.arenaFloor} aria-hidden="true">
              <span className={bStyles.floorRail} />
              <span className={bStyles.floorBadge}>{t("arenaFloor")}</span>
              <span className={bStyles.floorRail} />
            </div>
          </div>

          {/* Tutorial Strict Input Section */}
          <div className={`${styles.inputSection} ${hasError ? styles.inputSectionError : styles.inputSectionFocus}`}>
            <div className={styles.inputHeaderRow}>
              <label htmlFor="tutorial-input" className={styles.inputLabel}>
                {currentStep.isBotAction
                  ? (isEn ? "🤖 BOT ACTION IN PROGRESS:" : "🤖 BOT ĐANG THỰC HIỆN HÀNH ĐỘNG:")
                  : currentStep.isBirdDefense
                  ? (isEn ? "🎯 TYPE BIRD LETTERS TO FIRE ARROWS:" : "🎯 GÕ CHỮ TRÊN CHIM ĐỂ BẮN TÊN:")
                  : (isEn ? "⌨️ TYPE INSTRUCTED COMMAND:" : "⌨️ NHẬP LỆNH THEO HƯỚNG DẪN:")}
              </label>
              <span className={styles.inputHint}>
                {isEn ? currentStep.hintEn : currentStep.hintVi}
              </span>
            </div>

            {currentStep.isBotAction ? (
              <div className={styles.botActionControlRow}>
                <span className={styles.botActionNotice}>
                  🤖 {isEn ? "Bot is executing action..." : "Bot đang thực hiện thao tác..."}
                </span>
                <button
                  type="button"
                  className={styles.botNextBtn}
                  onClick={triggerBotActionNow}
                  title={isEn ? "Skip delay and execute now (Enter)" : "Bỏ qua chờ, thực hiện ngay (Enter)"}
                >
                  ⏩ {isEn ? "Fast Forward (Enter)" : "Thực hiện ngay (Enter)"}
                </button>
              </div>
            ) : (
              <input
                ref={inputRef}
                id="tutorial-input"
                type="text"
                className={styles.inputField}
                value={currentStep.isBirdDefense ? (activeBirdLock?.typedChars ?? "") : draft}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  currentStep.isBirdDefense
                    ? `> Type: "${BIRD_DEFENSE_WORD}" (${activeBirdLock?.typedChars.length ?? 0}/12)`
                    : `> Type: "${currentStep.requiredCommand}"`
                }
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            )}

            <div className={styles.feedbackMsg}>
              {feedback ? (
                <span className={styles.feedbackError}>{feedback}</span>
              ) : (
                <span className={styles.feedbackSuccess}>
                  {currentStep.isBotAction
                    ? (isEn ? "Bot is acting automatically. You can observe or press Enter to advance." : "Bot tự động hành động. Bạn có thể quan sát hoặc bấm Enter để tiếp tục.")
                    : currentStep.isBirdDefense
                    ? (isEn ? `Type 12 characters: "${BIRD_DEFENSE_WORD}"` : `Gõ 12 chữ cái: "${BIRD_DEFENSE_WORD}"`)
                    : (isEn ? `Press keys matching: "${currentStep.requiredCommand}"` : `Chỉ gõ phím theo đúng lệnh: "${currentStep.requiredCommand}"`)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column Cheatsheet */}
        <aside className={styles.cheatsheetSidebar} aria-label="Cheatsheet">
          <CommandHud />
        </aside>
      </div>

      {/* 3. Victory Completion Modal */}
      {isCompleted && (
        <div className={styles.victoryOverlay} role="dialog" aria-modal="true">
          <div className={styles.victoryCard}>
            <div className={styles.trophyIcon} aria-hidden="true">🏆</div>
            <h2 className={styles.victoryTitle}>
              {isEn ? "TUTORIAL COMPLETED!" : "HOÀN THÀNH KHÓA HUẤN LUYỆN!"}
            </h2>
            <p className={styles.victoryDesc}>
              {isEn
                ? "Congratulations! You have mastered all battle operations and commands in Typelore: Firearms, ammo loading, tanker shields, resource gathering, healing, brick wall construction, Bazooka AOE barrage, bombing birds, and air defense."
                : "Chúc mừng bạn! Bạn đã thành thạo toàn bộ thao tác và lệnh chiến đấu trong Typelore: Đặt súng lục, nạp đạn, khiên bảo vệ, khai thác đất sét & nước, đúc gạch hồi máu, dựng tường gạch, pháo bazooka oanh tạc, thả chim ném bom và bắn hạ chim địch."}
            </p>

            <div className={styles.learnedList}>
              <span className={styles.learnedBadge}>✓ pistol</span>
              <span className={styles.learnedBadge}>✓ load ammo</span>
              <span className={styles.learnedBadge}>✓ protector</span>
              <span className={styles.learnedBadge}>✓ add clay</span>
              <span className={styles.learnedBadge}>✓ add water</span>
              <span className={styles.learnedBadge}>✓ use brick</span>
              <span className={styles.learnedBadge}>✓ bazooka</span>
              <span className={styles.learnedBadge}>✓ bird and bomb</span>
              <span className={styles.learnedBadge}>✓ arrow</span>
            </div>

            <button type="button" className={styles.finishBtn} onClick={onExit}>
              {isEn ? "Return to Lobby" : "Hoàn thành & Về Sảnh Chờ"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

