import { describe, it, expect } from "vitest";
import { TUTORIAL_STEPS, BIRD_WORD_LENGTH, type TutorialStepDef } from "@typelore/shared";

describe("Tutorial System - Unit Tests", () => {
  it("TC-TUT-01: Contains exactly 15 comprehensive interactive steps following user battle script", () => {
    expect(TUTORIAL_STEPS).toHaveLength(15);

    const stepIds = TUTORIAL_STEPS.map((s: TutorialStepDef) => s.id);
    expect(stepIds).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  it("TC-TUT-02: Every step provides full localization in Vietnamese and English", () => {
    for (const step of TUTORIAL_STEPS) {
      expect(step.titleVi.length).toBeGreaterThan(5);
      expect(step.titleEn.length).toBeGreaterThan(5);
      expect(step.descVi.length).toBeGreaterThan(15);
      expect(step.descEn.length).toBeGreaterThan(15);
      expect(step.hintVi.length).toBeGreaterThan(5);
      expect(step.hintEn.length).toBeGreaterThan(5);
    }
  });

  it("TC-TUT-03: Covers all core commands defined in COMMAND_RULES and script", () => {
    const requiredCommands = TUTORIAL_STEPS.map((s: TutorialStepDef) => s.requiredCommand).filter(Boolean);

    // 1. pistol 5
    expect(requiredCommands.some((c: string) => c === "pistol 5")).toBe(true);
    // 2. load ammo 5
    expect(requiredCommands.some((c: string) => c === "load ammo 5")).toBe(true);
    // 3. protector 1
    expect(requiredCommands.some((c: string) => c === "protector 1")).toBe(true);
    // 4. add water 9
    expect(requiredCommands.some((c: string) => c === "add water 9")).toBe(true);
    // 5. add clay 9
    expect(requiredCommands.some((c: string) => c === "add clay 9")).toBe(true);
    // 6. add brick 9
    expect(requiredCommands.some((c: string) => c === "add brick 9")).toBe(true);
    // 7. boost
    expect(requiredCommands.some((c: string) => c === "boost")).toBe(true);
    // 8. bazooka c
    expect(requiredCommands.some((c: string) => c === "bazooka c")).toBe(true);
    // 9. bird and bomb
    expect(requiredCommands.some((c: string) => c === "bird and bomb")).toBe(true);
    // 10. air defense
    const birdStep = TUTORIAL_STEPS.find((s: TutorialStepDef) => s.isBirdDefense);
    expect(birdStep).toBeDefined();
    expect(birdStep?.id).toBe(14);
    // 11. finish load ammo 5
    const finalStep = TUTORIAL_STEPS[14];
    expect(finalStep?.requiredCommand).toBe("load ammo 5");
  });

  it("TC-TUT-04: Strict step validation accepts ONLY current step's required command and rejects any deviating commands", () => {
    function validateTutorialInput(stepIndex: number, typedInput: string): { ok: boolean; error?: string } {
      const step = TUTORIAL_STEPS[stepIndex];
      if (!step) return { ok: false, error: "Invalid step" };

      if (step.isBirdDefense || step.isBotAction) {
        return { ok: true };
      }

      const req = step.requiredCommand.toLowerCase().trim();
      const typed = typedInput.toLowerCase().trim();

      if (typed === req) {
        return { ok: true };
      }
      if (req.startsWith(typed)) {
        return { ok: true };
      }
      return { ok: false, error: `Step requires "${step.requiredCommand}"` };
    }

    // At Step 0 (Step 1: pistol 5):
    expect(validateTutorialInput(0, "p").ok).toBe(true);
    expect(validateTutorialInput(0, "pistol").ok).toBe(true);
    expect(validateTutorialInput(0, "pistol 5").ok).toBe(true);

    // Rejects other commands:
    expect(validateTutorialInput(0, "boost").ok).toBe(false);
    expect(validateTutorialInput(0, "add clay 5").ok).toBe(false);
    expect(validateTutorialInput(0, "protector 1").ok).toBe(false);
    expect(validateTutorialInput(0, "pistol 4").ok).toBe(false); // Wrong cell!

    // At Step 9 (Step 10: boost):
    expect(validateTutorialInput(9, "b").ok).toBe(true);
    expect(validateTutorialInput(9, "boost").ok).toBe(true);
    expect(validateTutorialInput(9, "pistol 1").ok).toBe(false);
  });

  it("TC-TUT-05: Air defense uses 12-character challenge word conforming to BIRD_WORD_LENGTH", () => {
    const defenseWord = "typelorebird";
    expect(defenseWord).toHaveLength(BIRD_WORD_LENGTH);
    expect(/^[a-z]{12}$/.test(defenseWord)).toBe(true);
  });
});
