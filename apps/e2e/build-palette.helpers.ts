import type { Locator, Page } from "@playwright/test";

/** UI navigation only. Keep this expectation independent of product descriptors. */
const groups = {
  terrain: "terrain",
  erase: "terrain",
  room: "structures",
  hallway: "structures",
  wall: "structures",
  door: "structures",
  place: "objects",
  scatter: "objects",
  row: "objects",
  spline: "objects",
  light: "lighting",
  generate: "generate",
  select: null,
  eyedropper: null,
} as const;
export type BuildTool = keyof typeof groups;

export async function chooseBuildTool(root: Page | Locator, tool: BuildTool, touch = false) {
  const group = groups[tool];
  if (group) {
    const select = root.getByRole("combobox", { name: "Tool group", exact: true });
    // A group already activates its remembered tool. Avoid a redundant selection
    // of the current group; a different no-dial group closes the phone sheet.
    if ((await select.inputValue()) !== group) await select.selectOption(group);
    const page = "page" in root ? root.page() : root;
    const dock = page.getByRole("navigation", { name: "Map edit actions", exact: true });
    const sheet = page.getByRole("dialog", { name: "Map tools", exact: true });
    if ((await dock.isVisible()) && !(await sheet.isVisible())) {
      const open = dock.getByRole("button", { name: "Tool", exact: true });
      if (touch) await open.tap();
      else await open.click();
    }
  }
  const button = root.getByTestId(`build-tool-${tool}`);
  if (touch) await button.tap();
  else await button.click();
}
