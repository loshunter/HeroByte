// The colour picker is a lazy chunk: its OKLab maths and zone raster load when a
// settings window opens, not with the table (the entry bundle has a 175 KB gzip
// budget). A chunk that fails to load (a deploy renamed it while this tab was
// open) throws during render; this boundary keeps that inside the picker's own
// space instead of the settings window or the app root, and says how to recover.
// No "try again": React caches a lazy payload's rejection (DMMenuLoadFailure).

import { Suspense, lazy } from "react";
import { ErrorBoundary } from "../../../../components/ErrorBoundary";
import type { ColorPickerControl } from "./colorPickerControl";

const ColorPicker = lazy(() =>
  import("./ColorPicker").then((module) => ({ default: module.ColorPicker })),
);

export function LazyColorPicker(control: ColorPickerControl): JSX.Element {
  return (
    <ErrorBoundary
      fallback={
        <p role="alert" className="color-picker__failed">
          The colour picker could not be loaded. Reload the page to pick up the new version; your
          colour is unchanged.
        </p>
      }
    >
      <Suspense fallback={<div className="color-picker__loading">Loading colours…</div>}>
        <ColorPicker {...control} />
      </Suspense>
    </ErrorBoundary>
  );
}
