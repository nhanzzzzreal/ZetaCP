// src/components/Editor/TabBar.tsx

import React, { useRef, useState, useMemo } from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import { getFileIcon } from '../../lib/fileIcons';

export const TabBar: React.FC = () => {
  const openTabs = useProjectStore((state) => state.openTabs);
  const activeFile = useProjectStore((state) => state.activeFile);
  const dirtyFiles = useProjectStore((state) => state.dirtyFiles);

  const setActiveFile = useProjectStore((state) => state.setActiveFile);
  const closeTab = useProjectStore((state) => state.closeTab);
  const setOpenTabs = useProjectStore((state) => state.setOpenTabs);


  const tabBarRef = useRef<HTMLDivElement>(null);
  const dragSourceIndexRef = useRef<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Translate vertical wheel scroll to horizontal scroll on tab bar
  const handleTabBarWheel = (e: React.WheelEvent) => {
    if (tabBarRef.current) {
      if (e.deltaY !== 0) {
        tabBarRef.current.scrollLeft += e.deltaY;
      }
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragSourceIndexRef.current = index;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (index: number) => {
    const sourceIndex = dragSourceIndexRef.current;
    if (sourceIndex === null || sourceIndex === index) return;

    const updatedTabs = [...openTabs];
    const [draggedTab] = updatedTabs.splice(sourceIndex, 1);
    updatedTabs.splice(index, 0, draggedTab);

    dragSourceIndexRef.current = index;
    setDraggedIndex(index);
    setOpenTabs(updatedTabs);
  };

  const handleDragEnd = () => {
    dragSourceIndexRef.current = null;
    setDraggedIndex(null);
  };

  // Resolve unique display titles for each tab (VS Code style suffix path for duplicates)
  const tabTitles = useMemo(() => {
    const titles: Record<string, string> = {};
    const groups: Record<string, string[]> = {};

    openTabs.forEach((p) => {
      const pClean = p.replace(/\\/g, '/');
      const filename = pClean.split('/').pop() || pClean;
      const lastDotIdx = filename.lastIndexOf('.');
      const baseNameWithoutExt = lastDotIdx <= 0 ? filename : filename.substring(0, lastDotIdx);

      if (!groups[baseNameWithoutExt]) {
        groups[baseNameWithoutExt] = [];
      }
      groups[baseNameWithoutExt].push(p);
    });

    Object.entries(groups).forEach(([_, paths]) => {
      if (paths.length === 1) {
        const p = paths[0];
        const pClean = p.replace(/\\/g, '/');
        titles[p] = pClean.split('/').pop() || p;
        return;
      }

      // Collect parent paths for all files in this baseName group
      const parentPathsOfGroup = paths.map((p) => {
        const pClean = p.replace(/\\/g, '/');
        const parts = pClean.split('/');
        return parts.slice(0, -1).join('/');
      });

      const uniqueParentPaths = Array.from(new Set(parentPathsOfGroup));

      // If all files are in the same folder, just show the filename with extension
      if (uniqueParentPaths.length <= 1) {
        paths.forEach((p) => {
          const pClean = p.replace(/\\/g, '/');
          titles[p] = pClean.split('/').pop() || p;
        });
        return;
      }

      // Find the shortest unique suffix for each parent path in this group
      const parentPathSuffixes: Record<string, string> = {};

      uniqueParentPaths.forEach((parentPath) => {
        const parts = parentPath.split('/');
        let depth = 1;
        let suffix = '';

        while (depth <= parts.length) {
          const candidate = parts.slice(-depth).join('/');
          const isUnique = uniqueParentPaths.every((otherPath) => {
            if (otherPath === parentPath) return true;
            const otherParts = otherPath.split('/');
            const otherCandidate = otherParts.slice(-depth).join('/');
            return candidate !== otherCandidate;
          });

          if (isUnique) {
            suffix = candidate;
            break;
          }
          depth++;
        }

        if (!suffix) {
          suffix = parentPath;
        }

        parentPathSuffixes[parentPath] = suffix;
      });

      // Construct tab display title: distinguishing_suffix/filename.ext
      paths.forEach((p) => {
        const pClean = p.replace(/\\/g, '/');
        const parts = pClean.split('/');
        const filename = parts[parts.length - 1];
        const parentPath = parts.slice(0, -1).join('/');
        const suffix = parentPathSuffixes[parentPath];

        if (suffix) {
          titles[p] = `${suffix}/${filename}`;
        } else {
          titles[p] = filename;
        }
      });
    });

    return titles;
  }, [openTabs]);

  if (openTabs.length === 0) return null;

  return (
    <div 
      ref={tabBarRef}
      onWheel={handleTabBarWheel}
      className="flex bg-[var(--zcp-bg-sidebar)] overflow-x-auto select-none tab-bar-scrollbar h-[var(--zcp-tab-height)] items-stretch border-b border-[var(--zcp-border)]"
    >
      {openTabs.map((tab, index) => {
        const isActive = activeFile === tab;
        const isDragged = draggedIndex === index;
        const displayTitle = tabTitles[tab] || tab;

        return (
          <button
            role="tab"
            aria-selected={isActive}
            tabIndex={0}
            key={tab}
            onClick={() => setActiveFile(tab)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setActiveFile(tab);
              }
            }}
            draggable={true}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDragEnter={() => handleDragEnter(index)}
            onDragEnd={handleDragEnd}
            style={{ WebkitUserDrag: 'element' } as React.CSSProperties}
            className={`flex items-center gap-2 px-3 border-t-2 h-full cursor-pointer transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] shrink-0 select-none border-r border-[var(--zcp-border)] group focus-visible-outline ${
              isActive
                ? 'bg-[var(--zcp-bg-tab-active)] text-[var(--zcp-text-active)] border-t-[var(--zcp-focus-border)] font-semibold'
                : 'bg-[var(--zcp-bg-tab-inactive)] text-[var(--zcp-text-secondary)] border-t-transparent hover:bg-[var(--zcp-hover-bg)] hover:text-[var(--zcp-text-active)]'
            } ${isDragged ? 'opacity-30 bg-[var(--zcp-bg-tab-inactive)]' : ''}`}
          >
            {/* File icon */}
            {getFileIcon(tab, isActive, 13)}

            <div className="flex items-center min-w-0">
              <span className="truncate max-w-[180px] text-xs">{displayTitle}</span>
            </div>

            {/* Unsaved / close indicator (VS Code-style dot changing to X on hover) */}
            <div className="relative w-4 h-4 ml-1 flex items-center justify-center shrink-0">
              {dirtyFiles[tab] ? (
                <div className="relative w-4 h-4 flex items-center justify-center group/close">
                  <span className="absolute text-[8px] text-[var(--zcp-text-secondary)] group-hover/close:opacity-0 transition-opacity">
                    ●
                  </span>
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={async (e) => {
                      e.stopPropagation();
                      await closeTab(tab);
                    }}
                    className="absolute p-0.5 rounded-[var(--zcp-radius-sm)] hover:bg-[var(--zcp-hover-bg)] text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] opacity-0 group-hover/close:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <span className="codicon codicon-close text-[12px] flex items-center justify-center" />
                  </span>
                </div>
              ) : (
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={async (e) => {
                    e.stopPropagation();
                    await closeTab(tab);
                  }}
                  className={`p-0.5 rounded-[var(--zcp-radius-sm)] hover:bg-[var(--zcp-hover-bg)] text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] flex items-center justify-center ${
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <span className="codicon codicon-close text-[12px] flex items-center justify-center" />
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
