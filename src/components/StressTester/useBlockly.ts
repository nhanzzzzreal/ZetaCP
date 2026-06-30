// src/components/StressTester/useBlockly.ts

import { useEffect, useRef } from 'react';
import * as Blockly from 'blockly';
import { registerCustomBlocks } from './blocklySetup';
import { getToolboxConfig } from './blocks/toolbox';
import { readTextFile, writeTextFile, loadFileSettings, saveStressSettings } from '../../lib/tauri-bridge';
import { useStressTestStore } from '../../stores/useStressTestStore';

interface UseBlocklyProps {
  containerRef: React.RefObject<HTMLDivElement>;
  solPath: string;
  rootPath: string | null;
  genPath: string;
  genMode: 'blockly' | 'file';
}

export const useBlockly = ({ containerRef, solPath, rootPath, genPath, genMode }: UseBlocklyProps) => {
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const isLoadingRef = useRef(false);

  const solPathRef = useRef(solPath);
  const rootPathRef = useRef(rootPath);
  const genPathRef = useRef(genPath);
  const genModeRef = useRef(genMode);

  useEffect(() => {
    solPathRef.current = solPath;
    rootPathRef.current = rootPath;
    genPathRef.current = genPath;
    genModeRef.current = genMode;
  });

  useEffect(() => {
    if (!containerRef.current) return;

    registerCustomBlocks();

    const styleId = 'blockly-custom-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        .blocklyText, .blocklyTreeLabel, .blocklyHtmlInput {
          font-weight: normal !important;
        }
        .blocklyToolboxDiv {
          z-index: 1 !important;
        }
        .blocklyFlyout {
          z-index: 2 !important;
        }
        /* Ensure scrollbars are strictly hidden when flyout or canvas container is hidden / collapsed */
        .blocklyFlyout[style*="display: none"] ~ .blocklyFlyoutScrollbar,
        .blocklyFlyout[style*="visibility: hidden"] ~ .blocklyFlyoutScrollbar,
        .blocklyFlyout.blocklyHidden ~ .blocklyFlyoutScrollbar,
        g[style*="display: none"] .blocklyScrollbarVertical,
        g[style*="display: none"] .blocklyScrollbarHorizontal,
        g[style*="visibility: hidden"] .blocklyScrollbarVertical,
        g[style*="visibility: hidden"] .blocklyScrollbarHorizontal {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
        }
        [style*="display: none"] .blocklyToolboxDiv,
        [style*="display: none"] .blocklyWidgetDiv,
        [style*="display: none"] .blocklyTooltipDiv,
        [style*="display: none"] .blocklyDropDownDiv,
        [style*="display: none"] .blocklyScrollbarVertical,
        [style*="display: none"] .blocklyScrollbarHorizontal {
          display: none !important;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none !important;
        }
        .no-scrollbar {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    const darkTheme = Blockly.Theme.defineTheme('customDark', {
      name: 'customDark',
      base: Blockly.Themes.Classic,
      fontStyle: {
        family: 'Consolas, Monaco, monospace',
        weight: 'normal',
        size: 11,
      },
      componentStyles: {
        workspaceBackgroundColour: '#1e1e1e',
        toolboxBackgroundColour: '#252526',
        toolboxForegroundColour: '#d4d4d4',
        flyoutBackgroundColour: '#2d2d2d',
        flyoutForegroundColour: '#d4d4d4',
        scrollbarColour: '#2a2a2a',
        scrollbarOpacity: 0.7,
        insertionMarkerColour: '#fff',
        insertionMarkerOpacity: 0.3,
      },
    });

    const workspace = Blockly.inject(containerRef.current, {
      toolbox: getToolboxConfig(),
      renderer: 'zelos',
      theme: darkTheme,
      grid: {
        spacing: 20,
        length: 3,
        colour: '#333333',
        snap: true,
      },
      zoom: {
        controls: true,
        wheel: true,
        startScale: 0.8,
        maxScale: 3,
        minScale: 0.3,
        scaleSpeed: 1.2,
      },
      trashcan: true,
    });

    workspaceRef.current = workspace;
    (window as unknown as { activeBlocklyWorkspace: Blockly.WorkspaceSvg | null }).activeBlocklyWorkspace = workspace;

    // Unified helper for spawning set block and refreshing toolbox/flyout
    const handleSmartVariableCreation = (ws: Blockly.WorkspaceSvg, varName: string, varId?: string) => {
      const trimmed = String(varName || '').trim();
      if (!trimmed || /^(true|false|null|undefined|None|\d+)$/i.test(trimmed)) return;

      setTimeout(() => {
        try {
          const map = ws.getVariableMap();
          let varModel = map.getVariable(trimmed, '');
          if (!varModel) {
            varModel = map.createVariable(trimmed);
          }
          const actualId = varModel ? varModel.getId() : (varId || trimmed);

          const isAlreadySpawned = ws.getAllBlocks(false).some((b) => {
            if (b.type !== 'set_variable' && b.type !== 'variables_set') return false;
            const varField = b.getField('VAR');
            const fieldText = varField ? varField.getText() : '';
            const fieldValue = b.getFieldValue('VAR');
            return fieldText === trimmed || fieldValue === actualId || fieldValue === trimmed;
          });

          if (!isAlreadySpawned) {
            Blockly.Events.disable();
            try {
              const newSetBlock = ws.newBlock('set_variable') as Blockly.BlockSvg;
              newSetBlock.setFieldValue(actualId, 'VAR');

              const valConn = newSetBlock.getInput('VALUE')?.connection;
              if (valConn && !valConn.targetBlock() && typeof (valConn as any).setShadowState === 'function') {
                (valConn as any).setShadowState({
                  type: 'math_number',
                  fields: { NUM: 10 },
                });
              }

              const topBlocks = ws.getTopBlocks(false);
              const setupBlock = topBlocks.find((b) => b.type === 'setup_hat') as Blockly.BlockSvg | undefined;
              if (setupBlock) {
                let lastBlock: Blockly.BlockSvg = setupBlock;
                while (lastBlock.nextConnection && lastBlock.nextConnection.targetBlock()) {
                  lastBlock = lastBlock.nextConnection.targetBlock() as Blockly.BlockSvg;
                }
                if (lastBlock.nextConnection && newSetBlock.previousConnection) {
                  lastBlock.nextConnection.connect(newSetBlock.previousConnection);
                }
              } else {
                newSetBlock.moveBy(50, 120);
              }

              newSetBlock.initSvg();
              newSetBlock.render();
            } finally {
              Blockly.Events.enable();
            }
          }

          // Force refresh toolbox and flyout UI
          const toolbox = ws.getToolbox();
          if (toolbox && typeof (toolbox as any).refreshSelection === 'function') {
            (toolbox as any).refreshSelection();
          }
          const flyout = ws.getFlyout ? ws.getFlyout() : (toolbox && (toolbox as any).getFlyout ? (toolbox as any).getFlyout() : null);
          if (flyout && typeof flyout.show === 'function') {
            flyout.show(Blockly.Variables.flyoutCategory(ws));
          }
        } catch (e) {
          console.error('[ZetaCP] Smart Variable Creation Error:', e);
        }
      }, 30);
    };

    (window as any).handleSmartVariableCreation = (varName: string, varId?: string) => {
      if (workspaceRef.current) {
        handleSmartVariableCreation(workspaceRef.current, varName, varId);
      }
    };

    // Register dynamic toolbox VARIABLE category callback & button callback
    const categoryCallback = (ws: Blockly.WorkspaceSvg) => {
      return Blockly.Variables.flyoutCategory(ws as any);
    };
    workspace.registerToolboxCategoryCallback('VARIABLE', categoryCallback);
    workspace.registerToolboxCategoryCallback('VARIABLE_DYNAMIC', categoryCallback);

    workspace.registerButtonCallback('CREATE_VARIABLE', (button: Blockly.FlyoutButton) => {
      const targetWs = button.getTargetWorkspace() as Blockly.WorkspaceSvg;
      (Blockly.Variables as any).createVariableButtonHandler(targetWs, (varName: string | null) => {
        if (varName) {
          handleSmartVariableCreation(targetWs, varName);
        }
      });
    });

    const changeListener = (event: Blockly.Events.Abstract) => {
      const evType = String(event.type || '').toLowerCase();
      if (isLoadingRef.current || !workspaceRef.current) return;

      const interestEvents: string[] = [
        Blockly.Events.BLOCK_CREATE,
        Blockly.Events.BLOCK_DELETE,
        Blockly.Events.BLOCK_CHANGE,
        Blockly.Events.BLOCK_MOVE,
        Blockly.Events.VAR_RENAME,
        Blockly.Events.VAR_CREATE,
      ];

      if (evType === 'var_create') {
        const varEvent = event as any;
        const ws = workspaceRef.current;
        if (ws) {
          const map = ws.getVariableMap();
          const varId = varEvent.varId || varEvent.id;
          let varName = varEvent.varName || varEvent.name;
          if (!varName && varId) {
            const model = map.getVariableById(varId);
            if (model) varName = (model as any).name;
          }
          if (varName) {
            handleSmartVariableCreation(ws, varName, varId);
          }
        }
      }
      if (!interestEvents.includes(event.type)) return;

      const currentSol = solPathRef.current;
      const currentRoot = rootPathRef.current;
      if (!currentSol) return;

      const state = Blockly.serialization.workspaces.save(workspace);
      const jsonStr = JSON.stringify(state);

      // Also keep legacy file backup for safety
      if (currentRoot) {
        const wsFileName = `.ZetaCP/stress_workspace_${currentSol.replace(/[\/\\]/g, '_')}.json`;
        writeTextFile(wsFileName, jsonStr, currentRoot).catch(() => {});
      }

      // Persist directly into SQLite DB via saveFileSettings
      (async () => {
        try {
          const store = useStressTestStore.getState();
          const currentSettings = store.solSettings || await loadFileSettings(currentSol);
          const updatedSettings = {
            ...currentSettings,
            filePath: currentSol,
            blocklyWorkspace: jsonStr,
          };
          await saveStressSettings(updatedSettings as any);
          useStressTestStore.setState({ solSettings: updatedSettings as any });
        } catch (e) {
          console.error('[ZetaCP Canvas DB Save Error]:', e);
        }
      })();
    };

    workspace.addChangeListener(changeListener);

    // Resize SVG canvas
    const resizeObserver = new ResizeObserver(() => {
      Blockly.svgResize(workspace);
    });
    resizeObserver.observe(containerRef.current);

    // Initial and fallback resizes to ensure proper sizing after layout reflow
    Blockly.svgResize(workspace);
    const t1 = setTimeout(() => Blockly.svgResize(workspace), 100);
    const t2 = setTimeout(() => Blockly.svgResize(workspace), 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      resizeObserver.disconnect();
      workspace.removeChangeListener(changeListener);
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, [containerRef]);

  // Load state when active file or workspace changes
  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace || !solPath || !rootPath) return;

    let active = true;
    const loadSavedWorkspace = async () => {
      isLoadingRef.current = true;
      try {
        const settings = await loadFileSettings(solPath);
        if (!active) return;
        const jsonStr = settings.blocklyWorkspace;
        if (jsonStr && jsonStr.trim()) {
          const json = JSON.parse(jsonStr);
          Blockly.Events.disable();
          workspace.clear();
          Blockly.serialization.workspaces.load(json, workspace);
          Blockly.Events.enable();
          return;
        }
      } catch (err) {
        // Ignore DB load error and fallback
      }

      // Fallback: try legacy file on disk
      try {
        const wsFileName = `.ZetaCP/stress_workspace_${solPath.replace(/[\/\\]/g, '_')}.json`;
        const content = await readTextFile(wsFileName, rootPath);
        if (!active) return;
        const json = JSON.parse(content);

        Blockly.Events.disable();
        workspace.clear();
        Blockly.serialization.workspaces.load(json, workspace);
        Blockly.Events.enable();
      } catch (err) {
        if (!active) return;
        // No saved state or error, create default setup_hat and when_start blocks
        Blockly.Events.disable();
        workspace.clear();

        const setupBlock = workspace.newBlock('setup_hat');
        setupBlock.initSvg();
        setupBlock.render();
        setupBlock.moveBy(40, 30);

        const startBlock = workspace.newBlock('when_start');
        startBlock.initSvg();
        startBlock.render();
        startBlock.moveBy(40, 160);

        const callSetupBlock = workspace.newBlock('call_setup');
        callSetupBlock.initSvg();
        callSetupBlock.render();

        if (startBlock.nextConnection && callSetupBlock.previousConnection) {
          startBlock.nextConnection.connect(callSetupBlock.previousConnection);
        }

        Blockly.Events.enable();
      } finally {
        setTimeout(() => {
          if (active) {
            isLoadingRef.current = false;
          }
        }, 100);
      }
    };

    loadSavedWorkspace();
    return () => {
      active = false;
    };
  }, [solPath, rootPath, workspaceRef.current]);
};

