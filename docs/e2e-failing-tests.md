# E2E Failing Tests

Pre-existing failures in the Playwright E2E suite (138 total, 92 passing, 46 failing).
All failures confirmed pre-existing as of commit `edbbb0d`.

Run all: `npx playwright test`
Run one: `npx playwright test e2e/specs/<file> --grep "<test name>"`

---

## Calibration — canvas mouse interaction timeouts

| #   | Test                                     | File:Line               | Status |
| --- | ---------------------------------------- | ----------------------- | ------ |
| 1   | draw calibration line shows input        | calibration.spec.ts:128 | TODO   |
| 2   | apply sets scale                         | calibration.spec.ts:159 | TODO   |
| 3   | validation: empty input shows error      | calibration.spec.ts:195 | TODO   |
| 4   | validation: negative value shows error   | calibration.spec.ts:233 | TODO   |
| 5   | validation: zero shows error             | calibration.spec.ts:271 | TODO   |
| 6   | re-calibration overwrites previous scale | calibration.spec.ts:307 | TODO   |

**Pattern:** All require drawing a calibration line via `canvasDrag`. The drag completes but the calibration input never appears (6s timeout). Likely the Fabric canvas mouse events aren't firing correctly in headless Chromium.

---

## Lines — canvas mouse interaction timeouts

| #   | Test                         | File:Line         | Status |
| --- | ---------------------------- | ----------------- | ------ |
| 7   | draw line between two points | lines.spec.ts:30  | TODO   |
| 8   | line appears in object list  | lines.spec.ts:49  | TODO   |
| 9   | line length accuracy         | lines.spec.ts:67  | TODO   |
| 10  | multiple lines               | lines.spec.ts:155 | TODO   |

**Pattern:** Same root cause as calibration — `canvasDrag` doesn't produce Fabric mouse events. Tests timeout at ~11s waiting for a line object to appear in the store.

---

## Undo/Redo — undo doesn't remove last object

| #   | Test                               | File:Line             | Status |
| --- | ---------------------------------- | --------------------- | ------ |
| 11  | undo reverts shape addition        | undo-redo.spec.ts:12  | TODO   |
| 12  | redo restores undone shape         | undo-redo.spec.ts:22  | TODO   |
| 13  | keyboard Cmd+Z triggers undo       | undo-redo.spec.ts:36  | TODO   |
| 14  | keyboard Cmd+Shift+Z triggers redo | undo-redo.spec.ts:46  | TODO   |
| 15  | keyboard Cmd+Y triggers redo       | undo-redo.spec.ts:62  | TODO   |
| 16  | multiple undo steps                | undo-redo.spec.ts:75  | TODO   |
| 17  | rapid undo stress test             | undo-redo.spec.ts:125 | TODO   |

**Pattern:** After adding a shape and pressing undo, `getObjectCount` returns 1 instead of 0. The initial snapshot (captured during `applyCalibrationWithHistory`) may not be capturing a clean baseline, or the history stack isn't properly initialized before the first action.

---

## Keyboard Shortcuts — Delete key and canvas focus

| #   | Test                                  | File:Line                     | Status |
| --- | ------------------------------------- | ----------------------------- | ------ |
| 18  | Delete key removes selected object    | keyboard-shortcuts.spec.ts:5  | TODO   |
| 19  | Backspace key removes selected object | keyboard-shortcuts.spec.ts:24 | TODO   |
| 20  | Cmd+Z triggers undo                   | keyboard-shortcuts.spec.ts:59 | TODO   |
| 21  | Cmd+Shift+Z triggers redo             | keyboard-shortcuts.spec.ts:69 | TODO   |
| 22  | shortcuts work when canvas focused    | keyboard-shortcuts.spec.ts:83 | TODO   |

**Pattern:** Delete/Backspace tests timeout at 30s — the canvas click to select a shape likely doesn't register in Fabric. Undo/redo shortcuts fail with same count mismatch as undo-redo suite.

---

## Save & Load — toast detection and file import

