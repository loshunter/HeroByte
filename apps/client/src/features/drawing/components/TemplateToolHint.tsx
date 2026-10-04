import { templateKindForTool, type DrawTool } from "@herobyte/shared";
import { TEMPLATE_TOOL_DESCRIPTIONS } from "../drawingTools";

/** The active template button names this line as its description (aria-describedby). */
export const TEMPLATE_HINT_ID = "drawing-template-hint";

// What the active area template draws (the desktop toolbar; the phone sheet has its own
// always-present line). Nothing for the annotation tools: their buttons already say
// what they are.
export function TemplateToolHint({ tool }: { tool: DrawTool }) {
  if (!templateKindForTool(tool)) return null;
  return (
    <p id={TEMPLATE_HINT_ID} className="drawing-toolbar__help" data-testid="template-tool-hint">
      {TEMPLATE_TOOL_DESCRIPTIONS[tool as keyof typeof TEMPLATE_TOOL_DESCRIPTIONS]}
    </p>
  );
}
