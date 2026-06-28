import React, { useState } from 'react';
import { useStressTestStore } from '../../stores/useStressTestStore';
import { useTestcaseStore } from '../../stores/useTestcaseStore';
import { saveFileSettings } from '../../lib/tauri-bridge';
import { SettingsModal } from '../TestcasePanel/SettingsModal';
import { GeneratedCodeModal } from './GeneratedCodeModal';

export const StressTesterSidebar: React.FC = () => {
  const [isSolSettingsOpen, setIsSolSettingsOpen] = useState(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [showBruteLimits, setShowBruteLimits] = useState(false);
  const [showGenLimits, setShowGenLimits] = useState(false);

  const {
    solPath, setSolPath,
    brutePath, setBrutePath,
    genPath, setGenPath,
    genMode, setGenMode,
    testCount, setTestCount,
    stopCondition, setStopCondition,
    runMode, setRunMode,
    genTimeLimit, setGenTimeLimit,
    genMemoryLimit, setGenMemoryLimit,
    bruteTimeLimit, setBruteTimeLimit,
    bruteMemoryLimit, setBruteMemoryLimit,
    solSettings, setSolSettings,
    isRunning, isPaused, autoExport, setAutoExport,
    pickFile, handleInstallTestlib, handleRun, handleStop, handleResume,
  } = useStressTestStore();

  return (
    <div className="w-full h-full bg-[#252526] p-3 flex flex-col gap-3 overflow-y-auto no-scrollbar select-none font-sans text-xs text-[#d4d4d4]">
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#858585] mb-2">Target Configurations</h3>

        {/* User Solution */}
        <div className="flex flex-col gap-1 mb-2.5">
          <label className="text-[11px] text-[#cccccc] font-medium">User Solution</label>
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={solPath}
              onChange={(e) => setSolPath(e.target.value)}
              className="flex-1 bg-[#3c3c3c] text-white border border-[#555555] rounded px-2 py-1 text-xs outline-none focus:border-[#007acc] transition-colors min-w-0"
              placeholder="solution.cpp"
            />
            <button onClick={() => pickFile('sol')} className="px-1.5 py-1 bg-[#3a3d3e] hover:bg-[#4e5254] text-white border border-[#555555] rounded text-xs cursor-pointer transition-colors" title="Browse solution file">...</button>
            <button onClick={() => setIsSolSettingsOpen(true)} className="p-1 bg-[#3a3d3e] hover:bg-[#4e5254] text-white border border-[#555555] rounded flex items-center justify-center cursor-pointer transition-colors" title="User Solution Settings"><span className="codicon codicon-settings-gear text-[12px]" /></button>
          </div>
        </div>

        {/* Brute Force */}
        <div className="flex flex-col gap-1 mb-2.5">
          <label className="text-[11px] text-[#cccccc] font-medium">Brute Force Solution</label>
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={brutePath}
              onChange={(e) => setBrutePath(e.target.value)}
              className="flex-1 bg-[#3c3c3c] text-white border border-[#555555] rounded px-2 py-1 text-xs outline-none focus:border-[#007acc] transition-colors min-w-0"
              placeholder="brute.cpp"
            />
            <button onClick={() => pickFile('brute')} className="px-1.5 py-1 bg-[#3a3d3e] hover:bg-[#4e5254] text-white border border-[#555555] rounded text-xs cursor-pointer transition-colors" title="Browse brute force file">...</button>
            <button onClick={() => setShowBruteLimits(!showBruteLimits)} className={`p-1 border rounded flex items-center justify-center cursor-pointer transition-colors ${showBruteLimits ? 'bg-[#007acc] border-[#007acc] text-white' : 'bg-[#3a3d3e] border-[#555555] hover:bg-[#4e5254] text-white'}`} title="Toggle Brute Force Limits"><span className="codicon codicon-settings-gear text-[12px]" /></button>
          </div>
          {showBruteLimits && (
            <div className="grid grid-cols-2 gap-1.5 mt-1 p-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded animate-in slide-in-from-top-1 duration-150">
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-[#cccccc] truncate font-medium">Time (ms)</label>
                <input type="number" value={bruteTimeLimit} onChange={(e) => setBruteTimeLimit(e.target.value === '' ? '' : Number(e.target.value))} onBlur={() => setBruteTimeLimit(bruteTimeLimit === '' ? 2000 : (bruteTimeLimit < 10 ? 10 : bruteTimeLimit))} className="bg-[#3c3c3c] text-white border border-[#555555] rounded px-1.5 py-0.5 text-[11px] outline-none focus:border-[#007acc] w-full" />
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-[#cccccc] truncate font-medium">Mem (KB)</label>
                <input type="number" value={bruteMemoryLimit} onChange={(e) => setBruteMemoryLimit(e.target.value === '' ? '' : Number(e.target.value))} onBlur={() => setBruteMemoryLimit(bruteMemoryLimit === '' ? 262144 : (bruteMemoryLimit < 1024 ? 1024 : bruteMemoryLimit))} className="bg-[#3c3c3c] text-white border border-[#555555] rounded px-1.5 py-0.5 text-[11px] outline-none focus:border-[#007acc] w-full" />
              </div>
            </div>
          )}
        </div>

        {/* Generator */}
        <div className="flex flex-col gap-1 mb-2.5">
          <label className="text-[11px] text-[#cccccc] font-medium mb-0.5">Testcase Generator</label>
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={genPath}
              onChange={(e) => setGenPath(e.target.value)}
              className="flex-1 bg-[#3c3c3c] text-white border border-[#555555] rounded px-2 py-1 text-xs outline-none focus:border-[#007acc] transition-colors min-w-0"
              placeholder="gen.py"
            />
            <button onClick={() => pickFile('gen')} className="px-1.5 py-1 bg-[#3a3d3e] hover:bg-[#4e5254] text-white border border-[#555555] rounded text-xs cursor-pointer transition-colors" title="Browse generator file">...</button>
            <button onClick={() => setShowGenLimits(!showGenLimits)} className={`p-1 border rounded flex items-center justify-center cursor-pointer transition-colors ${showGenLimits ? 'bg-[#007acc] border-[#007acc] text-white' : 'bg-[#3a3d3e] border-[#555555] hover:bg-[#4e5254] text-white'}`} title="Toggle Generator Limits"><span className="codicon codicon-settings-gear text-[12px]" /></button>
          </div>
          <div className="grid grid-cols-2 bg-[#1e1e1e] rounded p-0.5 border border-[#3c3c3c] mt-1 gap-0.5 text-center select-none">
            <button
              type="button"
              onClick={() => setGenMode('blockly')}
              className={`py-1 text-xs font-medium rounded cursor-pointer transition-colors flex items-center justify-center gap-1.5 ${genMode === 'blockly' ? 'bg-[#007acc] text-white font-semibold' : 'text-[#858585] hover:text-white'}`}
            >
              <span className="codicon codicon-blocks text-[12px]" />
              <span>Blockly Canvas</span>
            </button>
            <button
              type="button"
              onClick={() => setGenMode('file')}
              className={`py-1 text-xs font-medium rounded cursor-pointer transition-colors flex items-center justify-center gap-1.5 ${genMode === 'file' ? 'bg-[#007acc] text-white font-semibold' : 'text-[#858585] hover:text-white'}`}
            >
              <span className="codicon codicon-file-code text-[12px]" />
              <span>Code File</span>
            </button>
          </div>
          {genMode === 'blockly' && (
            <button
              type="button"
              onClick={() => setIsCodeModalOpen(true)}
              className="w-full mt-1 py-1 px-2 bg-[#3a3d3e] hover:bg-[#4e5254] active:bg-[#007acc] text-[#cccccc] hover:text-white border border-[#555555] rounded text-xs cursor-pointer transition-colors flex items-center justify-center gap-1.5 font-medium"
              title="View Python / C++ code generated from Canvas"
            >
              <span className="codicon codicon-code text-[13px] text-[#007acc]" />
              <span>View Generated Code</span>
            </button>
          )}
          {showGenLimits && (
            <div className="grid grid-cols-2 gap-1.5 mt-1 p-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded animate-in slide-in-from-top-1 duration-150">
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-[#cccccc] truncate font-medium">Time (ms)</label>
                <input type="number" value={genTimeLimit} onChange={(e) => setGenTimeLimit(e.target.value === '' ? '' : Number(e.target.value))} onBlur={() => setGenTimeLimit(genTimeLimit === '' ? 2000 : (genTimeLimit < 10 ? 10 : genTimeLimit))} className="bg-[#3c3c3c] text-white border border-[#555555] rounded px-1.5 py-0.5 text-[11px] outline-none focus:border-[#007acc] w-full" />
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-[#cccccc] truncate font-medium">Mem (KB)</label>
                <input type="number" value={genMemoryLimit} onChange={(e) => setGenMemoryLimit(e.target.value === '' ? '' : Number(e.target.value))} onBlur={() => setGenMemoryLimit(genMemoryLimit === '' ? 262144 : (genMemoryLimit < 1024 ? 1024 : genMemoryLimit))} className="bg-[#3c3c3c] text-white border border-[#555555] rounded px-1.5 py-0.5 text-[11px] outline-none focus:border-[#007acc] w-full" />
              </div>
            </div>
          )}
        </div>
      </div>

      <hr className="border-[#3c3c3c]" />

      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#858585] mb-2">Execution Settings</h3>
        <div className="flex flex-col gap-1 mb-2.5">
          <label className="text-[11px] text-[#cccccc] font-medium">Number of Testcases (T)</label>
          <input type="number" value={testCount} onChange={(e) => setTestCount(e.target.value === '' ? '' : Number(e.target.value))} onBlur={() => setTestCount(testCount === '' ? 100 : (testCount < 1 ? 1 : testCount))} className="bg-[#3c3c3c] text-white border border-[#555555] rounded px-2 py-1 text-xs outline-none focus:border-[#007acc]" />
        </div>

        <div className="flex flex-col gap-1 mb-2.5">
          <label className="text-[11px] text-[#cccccc] font-medium">Stop Condition</label>
          <select value={stopCondition} onChange={(e) => setStopCondition(e.target.value)} className="bg-[#3c3c3c] text-white border border-[#555555] rounded px-2 py-1 text-xs outline-none focus:border-[#007acc] cursor-pointer w-full">
            <option value="first_error">Stop on first error</option>
            <option value="10_errors">Stop on 10 errors</option>
            <option value="run_all">Run all</option>
          </select>
        </div>

        <div className="flex flex-col gap-1 mb-2.5">
          <label className="text-[11px] text-[#cccccc] font-medium">Run Mode</label>
          <select value={runMode} onChange={(e) => setRunMode(e.target.value as 'parallel' | 'sequential')} className="bg-[#3c3c3c] text-white border border-[#555555] rounded px-2 py-1 text-xs outline-none focus:border-[#007acc] cursor-pointer w-full">
            <option value="parallel">Parallel</option>
            <option value="sequential">Sequential</option>
          </select>
        </div>

        <div className="flex items-center gap-2 mb-2.5 mt-1 select-none">
          <input
            id="autoExportFailed"
            type="checkbox"
            checked={autoExport}
            onChange={(e) => setAutoExport(e.target.checked)}
            className="w-3.5 h-3.5 bg-[#3c3c3c] accent-[#007acc] border border-[#555555] rounded cursor-pointer"
          />
          <label htmlFor="autoExportFailed" className="text-[11px] text-[#cccccc] cursor-pointer font-medium hover:text-white transition-colors">
            Auto export failed runs
          </label>
        </div>

        <div className="flex flex-col gap-1 mb-2.5 pt-1">
          <button onClick={handleInstallTestlib} className="w-full py-1.5 bg-[#3c3c3c] hover:bg-[#4e4e4e] text-white text-xs font-semibold rounded cursor-pointer border border-[#555555] flex items-center justify-center gap-1.5 transition-colors" title="Install testlib.h"><span className="codicon codicon-cloud-download" /> Install testlib.h</button>
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-3 border-t border-[#3c3c3c]">
        {!isRunning ? (
          <button onClick={handleRun} className="w-full flex items-center justify-center gap-2 py-2 bg-[#0e639c] hover:bg-[#1177bb] active:bg-[#0c5384] text-white text-xs font-semibold rounded cursor-pointer transition-colors shadow-md"><span className="codicon codicon-play" /> Run Stress Test</button>
        ) : (
          <div className="flex gap-2">
            {isPaused && (
              <button onClick={handleResume} className="flex-1 flex items-center justify-center gap-1 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded cursor-pointer transition-colors shadow-md"><span className="codicon codicon-play" /> Resume</button>
            )}
            <button onClick={handleStop} className="flex-1 flex items-center justify-center gap-1 py-2 bg-[#b71c1c] hover:bg-[#d32f2f] text-white text-xs font-semibold rounded cursor-pointer transition-colors shadow-md"><span className="codicon codicon-debug-stop" /> Stop</button>
          </div>
        )}
      </div>

      {isSolSettingsOpen && (
        <SettingsModal
          activeFile={solPath}
          fileSettings={solSettings}
          onSave={async (newSettings) => {
            const currentSolSettings = useStressTestStore.getState().solSettings;
            const mergedSettings = {
              ...(currentSolSettings || {}),
              ...newSettings,
              filePath: solPath,
              stressBrutePath: brutePath,
              stressSolPath: solPath,
              stressGenPath: genPath,
              stressGenMode: genMode,
              stressGenTimeLimitMs: Number(genTimeLimit || 2000),
              stressGenMemoryLimitKb: Number(genMemoryLimit || 262144),
              stressBruteTimeLimitMs: Number(bruteTimeLimit || 2000),
              stressBruteMemoryLimitKb: Number(bruteMemoryLimit || 262144),
              stressTestCount: Number(testCount || 100),
              stressStopCondition: stopCondition,
              stressAutoExport: autoExport,
            };
            await saveFileSettings(mergedSettings);
            setSolSettings(mergedSettings);
            if (mergedSettings.runMode) {
              setRunMode(mergedSettings.runMode === 'parallel' ? 'parallel' : 'sequential');
            }
            const activeTestcaseFile = useTestcaseStore.getState().activeFilePath;
            if (activeTestcaseFile === solPath) {
              useTestcaseStore.setState({ fileSettings: mergedSettings });
            }
            setIsSolSettingsOpen(false);
          }}
          onClose={() => setIsSolSettingsOpen(false)}
        />
      )}

      <GeneratedCodeModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
      />
    </div>
  );
};
