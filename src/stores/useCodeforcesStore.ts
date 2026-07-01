// src/stores/useCodeforcesStore.ts

import { create } from 'zustand';
import { 
  codeforcesLogin, 
  codeforcesVerifySession, 
  codeforcesDownloadProblem, 
  codeforcesSubmitSolution,
  cfSaveProblemMetadata,
  cfLoadProblemMetadata,
  writeTextFile,
  CfProblemDetails
} from '../lib/tauri-bridge';
import { useProjectStore } from './useProjectStore';
import { useTestcaseStore } from './useTestcaseStore';
import { useOverlayStore } from './useOverlayStore';
import { useSnippetStore } from './useSnippetStore';
import { notify } from './useNotificationStore';

export interface CfActiveProblem extends CfProblemDetails {
  contestId: number;
  problemIndex: string;
  problemId: string;
}

export interface CodeforcesState {
  handle: string;
  isLoggedIn: boolean | null;
  sessionVerifying: boolean;
  activeProblem: CfActiveProblem | null;
  activeProblemUrl: string;
  downloading: boolean;
  downloadError: string | null;
  
  ratingMin: number;
  ratingMax: number;
  selectedTags: string[];
  isRandomizing: boolean;
  randomizedProblem: { contestId: number; index: string; name: string; rating?: number } | null;
  
  submitProgress: 'idle' | 'submitting' | 'success' | 'error';
  submitError: string | null;
  submissionVerdict: string | null;
  verdictTests: number | null;
  verdictTime: number | null;
  verdictMemory: number | null;
  submissionId: number | null;

  setHandle: (handle: string) => void;
  verifySession: () => Promise<boolean>;
  login: () => Promise<void>;
  downloadProblem: (url: string) => Promise<void>;
  loadActiveProblemMetadata: (filePath: string | null) => Promise<void>;
  getRandomProblem: () => Promise<void>;
  submitSolution: (langId: string) => Promise<void>;
  setRatingMin: (val: number) => void;
  setRatingMax: (val: number) => void;
  toggleTag: (tag: string) => void;
  clearRandomized: () => void;
}

function parseCodeforcesUrl(url: string) {
  const contestMatch = url.match(/(?:contest|gym)\/(\d+)\/problem\/([A-Z\d]+)/i);
  if (contestMatch) {
    return { contestId: contestMatch[1], problemIndex: contestMatch[2].toUpperCase() };
  }
  const problemsetMatch = url.match(/problemset\/problem\/(\d+)\/([A-Z\d]+)/i);
  if (problemsetMatch) {
    return { contestId: problemsetMatch[1], problemIndex: problemsetMatch[2].toUpperCase() };
  }
  return null;
}

function parseTimeLimit(str: string): number {
  const match = str.match(/([\d.]+)\s*s/i);
  if (match) return parseFloat(match[1]) * 1000;
  return 2000; // default 2s
}

function parseMemoryLimit(str: string): number {
  const match = str.match(/(\d+)\s*megabytes/i);
  if (match) return parseInt(match[1]) * 1024;
  return 256 * 1024; // default 256MB
}

let pollingInterval: any = null;

