import { useHotkeys } from 'react-hotkeys-hook';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useTestcaseStore } from '../stores/useTestcaseStore';

export function useShortcuts() {
  const settings = useSettingsStore((state) => state.settings);

  const runTestsKey = (settings?.shortcuts?.run_tests || 'f5').toLowerCase();
  const stopJudgeKey = (settings?.shortcuts?.stop_judge || 'f9').toLowerCase();
  const newTestcaseKey = (settings?.shortcuts?.new_testcase || 'ctrl+n').toLowerCase();
  const openSettingsKey = (settings?.shortcuts?.open_settings || 'ctrl+shift+s').toLowerCase();

  useHotkeys(
    runTestsKey,
    (e) => {
      e.preventDefault();
      useTestcaseStore.getState().simulateRun();
    },
    { enableOnFormTags: true },
    [runTestsKey]
  );

  useHotkeys(
    stopJudgeKey,
    (e) => {
      e.preventDefault();
      useTestcaseStore.getState().cancelRun();
    },
    { enableOnFormTags: true },
    [stopJudgeKey]
  );

  useHotkeys(
    newTestcaseKey,
    (e) => {
      e.preventDefault();
      useTestcaseStore.getState().addTestcase('', '', null);
    },
    { enableOnFormTags: true },
    [newTestcaseKey]
  );

  useHotkeys(
    openSettingsKey,
    (e) => {
      e.preventDefault();
      useSettingsStore.getState().openSettings();
    },
    { enableOnFormTags: true },
    [openSettingsKey]
  );
}
