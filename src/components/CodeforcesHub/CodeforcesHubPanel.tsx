// src/components/CodeforcesHub/CodeforcesHubPanel.tsx

import React, { useState, useEffect } from 'react';
import { useCodeforcesStore } from '../../stores/useCodeforcesStore';
import { useProjectStore } from '../../stores/useProjectStore';

const LANGUAGES = [
  { id: '61', name: 'GNU G++20 11.2.0 (C++20)' },
  { id: '54', name: 'GNU G++17 7.3.0 (C++17)' },
  { id: '31', name: 'Python 3.8.10' },
  { id: '89', name: 'PyPy 3.10 (Python 3)' },
  { id: '74', name: 'Java 17' },
];

const COMMON_TAGS = [
  'dp', 'greedy', 'math', 'constructive algorithms', 
  'brute force', 'graphs', 'binary search', 'dfs and similar', 
  'trees', 'strings', 'data structures', 'implementation'
];

export const CodeforcesHubPanel: React.FC = () => {
  const {
    handle, isLoggedIn, activeProblem, activeProblemUrl,
    downloading, downloadError, ratingMin, ratingMax, selectedTags, isRandomizing,
    randomizedProblem, submitProgress, submitError, submissionVerdict, verdictTests, verdictTime,
    verdictMemory, verifySession, login, downloadProblem, loadActiveProblemMetadata, getRandomProblem, submitSolution,
    setRatingMin, setRatingMax, toggleTag, clearRandomized
  } = useCodeforcesStore();

  const activeFile = useProjectStore((s) => s.activeFile);
  const [probUrl, setProbUrl] = useState(activeProblemUrl);
  const [selectedLang, setSelectedLang] = useState('61');
  const [showTags, setShowTags] = useState(false);

  useEffect(() => {
    verifySession();
  }, [verifySession]);

  useEffect(() => {
    if (activeProblemUrl) setProbUrl(activeProblemUrl);
  }, [activeProblemUrl]);

  // Load problem metadata when active file changes
  useEffect(() => {
    loadActiveProblemMetadata(activeFile);
  }, [activeFile, loadActiveProblemMetadata]);

  const handleDownload = () => {
    if (probUrl.trim()) downloadProblem(probUrl.trim());
  };

  const handleRandomDownload = () => {
    if (randomizedProblem) {
      const url = `https://codeforces.com/contest/${randomizedProblem.contestId}/problem/${randomizedProblem.index}`;
      downloadProblem(url);
    }
  };

  return (
    <div className="w-full h-full bg-[var(--zcp-bg-sidebar)] overflow-y-auto text-xs text-[var(--zcp-text-secondary)] font-sans flex flex-col scrollbar-thin select-none">
      
      {/* ── Section 1: Credentials ── */}
      <div className="border-b border-[var(--zcp-border)] pb-4">
        <div className="bg-[#2d2d2d]/30 text-neutral-300 font-bold text-[11px] uppercase tracking-wider px-3 py-2 flex items-center justify-between border-b border-[var(--zcp-border)] select-none">
          <span>Credentials</span>
          <span className={`px-1.5 py-0.5 rounded-sm text-[9px] font-semibold tracking-normal uppercase ${
            isLoggedIn === true ? 'bg-green-800/40 text-green-300 border border-green-700/60' :
            isLoggedIn === false ? 'bg-red-800/40 text-red-300 border border-red-700/60' :
            'bg-neutral-800 text-neutral-400 border border-neutral-700'
          }`}>
            {isLoggedIn === true ? 'Logged In' : isLoggedIn === false ? 'Not Logged In' : 'Checking...'}
          </span>
        </div>
        <div className="px-3 pt-3 flex flex-col gap-2">
          {isLoggedIn === true && handle ? (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-neutral-400 uppercase font-semibold">Active User</span>
              <div className="flex items-center gap-1.5 bg-[#1e1e1e] px-2.5 py-1.5 border border-[var(--zcp-border)] rounded-sm text-green-400 font-mono text-[12px] font-semibold">
                <span className="codicon codicon-account text-green-500 text-[14px]" />
                <span>{handle}</span>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-neutral-400 italic">
              No active session found. Please login to submit solutions and download private problems.
            </div>
          )}
          
          <button 
            onClick={login} 
            className="w-full mt-1 py-1.5 bg-[#0e639c] hover:bg-[#1177bb] text-white rounded-sm transition-colors font-medium text-[11px]"
          >
            {isLoggedIn === true ? 'Switch User / Login Again' : 'Login to Codeforces'}
          </button>
        </div>
      </div>

      {/* ── Section 2: Problem Downloader ── */}
      <div className="border-b border-[var(--zcp-border)] pb-4">
        <div className="bg-[#2d2d2d]/30 text-neutral-300 font-bold text-[11px] uppercase tracking-wider px-3 py-2 border-b border-[var(--zcp-border)] select-none">
          Problem Downloader
        </div>
        <div className="px-3 pt-3 flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-neutral-400 uppercase font-semibold">Problem Code or URL</label>
            <input
              type="text"
              value={probUrl}
              onChange={(e) => setProbUrl(e.target.value)}
              placeholder="e.g. 1986B or full URL"
              className="w-full px-2 py-1 bg-[#1e1e1e] border border-[var(--zcp-border)] rounded-sm text-neutral-200 outline-none focus:border-[var(--zcp-focus-border)] transition-colors text-[11px]"
            />
          </div>
          <button
            onClick={handleDownload}
            disabled={downloading || !probUrl.trim()}
            className="w-full py-1.5 bg-[#0e639c] hover:bg-[#1177bb] text-white rounded-sm transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-1.5 text-[11px]"
          >
            {downloading && <span className="codicon codicon-loading animate-spin text-[12px]" />}
            <span>{downloading ? 'Downloading...' : 'Download & Open'}</span>
          </button>
          {downloadError && (
            <div className="text-red-400 text-[10px] mt-1 break-words font-mono bg-red-950/20 p-1 border border-red-900/40 rounded-sm">
              {downloadError}
            </div>
          )}
        </div>
      </div>

      {/* ── Section 3: Randomizer ── */}
      <div className="border-b border-[var(--zcp-border)] pb-4">
        <div className="bg-[#2d2d2d]/30 text-neutral-300 font-bold text-[11px] uppercase tracking-wider px-3 py-2 border-b border-[var(--zcp-border)] select-none">
          CF Problem Randomizer
        </div>
        <div className="px-3 pt-3 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-neutral-400 font-semibold">Rating:</span>
            <input
              type="number"
              value={ratingMin}
              onChange={(e) => setRatingMin(parseInt(e.target.value) || 800)}
              step="100"
              className="w-16 px-2 py-0.5 bg-[#1e1e1e] border border-[var(--zcp-border)] rounded-sm text-neutral-200 outline-none focus:border-[var(--zcp-focus-border)]"
            />
            <span className="text-neutral-500">to</span>
            <input
              type="number"
              value={ratingMax}
              onChange={(e) => setRatingMax(parseInt(e.target.value) || 3500)}
              step="100"
              className="w-16 px-2 py-0.5 bg-[#1e1e1e] border border-[var(--zcp-border)] rounded-sm text-neutral-200 outline-none focus:border-[var(--zcp-focus-border)]"
            />
          </div>
          <div>
            <button 
              onClick={() => setShowTags(!showTags)} 
              className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 focus:outline-none text-[11px]"
            >
              <span>Filter Tags ({selectedTags.length})</span>
              <span className={`codicon codicon-chevron-${showTags ? 'up' : 'down'}`} />
            </button>
            {showTags && (
              <div className="flex flex-wrap gap-1.5 mt-2 max-h-60 overflow-y-auto border border-[var(--zcp-border)] rounded-md p-2 bg-[#1e1e1e] scrollbar-thin">
                {COMMON_TAGS.map((t) => {
                  const active = selectedTags.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleTag(t)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                        active 
                          ? 'bg-[#0e639c] text-white shadow-sm scale-[1.03] border border-transparent' 
                          : 'bg-[#252526] text-neutral-300 hover:bg-[#2d2d2d] hover:text-white border border-[#3e3e42]'
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button
            onClick={getRandomProblem}
            disabled={isRandomizing}
            className="w-full py-1.5 bg-[#0e639c] hover:bg-[#1177bb] text-white rounded-sm font-medium disabled:opacity-50 transition-colors text-[11px]"
          >
            {isRandomizing ? 'Randomizing...' : 'Get Random Problem'}
          </button>

          {randomizedProblem && (
            <div className="p-2.5 bg-[#1e1e1e] rounded-sm border border-[var(--zcp-border)] flex flex-col gap-2">
              <div className="text-neutral-300 font-semibold text-[11px] leading-tight">
                {randomizedProblem.contestId}{randomizedProblem.index} - {randomizedProblem.name}
              </div>
              <div className="text-neutral-400 text-[10px]">Rating: <span className="text-neutral-200 font-bold">{randomizedProblem.rating || 'N/A'}</span></div>
              <div className="flex gap-2 mt-0.5">
                <button onClick={handleRandomDownload} className="flex-1 py-1 bg-[#0e639c] hover:bg-[#1177bb] text-white rounded-sm text-[10px] transition-colors font-medium">
                  Load Problem
                </button>
                <button onClick={clearRandomized} className="py-1 px-2.5 bg-[#3a3d41] hover:bg-[#4e5257] text-neutral-300 rounded-sm text-[10px] transition-colors">
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 4: Submission Control ── */}
      <div className="pb-4 border-b border-[var(--zcp-border)]">
        <div className="bg-[#2d2d2d]/30 text-neutral-300 font-bold text-[11px] uppercase tracking-wider px-3 py-2 border-b border-[var(--zcp-border)] select-none">
          Submit Solution
        </div>
        <div className="px-3 pt-3 flex flex-col gap-2">
          {activeFile && activeProblem ? (
            <>
              <div className="mb-1 flex flex-col gap-0.5">
                <div className="text-[10px] text-neutral-400 uppercase font-semibold">Linked Problem</div>
                <div className="text-green-400 font-bold truncate text-[11px]">{activeProblem.title}</div>
                <div className="text-[10px] text-neutral-400 truncate">File: <span className="text-neutral-200 font-mono">{activeFile}</span></div>
              </div>
              
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-neutral-400 uppercase font-semibold">Language</label>
                <select
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(e.target.value)}
                  className="w-full px-2 py-1.5 bg-[#1e1e1e] border border-[var(--zcp-border)] rounded-sm text-neutral-200 outline-none focus:border-[var(--zcp-focus-border)] cursor-pointer"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => submitSolution(selectedLang)}
                disabled={submitProgress === 'submitting'}
                className="w-full py-1.5 bg-[#0e639c] hover:bg-[#1177bb] text-white font-medium rounded-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 mt-1 text-[11px]"
              >
                {submitProgress === 'submitting' && <span className="codicon codicon-loading animate-spin text-[12px]" />}
                <span>{submitProgress === 'submitting' ? 'Submitting...' : 'Submit Solution'}</span>
              </button>

              {submitError && (
                <div className="text-red-400 text-[10px] mt-1 break-words font-mono bg-red-950/20 p-1 border border-red-900/40 rounded-sm">
                  {submitError}
                </div>
              )}

              {submissionVerdict && (
                <div className="mt-2 p-2 bg-[#1e1e1e] border border-[var(--zcp-border)] rounded-sm flex flex-col gap-1 text-[10px]">
                  <div className="font-semibold text-neutral-300">
                    Verdict:{' '}
                    <span 
                      className="font-bold uppercase"
                      style={{
                        color: submissionVerdict.includes('ACCEPTED') || submissionVerdict === 'OK'
                          ? 'var(--zcp-verdict-ac)'
                          : submissionVerdict.includes('testing') || submissionVerdict.includes('queue')
                          ? 'var(--zcp-text-muted)'
                          : 'var(--zcp-verdict-wa)'
                      }}
                    >
                      {submissionVerdict.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {verdictTests !== null && <div className="text-neutral-400">Passed tests: <span className="text-neutral-200 font-semibold">{verdictTests}</span></div>}
                  {(verdictTime !== null || verdictMemory !== null) && (
                    <div className="text-neutral-400 font-mono text-[9px] mt-0.5">
                      {verdictTime !== null && <span>Time: {verdictTime} ms </span>}
                      {verdictMemory !== null && <span>Memory: {verdictMemory} KB</span>}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-neutral-400 text-center py-4 bg-[#1e1e1e]/20 border border-dashed border-[var(--zcp-border)] rounded-sm px-2">
              {activeFile 
                ? 'Active file is not linked to any Codeforces problem.' 
                : 'No file open in the editor.'
              }
            </div>
          )}
        </div>
      </div>
      
    </div>
  );
};