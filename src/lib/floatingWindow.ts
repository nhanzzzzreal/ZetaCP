// src/lib/floatingWindow.ts
//
// FloatingWindow Registry — central definition for all types of floating windows.
// To add a new window type (e.g., graph-viewer), simply register a new entry
// here. No need to modify any other window management logic.

export interface FloatingWindowDef {
  /** Type name, used for registry lookup */
  type: string;
  /** Prefix of the window label managed by Tauri, e.g., "overlay-widget" */
  labelPrefix: string;
  /** Default size (logical pixels) */
  defaultSize: { width: number; height: number };
  /** Whether to render FloatingPinBar (always-on-top toggle) */
  hasPinBar: boolean;
  /** Short description for UI */
  displayName: string;
}

// ─── Registry ────────────────────────────────────────────────────────────────

const registry = new Map<string, FloatingWindowDef>();

export function registerFloatingWindow(def: FloatingWindowDef): void {
  registry.set(def.labelPrefix, def);
}

export function getFloatingWindowDef(labelPrefix: string): FloatingWindowDef | undefined {
  return registry.get(labelPrefix);
}

export function getDefByLabel(windowLabel: string): FloatingWindowDef | undefined {
  for (const def of registry.values()) {
    if (windowLabel.startsWith(def.labelPrefix + '-')) return def;
  }
  return undefined;
}

export function getAllDefs(): FloatingWindowDef[] {
  return Array.from(registry.values());
}

// ─── Register existing window types ───────────────────────────────────────────

registerFloatingWindow({
  type: 'overlay-widget',
  labelPrefix: 'overlay-widget',
  defaultSize: { width: 420, height: 320 },
  hasPinBar: true,
  displayName: 'Overlay Widget',
});

registerFloatingWindow({
  type: 'overlay-diff',
  labelPrefix: 'overlay-diff',
  defaultSize: { width: 900, height: 600 },
  hasPinBar: true,
  displayName: 'Diff Viewer',
});

// ─── Example: register graph viewer in the future ─────────────────────────────
//
// registerFloatingWindow({
//   type: 'graph-viewer',
//   labelPrefix: 'graph-viewer',
//   defaultSize: { width: 800, height: 600 },
//   hasPinBar: true,
//   displayName: 'Graph Viewer',
// });
