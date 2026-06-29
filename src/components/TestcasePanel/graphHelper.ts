import { useTestcaseStore } from '../../stores/useTestcaseStore';
import { useOverlayStore } from '../../stores/useOverlayStore';
import { notify } from '../../stores/useNotificationStore';
import { parseGraphInput } from '../Overlay/widgets/graphParser';

export async function openTestcaseInGraph(testcaseId: string): Promise<void> {
  try {
    let data = useTestcaseStore.getState().loadedData.get(testcaseId);
    if (!data) {
      await useTestcaseStore.getState().loadData(testcaseId);
      data = useTestcaseStore.getState().loadedData.get(testcaseId);
    }
    const input = data?.input || '';

    if (!input.trim()) {
      notify.warn('Empty Input', 'This testcase has no input data to visualize.');
      return;
    }

    // Parse graph input to check node count
    const parsed = parseGraphInput(input, { format: 'list', isDirected: false, isWeighted: false, isZeroIndexed: false });
    if (parsed.nodes.length > 100) {
      notify.warn(
        'Graph Too Large',
        `This graph has ${parsed.nodes.length} nodes (max limit is 100). Visualization disabled to prevent performance lag.`
      );
      return;
    }

    const { overlays, addOverlay, updateContent, bringToFront, restoreOverlay } = useOverlayStore.getState();
    const existingGraph = overlays.find((o) => o.type === 'graph' || o.type === 'graph-viewer');

    if (existingGraph) {
      updateContent(existingGraph.id, input);
      if (existingGraph.isMinimized) {
        await restoreOverlay(existingGraph.id);
      }
      bringToFront(existingGraph.id);
    } else {
      await addOverlay('graph', 'Graph Visualizer', input);
    }
  } catch (err) {
    console.error('[graphHelper] Failed to open graph:', err);
    notify.error('Error', 'Could not process graph input data.');
  }
}
