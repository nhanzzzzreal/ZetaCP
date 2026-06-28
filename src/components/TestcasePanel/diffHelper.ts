import { useTestcaseStore } from '../../stores/useTestcaseStore';
import { useOverlayStore } from '../../stores/useOverlayStore';
import { TestcaseData } from '../../types/testcase';

async function getExpectedAndActual(
  metaId: string,
  data: TestcaseData | null,
  actualOutput: string
): Promise<{ expected: string; actual: string } | null> {
  let currentData = data;
  if (!currentData) {
    await useTestcaseStore.getState().loadData(metaId);
    currentData = useTestcaseStore.getState().loadedData.get(metaId) || null;
  }
  const expected = currentData?.expectedOutput || '';
  const actual = actualOutput;
  const limit = 100000;
  if (expected.length > limit || actual.length > limit) {
    const msg = `Warning: Comparison data size is very large (Expected: ${(expected.length / 1024).toFixed(1)}KB, Actual: ${(actual.length / 1024).toFixed(1)}KB).\nDisplaying Diff might cause lag or freeze the application. Are you sure you want to proceed?`;
    if (!window.confirm(msg)) return null;
  }
  return { expected, actual };
}

export async function openTestcaseDiff(
  metaId: string,
  metaName: string,
  data: TestcaseData | null,
  actualOutput: string
): Promise<void> {
  try {
    const res = await getExpectedAndActual(metaId, data, actualOutput);
    if (!res) return;
    const { expected, actual } = res;
    const store = useOverlayStore.getState();
    const existing = store.overlays.find(o => {
      if (o.type !== 'diff') return false;
      try {
        return JSON.parse(o.content).testcaseId === metaId;
      } catch {
        return false;
      }
    });
    if (existing) {
      if (existing.isMinimized) await store.restoreOverlay(existing.id);
      store.bringToFront(existing.id);
    } else {
      await store.addOverlay('diff', `Diff — ${metaName}`, JSON.stringify({ testcaseId: metaId, expected, actual }));
    }
  } catch (err: unknown) {
    console.error("Error computing diff (compute_diff):", err);
    alert("Failed to compute diff: " + (err instanceof Error ? err.message : String(err)));
  }
}
