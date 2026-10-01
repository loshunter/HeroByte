import { templateKindForTool, type DrawTool } from "@herobyte/shared";
import { TEMPLATE_TOOL_DESCRIPTIONS } from "../drawingTools";

// What the active area template draws. Nothing for the annotation tools: their
// buttons already say what they are.
export function TemplateToolHint({ tool }: { tool: DrawTool }) {
  if (!templateKindForTool(tool)) return null;
  return (
    <p className="drawing-toolbar__help" data-testid="template-tool-hint">
      {TEMPLATE_TOOL_DESCRIPTIONS[tool as keyof typeof TEMPLATE_TOOL_DESCRIPTIONS]}
    </p>
  );
}
