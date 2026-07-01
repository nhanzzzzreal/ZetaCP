import { CodeforcesHubPanel } from '../CodeforcesHub/CodeforcesHubPanel';
// src/components/RightPanel/getPanelContent.tsx

import React from 'react';
import { PanelViewId } from '../../types/panelLayout';
import { FileTree } from '../FileExplorer/FileTree';
import { SnippetManager } from '../Settings/SnippetManager';
import { StressTesterSidebar } from '../StressTester/StressTesterSidebar';
import { TestcasePanel } from '../TestcasePanel/TestcasePanel';

export const getPanelContent = (viewId: PanelViewId): React.ReactNode => {
  switch (viewId) {
    case 'explorer':
      return <FileTree />;
    case 'snippets':
      return <SnippetManager />;
    case 'stress':
      return <StressTesterSidebar />;
    case 'testcase':
      return <TestcasePanel />;
    case 'codeforces':
      return <CodeforcesHubPanel />;
    case 'debug':
      return (
        <div className="w-full h-full bg-[var(--zcp-bg-sidebar)] p-4 text-xs text-[var(--zcp-text-secondary)] font-sans">
          CP Debugger (Coming soon)
        </div>
      );
    default:
      return null;
  }
};