| #   | Test                               | File:Line             | Status |
| --- | ---------------------------------- | --------------------- | ------ |
| 23  | manual load shows toast            | save-load.spec.ts:19  | TODO   |
| 24  | clear storage with confirmation    | save-load.spec.ts:58  | TODO   |
| 25  | import valid JSON restores project | save-load.spec.ts:102 | TODO   |
| 26  | import invalid JSON shows error    | save-load.spec.ts:122 | TODO   |

**Pattern:** Toast detection (`[data-sonner-toast]`) may be timing-sensitive. Import tests use `locator('input[type="file"]')` inside the import button which may not match the actual DOM structure.

---

## Shapes — Fabric object count mismatch

| #   | Test                    | File:Line         | Status |
| --- | ----------------------- | ----------------- | ------ |
| 27  | shape appears on canvas | shapes.spec.ts:45 | TODO   |

**Pattern:** Test expects `getFabricObjects` count >= 2 (background + shape) but gets 1. The background image may not be a separate Fabric object, or the `__fabric.getObjects()` query doesn't include it.

---

## Object Management — reorder

| #   | Test              | File:Line                     | Status |
| --- | ----------------- | ----------------------------- | ------ |
| 28  | move up reorder   | object-management.spec.ts:102 | TODO   |
| 29  | move down reorder | object-management.spec.ts:131 | TODO   |

**Pattern:** After clicking move up/down, the object list order doesn't change as expected. May be a timing issue or the layer reorder isn't reflected in the DOM quickly enough.

---

## Cleanup Mode — visibility toggle

| #   | Test                              | File:Line               | Status |
| --- | --------------------------------- | ----------------------- | ------ |
| 30  | content objects hidden in cleanup | cleanup-mode.spec.ts:79 | TODO   |

**Pattern:** After entering cleanup mode, content objects (shapes) are expected to be hidden on the Fabric canvas but remain visible.

---

## Project Management — trash operations

| #   | Test                   | File:Line                      | Status |
| --- | ---------------------- | ------------------------------ | ------ |
| 31  | restore from trash     | project-management.spec.ts:185 | TODO   |
| 32  | trash toggle show/hide | project-management.spec.ts:245 | TODO   |

**Pattern:** Trash-related UI interactions. May be selector issues with the trash toggle or timing of DOM updates after restore.

---

## Responsive Layout — mobile viewport

| #   | Test                                | File:Line             | Status |
| --- | ----------------------------------- | --------------------- | ------ |
| 33  | sidebar hidden on mobile by default | responsive.spec.ts:4  | TODO   |
| 34  | hamburger button opens sidebar      | responsive.spec.ts:11 | TODO   |
| 35  | backdrop closes sidebar             | responsive.spec.ts:17 | TODO   |
| 36  | close button closes sidebar         | responsive.spec.ts:26 | TODO   |

**Pattern:** Uses a separate mobile project in playwright.config.ts. Sidebar visibility and hamburger menu interactions fail — the responsive CSS/JS toggling may not work as expected at the configured viewport size.

---

## Visual Regression — missing baseline snapshots

| #   | Test                         | File:Line                    | Status |
| --- | ---------------------------- | ---------------------------- | ------ |
| 37  | empty project picker         | visual-regression.spec.ts:6  | TODO   |
| 38  | picker with projects         | visual-regression.spec.ts:10 | TODO   |
| 39  | canvas initial state         | visual-regression.spec.ts:25 | TODO   |
| 40  | wizard step 1                | visual-regression.spec.ts:29 | TODO   |
| 41  | wizard step 2                | visual-regression.spec.ts:35 | TODO   |
| 42  | confirm dialog               | visual-regression.spec.ts:42 | TODO   |
| 43  | cleanup mode UI              | visual-regression.spec.ts:51 | TODO   |
| 44  | calibration panel with input | visual-regression.spec.ts:57 | TODO   |
| 45  | canvas with shapes           | visual-regression.spec.ts:79 | TODO   |
| 46  | sidebar object list          | visual-regression.spec.ts:91 | TODO   |

**Pattern:** No baseline screenshots exist yet. Fix: run `npx playwright test e2e/specs/visual-regression.spec.ts --update-snapshots` once to generate them, then commit the snapshots.