export const useCodeforcesStore = create<CodeforcesState>((set, get) => ({
  handle: localStorage.getItem('cf_handle') || '',
  isLoggedIn: null,
  sessionVerifying: false,
  activeProblem: null,
  activeProblemUrl: '',
  downloading: false,
  downloadError: null,
  
  ratingMin: 800,
  ratingMax: 1600,
  selectedTags: [],
  isRandomizing: false,
  randomizedProblem: null,
  
  submitProgress: 'idle',
  submitError: null,
  submissionVerdict: null,
  verdictTests: null,
  verdictTime: null,
  verdictMemory: null,
  submissionId: null,

  setHandle: (handle: string) => {
    localStorage.setItem('cf_handle', handle);
    set({ handle });
  },

  verifySession: async () => {
    set({ sessionVerifying: true });
    try {
      const handle = await codeforcesVerifySession();
      if (handle) {
        set({ isLoggedIn: true, handle, sessionVerifying: false });
        localStorage.setItem('cf_handle', handle);
        return true;
      } else {
        set({ isLoggedIn: false, handle: '', sessionVerifying: false });
        localStorage.removeItem('cf_handle');
        return false;
      }
    } catch (err) {
      set({ isLoggedIn: false, sessionVerifying: false });
      notify.fromTauriError('Session Verification Failed', err);
      return false;
    }
  },

  login: async () => {
    try {
      await codeforcesLogin();
      notify.info('Login Window Opened', 'Please complete the login in the pop-up window, then click Verify Session.');
    } catch (err) {
      notify.fromTauriError('Failed to open login window', err);
    }
  },

  downloadProblem: async (url: string) => {
    let finalUrl = url.trim();
    const shortCodeRegex = /^(\d+)([a-zA-Z\d]+)$/;
    const shortMatch = finalUrl.match(shortCodeRegex);
    if (shortMatch) {
      const contestId = shortMatch[1];
      const problemIndex = shortMatch[2].toUpperCase();
      finalUrl = `https://codeforces.com/contest/${contestId}/problem/${problemIndex}`;
    }

    const parsed = parseCodeforcesUrl(finalUrl);
    if (!parsed) {
      set({ downloadError: 'Invalid Codeforces URL or Problem Code' });
      notify.error('Download Failed', 'Invalid Codeforces URL or Problem Code. Use a short code like "123A" or a full Codeforces problem URL.');
      return;
    }

    const rootPath = useProjectStore.getState().rootPath;
    if (!rootPath) {
      set({ downloadError: 'Please open a project folder in ZetaCP first.' });
      notify.error('Download Failed', 'Please open a project folder in ZetaCP first.');
      return;
    }

    set({ downloading: true, downloadError: null, activeProblemUrl: finalUrl });
    try {
      const details = await codeforcesDownloadProblem(finalUrl);
      const fileName = `${parsed.contestId}${parsed.problemIndex}.cpp`;
      
      // Get default C++ snippet if available, otherwise default to empty string
      const defaultSnippet = useSnippetStore.getState().snippets.find(
        (s) => s.language === 'cpp' && s.is_default === 1
      );
      const boilerplate = defaultSnippet ? defaultSnippet.code : '';
      
      // We will write the file (Tauri project watcher auto updates tree)
      await writeTextFile(fileName, boilerplate, rootPath);
      
      // Load file into workspace
      await useProjectStore.getState().setActiveFile(fileName);
      await useTestcaseStore.getState().loadForFile(fileName);
      
      // Save CF time limit / memory limit into SQLite
      const timeLimit = parseTimeLimit(details.timeLimit);
      const memoryLimit = parseMemoryLimit(details.memoryLimit);
      
      const testcaseStore = useTestcaseStore.getState();
      const currentSettings = testcaseStore.fileSettings;
      const finalSettings = {
        filePath: fileName,
        compilerFlags: currentSettings?.compilerFlags || '-O3 -std=c++20',
        interpreterFlags: currentSettings?.interpreterFlags || '',
        ioMode: (currentSettings?.ioMode || 'stdio') as 'stdio' | 'file',
        inputFile: currentSettings?.inputFile || '',
        outputFile: currentSettings?.outputFile || '',
        runMode: (currentSettings?.runMode || 'parallel') as 'parallel' | 'sequential',
        checkerType: currentSettings?.checkerType || 'default',
        customCheckerPath: currentSettings?.customCheckerPath || '',
        customCheckerBinary: currentSettings?.customCheckerBinary || '',
        timeLimitMs: timeLimit,
        memoryLimitKb: memoryLimit,
      };
      
      await testcaseStore.saveFileSettings(finalSettings);

      // Save metadata to CodeforcesConfig SQLite
      await cfSaveProblemMetadata({
        filePath: fileName,
        problemId: `${parsed.contestId}${parsed.problemIndex}`,
        contestId: Number(parsed.contestId),
        problemIndex: parsed.problemIndex,
        problemUrl: url,
        parsedData: JSON.stringify(details),
      });
      
      // Clear existing testcases from previous file configuration (if any), then add CF samples
      const metas = Array.from(testcaseStore.metas.values());
      for (const m of metas) {
        if (m.filePath === fileName) {
          await testcaseStore.deleteTestcase(m.id);
        }
      }
      
      for (const sample of details.samples) {
        await testcaseStore.addTestcase(sample.input, sample.output);
      }
      
      // Add problem statement HTML overlay window
      await useOverlayStore.getState().addOverlay('codeforces', details.title, details.htmlDescription);
      
      set({ 
        activeProblem: {
          ...details,
          contestId: Number(parsed.contestId),
          problemIndex: parsed.problemIndex,
          problemId: `${parsed.contestId}${parsed.problemIndex}`,
        },
        downloading: false 
      });

      notify.success('Problem Loaded', `Successfully loaded problem: ${details.title}`);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      set({ downloading: false, downloadError: errMsg });
      notify.error('Failed to Download Problem', `Could not fetch or parse the problem. Please verify the URL/code and check your network/session. Details: ${errMsg}`);
    }
  },

  loadActiveProblemMetadata: async (filePath: string | null) => {
    if (!filePath) {
      set({ activeProblem: null, activeProblemUrl: '' });
      return;
    }
    try {
      const meta = await cfLoadProblemMetadata(filePath);
      if (meta) {
        const parsedData = JSON.parse(meta.parsedData);
        set({
          activeProblem: {
            title: parsedData.title,
            timeLimit: parsedData.timeLimit,
            memoryLimit: parsedData.memoryLimit,
            samples: parsedData.samples,
            htmlDescription: parsedData.htmlDescription,
            contestId: meta.contestId,
            problemIndex: meta.problemIndex,
            problemId: meta.problemId,
          },
          activeProblemUrl: meta.problemUrl,
        });
      } else {
        set({ activeProblem: null, activeProblemUrl: '' });
      }
    } catch (err) {
      set({ activeProblem: null, activeProblemUrl: '' });
    }
  },

  getRandomProblem: async () => {
    const { ratingMin, ratingMax, selectedTags } = get();
    set({ isRandomizing: true, randomizedProblem: null });
    
    try {
      const tagsParam = selectedTags.length > 0 ? selectedTags.map(encodeURIComponent).join(';') : '';
      const response = await fetch(`https://codeforces.com/api/problemset.problems?tags=${tagsParam}`);
      if (!response.ok) {
        throw new Error('Failed to fetch problemset from Codeforces API');
      }
      const data = await response.json();
      if (data.status !== 'OK') {
        throw new Error(data.comment || 'Codeforces API error');
      }
      
      const filtered = data.result.problems.filter((p: any) => 
        p.rating !== undefined && 
        p.rating >= ratingMin && 
        p.rating <= ratingMax
      );
      
      if (filtered.length === 0) {
        throw new Error('No problems found matching criteria');
      }
      
      const randomProb = filtered[Math.floor(Math.random() * filtered.length)];
      set({
        randomizedProblem: {
          contestId: randomProb.contestId,
          index: randomProb.index,
          name: randomProb.name,
          rating: randomProb.rating
        },
        isRandomizing: false
      });
      notify.success('Random Problem Found', randomProb.name);
    } catch (err: any) {
      set({ isRandomizing: false });
      notify.error('Randomizer Failed', err.message || String(err));
    }
  },

  submitSolution: async (langId: string) => {
    const activeFile = useProjectStore.getState().activeFile;
    if (!activeFile) {
      notify.error('Submit Failed', 'No active file selected in the editor.');
      return;
    }

    const { handle, activeProblemUrl } = get();
    if (!handle) {
      notify.error('Submit Failed', 'Please enter your Codeforces Handle in the sidebar first.');
      return;
    }

    // Try to parse contestId & problemIndex from active problem URL or active file name
    let contestId = '';
    let problemIndex = '';

    const urlParsed = parseCodeforcesUrl(activeProblemUrl);
    if (urlParsed) {
      contestId = urlParsed.contestId;
      problemIndex = urlParsed.problemIndex;
    } else {
      // Fallback: parse file name (e.g. 123A.cpp)
      const nameMatch = activeFile.match(/(\d+)([A-Z\d]+)\./i);
      if (nameMatch) {
        contestId = nameMatch[1];
        problemIndex = nameMatch[2].toUpperCase();
      }
    }

    if (!contestId || !problemIndex) {
      notify.error('Submit Failed', 'Could not determine Contest ID and Problem Index for the current file.');
      return;
    }

    const sourceCode = useProjectStore.getState().activeFileContent;
    if (!sourceCode || sourceCode.trim().length < 10) {
      notify.error('Submit Failed', 'Source code is empty or too short.');
      return;
    }

    set({ 
      submitProgress: 'submitting', 
      submitError: null,
      submissionVerdict: 'Submitting to Codeforces...',
      verdictTests: null,
      verdictTime: null,
      verdictMemory: null,
      submissionId: null
    });

    try {
      const success = await codeforcesSubmitSolution({
        url: activeProblemUrl || `https://codeforces.com/contest/${contestId}/problem/${problemIndex}`,
        contestId,
        problemIndex,
        langId,
        sourceCode
      });

      if (!success) {
        throw new Error('Backend submit call returned false.');
      }

      set({ submitProgress: 'success', submissionVerdict: 'Submitted successfully! Waiting for verdict...' });
      notify.success('Submission Sent', 'Starting real-time verdict polling.');

      // Poll verdict using public API
      if (pollingInterval) clearInterval(pollingInterval);
      
      let attempts = 0;
      pollingInterval = setInterval(async () => {
        attempts++;
        if (attempts > 60) { // 120 seconds timeout
          clearInterval(pollingInterval);
          set({ submitProgress: 'error', submitError: 'Timed out waiting for verdict', submissionVerdict: 'Polling timed out' });
          notify.warn('Verdict Polling Timeout', 'Submission state could not be fetched in 120s.');
          return;
        }

        try {
          const res = await fetch(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=5`);
          if (!res.ok) return; // ignore tick error
          
          const statusData = await res.json();
          if (statusData.status !== 'OK') return;

          const submission = statusData.result.find((s: any) => 
            s.problem.contestId === parseInt(contestId) &&
            s.problem.index.toUpperCase() === problemIndex.toUpperCase() &&
            s.creationTimeSeconds >= (Date.now() / 1000 - 3600)
          );

          if (submission) {
            const verdict = submission.verdict;
            set({
              submissionId: submission.id,
              submissionVerdict: verdict ? verdict.replace(/_/g, ' ') : 'TESTING',
              verdictTests: submission.passedTestCount,
              verdictTime: submission.timeConsumedMillis,
              verdictMemory: Math.floor((submission.memoryConsumedBytes || 0) / 1024)
            });

            if (verdict && verdict !== 'TESTING') {
              clearInterval(pollingInterval);
              if (verdict === 'OK') {
                notify.success('ACCEPTED!', `Passed all ${submission.passedTestCount} tests.`);
              } else {
                notify.error('VERDICT: ' + verdict.replace(/_/g, ' '), `Failed on test ${submission.passedTestCount + 1}`);
              }
            }
          }
        } catch (e) {
          // ignore API poll error to continue
        }
      }, 2000);

    } catch (err: any) {
      const errMsg = err?.message || String(err);
      set({ submitProgress: 'error', submitError: errMsg, submissionVerdict: 'Submission failed' });
      notify.fromTauriError('Submission Failed', err);
    }
  },
  
  setRatingMin: (val: number) => set({ ratingMin: val }),
  setRatingMax: (val: number) => set({ ratingMax: val }),
  toggleTag: (tag: string) => set(state => ({
    selectedTags: state.selectedTags.includes(tag)
      ? state.selectedTags.filter(t => t !== tag)
      : [...state.selectedTags, tag]
  })),
  clearRandomized: () => set({ randomizedProblem: null })
}));