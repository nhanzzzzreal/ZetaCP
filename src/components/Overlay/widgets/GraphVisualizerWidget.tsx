import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Overlay } from '../../../stores/useOverlayStore';
import { useOverlayStore } from '../../../stores/useOverlayStore';
import { notify } from '../../../stores/useNotificationStore';
import { parseGraphInput, GraphData } from './graphParser';
import { analyzeGraph, runAnalysisAlgorithm, GraphStats } from './graphAnalyzer';
import { Info } from 'lucide-react';

interface GraphVisualizerWidgetProps {
  overlay: Overlay;
}

export const GraphVisualizerWidget: React.FC<GraphVisualizerWidgetProps> = ({ overlay }) => {
  const { updateContent } = useOverlayStore();

  // Inputs & Options state
  const [inputText, setInputText] = useState<string>(overlay.content ?? '');
  const [isDirected, setIsDirected] = useState<boolean>(false);
  const [isWeighted, setIsWeighted] = useState<boolean>(true);
  const [freezeLayout, setFreezeLayout] = useState<boolean>(false);
  const [isTreeLayout, setIsTreeLayout] = useState<boolean>(false);
  const [isZeroIndexed, setIsZeroIndexed] = useState<boolean>(false);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<string>('connected-components');
  const [sourceNode, setSourceNode] = useState<string>('');
  const [targetNode, setTargetNode] = useState<string>('');
  const [showInfoTooltip, setShowInfoTooltip] = useState<boolean>(false);
  const [graphFormat, setGraphFormat] = useState<'list' | 'matrix'>('list');

  // VSCode Flat Inputs state
  const [customVStr, setCustomVStr] = useState<string>('');
  const [customEStr, setCustomEStr] = useState<string>('');
  const [isVFocused, setIsVFocused] = useState<boolean>(false);
  const [isEFocused, setIsEFocused] = useState<boolean>(false);

  // Parsed Graph & Analysis State
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [analyzedGraphData, setAnalyzedGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [isAnalyzed, setIsAnalyzed] = useState<boolean>(false);

  // Container dimensions for responsive Canvas
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 400, height: 400 });
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Auto-select default source/target nodes when graph nodes change
  useEffect(() => {
    if (graphData.nodes.length > 0) {
      if (!sourceNode || !graphData.nodes.some((n) => n.id === sourceNode)) {
        setSourceNode(graphData.nodes[0].id);
      }
      if (!targetNode || !graphData.nodes.some((n) => n.id === targetNode)) {
        setTargetNode(graphData.nodes[graphData.nodes.length - 1].id);
      }
    }
  }, [graphData.nodes, sourceNode, targetNode]);

  // Compute live statistics
  const stats: GraphStats = useMemo(() => {
    return analyzeGraph(graphData, isDirected);
  }, [graphData, isDirected]);

  // Auto-update flat inputs with live stats when not focused by user
  useEffect(() => {
    if (!isVFocused) {
      setCustomVStr(String(stats.nodeCount));
    }
  }, [stats.nodeCount, isVFocused]);

  useEffect(() => {
    if (!isEFocused) {
      setCustomEStr(String(stats.edgeCount));
    }
  }, [stats.edgeCount, isEFocused]);

  // Handle container resize dynamically
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Parse graph logic
  const handleDraw = useCallback(() => {
    const overrideV = isVFocused && customVStr.trim() !== '' ? parseInt(customVStr) : undefined;
    const parsed = parseGraphInput(inputText, { format: graphFormat, isDirected, isWeighted, isZeroIndexed, overrideV });
    setGraphData(parsed);
    setAnalyzedGraphData(parsed);
    setIsAnalyzed(false);
    updateContent(overlay.id, inputText);
    setTimeout(() => {
      fgRef.current?.zoomToFit(400, 40);
    }, 100);
  }, [inputText, graphFormat, isDirected, isWeighted, isZeroIndexed, isVFocused, customVStr, overlay.id, updateContent]);

  // Auto-update graph seamlessly on typing / options change while preserving node positions
  useEffect(() => {
    const timer = setTimeout(() => {
      const overrideV = isVFocused && customVStr.trim() !== '' ? parseInt(customVStr) : undefined;
      const parsed = parseGraphInput(inputText, { format: graphFormat, isDirected, isWeighted, isZeroIndexed, overrideV });
      
      setGraphData((prev) => {
        const existingNodeMap = new Map<string, any>();
        prev.nodes.forEach((n: any) => existingNodeMap.set(n.id, n));

        const mergedNodes = parsed.nodes.map((n) => {
          const existing = existingNodeMap.get(n.id);
          if (existing && existing.x !== undefined) {
            return {
              ...n,
              x: existing.x,
              y: existing.y,
              vx: existing.vx,
              vy: existing.vy,
              fx: existing.fx,
              fy: existing.fy,
            };
          }
          return n;
        });

        const merged = { nodes: mergedNodes, links: parsed.links };
        if (!isAnalyzed) {
          setAnalyzedGraphData(merged);
        }
        return merged;
      });

      updateContent(overlay.id, inputText);
    }, 200);

    return () => clearTimeout(timer);
  }, [inputText, graphFormat, isDirected, isWeighted, isZeroIndexed, isVFocused, customVStr, isAnalyzed, overlay.id, updateContent]);

  // Tune D3 forces so nodes stay comfortably close and balanced
  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force('charge')?.strength(-70);
      fgRef.current.d3Force('link')?.distance(35);
    }
  }, [graphData]);

  // Arrange as tree / DAG action handler (one-shot trigger)
  const handleArrangeTree = () => {
    if (stats.hasCycle) {
      notify.warn('Cannot Arrange Tree', 'Graph contains cycles and is not a DAG!');
      return;
    }
    // 1. Unfix fixed coordinates on all nodes so D3 can calculate tree positions freely
    activeData.nodes.forEach((node: any) => {
      delete node.fx;
      delete node.fy;
      delete node.x;
      delete node.y;
      delete node.vx;
      delete node.vy;
    });

    // 2. Reset layout states to force D3 DAG engine to re-compute
    setFreezeLayout(false);
    setIsTreeLayout(false);

    setTimeout(() => {
      setIsTreeLayout(true);
      if (fgRef.current) {
        fgRef.current.d3Reheat();
        fgRef.current.zoomToFit(400, 30);
      }
    }, 50);

    // 3. Freeze layout AFTER nodes settle into tree structure
    setTimeout(() => {
      setFreezeLayout(true);
    }, 700);
  };

  // Run analysis algorithm
  const handleRunAnalysis = () => {
    if (selectedAlgorithm === 'topo-sort' && stats.hasCycle) {
      notify.warn('Cannot Topo Sort', 'Graph contains cycles and is not a DAG!');
      return;
    }
    const result = runAnalysisAlgorithm(
      { algorithm: selectedAlgorithm, sourceNode, targetNode, isDirected },
      graphData
    );
    setAnalyzedGraphData(result);
    setIsAnalyzed(true);
  };

  const handleClearAnalysis = () => {
    setAnalyzedGraphData(graphData);
    setIsAnalyzed(false);
  };

  const activeData = isAnalyzed ? analyzedGraphData : graphData;

  return (
    <div className="flex flex-col w-full h-full bg-[#181818] text-neutral-200 select-none overflow-hidden font-sans">
      {/* Main Content Body */}
      <div className="flex-1 w-full h-full flex overflow-hidden">
        {/* Left Control Panel (Fixed Width ~250px) */}
        <div className="w-[250px] shrink-0 border-r border-[#2d2d2d] bg-[#1e1e1e] flex flex-col p-3 gap-3 overflow-y-auto font-mono">
          {/* VSCode Flat Control Panel Header: Format Status & Nodes/Edges Inputs */}
          <div className="flex flex-col gap-2 p-2 bg-[#141414] border border-[#2b2b2b] rounded">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Format</span>
            </div>
            <div className="grid grid-cols-2 gap-1 p-0.5 bg-[#1e1e1e] border border-[#333333] rounded">
              <button
                type="button"
                onClick={() => setGraphFormat('list')}
                className={`py-1 text-[11px] font-semibold rounded cursor-pointer transition-colors ${
                  graphFormat === 'list'
                    ? 'bg-[#007fd4] text-white'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Edge List
              </button>
              <button
                type="button"
                onClick={() => setGraphFormat('matrix')}
                className={`py-1 text-[11px] font-semibold rounded cursor-pointer transition-colors ${
                  graphFormat === 'matrix'
                    ? 'bg-[#007fd4] text-white'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Matrix
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Nodes (V)</span>
                <input
                  type="text"
                  value={customVStr}
                  onFocus={() => setIsVFocused(true)}
                  onBlur={() => setIsVFocused(false)}
                  onChange={(e) => setCustomVStr(e.target.value)}
                  placeholder="V"
                  className="w-full bg-[#1e1e1e] border border-[#3c3c3c] focus:border-[#007fd4] rounded px-2 py-1 text-xs text-white font-mono focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Edges (E)</span>
                <input
                  type="text"
                  value={customEStr}
                  onFocus={() => setIsEFocused(true)}
                  onBlur={() => setIsEFocused(false)}
                  onChange={(e) => setCustomEStr(e.target.value)}
                  placeholder="E"
                  className="w-full bg-[#1e1e1e] border border-[#3c3c3c] focus:border-[#007fd4] rounded px-2 py-1 text-xs text-white font-mono focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Text Area with Info */}
          <div className="flex flex-col gap-1 flex-1 min-h-[220px]">
            <div className="flex items-center justify-between text-xs text-neutral-400 font-semibold">
              <span>Edge Data</span>
              <div className="relative">
                <button
                  onMouseEnter={() => setShowInfoTooltip(true)}
                  onMouseLeave={() => setShowInfoTooltip(false)}
                  className="text-neutral-500 hover:text-neutral-300 cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                {showInfoTooltip && (
                  <div className="absolute right-0 top-5 w-56 p-2 bg-[#2a2a2a] border border-[#444] rounded shadow-xl text-[10px] text-neutral-300 z-50 pointer-events-none leading-relaxed">
                    <p className="font-bold text-white mb-1">Formats Supported:</p>
                    <p className="mb-1">• <b>Edge List:</b> First line <code className="text-emerald-400">N M</code> or raw pairs <code className="text-emerald-400">u v [w]</code>.</p>
                    <p>• <b>Matrix:</b> <code className="text-emerald-400">N x N</code> adjacency matrix rows.</p>
                  </div>
                )}
              </div>
            </div>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="e.g. 5 6&#10;1 2&#10;1 3..."
              className="flex-1 min-h-[200px] bg-[#141414] border border-[#333333] focus:border-[#007fd4] rounded p-2 text-xs font-mono text-neutral-200 focus:outline-none resize-y leading-relaxed"
            />
          </div>

          {/* Options Checkboxes */}
          <div className="flex flex-col gap-1.5 text-xs text-neutral-300 py-1 border-y border-[#2b2b2b]">
            <label className="flex items-center gap-2 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={isDirected}
                onChange={(e) => setIsDirected(e.target.checked)}
                className="rounded bg-[#141414] border-[#444] text-[#007acc] focus:ring-0 cursor-pointer"
              />
              <span>Directed</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={isWeighted}
                onChange={(e) => setIsWeighted(e.target.checked)}
                className="rounded bg-[#141414] border-[#444] text-[#007acc] focus:ring-0 cursor-pointer"
              />
              <span>Weighted</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={freezeLayout}
                onChange={(e) => setFreezeLayout(e.target.checked)}
                className="rounded bg-[#141414] border-[#444] text-[#007acc] focus:ring-0 cursor-pointer"
              />
              <span>Freeze layout</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={isZeroIndexed}
                onChange={(e) => setIsZeroIndexed(e.target.checked)}
                className="rounded bg-[#141414] border-[#444] text-[#007acc] focus:ring-0 cursor-pointer"
              />
              <span>0-indexed</span>
            </label>
          </div>

          {/* Draw & Arrange Tree Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDraw}
              className="flex-1 py-1.5 bg-[#007acc] hover:bg-[#0098ff] active:scale-[0.98] text-white font-bold text-xs rounded transition-all cursor-pointer shadow-sm"
            >
              Draw
            </button>
            <button
              onClick={handleArrangeTree}
              title={stats.hasCycle ? 'Cannot arrange: graph contains cycles' : 'Arrange nodes in tree/DAG structure'}
              className={`flex-1 py-1.5 font-bold text-xs rounded transition-all cursor-pointer shadow-sm border active:scale-[0.98] ${
                stats.hasCycle
                  ? 'bg-[#252525] text-neutral-500 border-[#333333] hover:border-amber-500/50'
                  : 'bg-[#2d2d2d] hover:bg-[#3d3d3d] text-neutral-200 border-[#3c3c3c]'
              }`}
            >
              Arrange Tree
            </button>
          </div>

          {/* ANALYZE Section */}
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
              ANALYZE
            </span>
            <select
              value={selectedAlgorithm}
              onChange={(e) => setSelectedAlgorithm(e.target.value)}
              className="w-full bg-[#141414] border border-[#333333] rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-[#007fd4] cursor-pointer"
            >
              <option value="connected-components">Connected components</option>
              <option value="bipartite">Bipartite check</option>
              <option value="bfs">BFS (Breadth-First Search)</option>
              <option value="dfs">DFS (Depth-First Search)</option>
              <option value="shortest-path">Shortest path (Dijkstra)</option>
              <option value="spanning-tree">Spanning tree (MST)</option>
              <option value="topo-sort">Topological sort</option>
              <option value="cycle-finder">Cycle finder</option>
            </select>

            {/* Dynamic Source / Target Dropboxes */}
            {(selectedAlgorithm === 'bfs' || selectedAlgorithm === 'dfs' || selectedAlgorithm === 'shortest-path') && (
              <div className="flex flex-col gap-1.5 p-2 bg-[#141414] border border-[#2b2b2b] rounded">
                <div className="flex items-center justify-between text-[11px] text-neutral-400">
                  <span>Source:</span>
                  <select
                    value={sourceNode}
                    onChange={(e) => setSourceNode(e.target.value)}
                    className="bg-[#222] border border-[#333] rounded px-1.5 py-0.5 text-xs text-neutral-200 focus:outline-none cursor-pointer"
                  >
                    {graphData.nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedAlgorithm === 'shortest-path' && (
                  <div className="flex items-center justify-between text-[11px] text-neutral-400">
                    <span>Target:</span>
                    <select
                      value={targetNode}
                      onChange={(e) => setTargetNode(e.target.value)}
                      className="bg-[#222] border border-[#333] rounded px-1.5 py-0.5 text-xs text-neutral-200 focus:outline-none cursor-pointer"
                    >
                      {graphData.nodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={handleRunAnalysis}
                className="flex-1 py-1 bg-[#007acc] hover:bg-[#0098ff] text-white font-bold text-xs rounded transition-colors cursor-pointer"
              >
                Run
              </button>
              <button
                onClick={handleClearAnalysis}
                className="px-3 py-1 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-neutral-300 text-xs rounded transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Right Canvas Panel (Dynamic Flex-1 Expansion) */}
        <div className="flex-1 h-full flex flex-col relative bg-[#121212] overflow-hidden" ref={containerRef}>
          {/* Top Badges / Stats Bar */}
          <div className="p-2.5 flex flex-wrap items-center gap-2 z-10 select-none bg-[#121212]/90 backdrop-blur-md border-b border-[#222] font-mono text-[11px]">
            <span className="px-2.5 py-0.5 rounded-full bg-[#222] text-neutral-300 font-bold border border-[#333]">
              Components <span className="text-white">{stats.componentsCount}</span>
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full font-bold border ${
                stats.isConnected
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/50'
                  : 'bg-amber-950/40 text-amber-400 border-amber-500/50'
              }`}
            >
              {stats.isConnected ? 'Connected' : 'Disconnected'}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full font-bold border ${
                stats.isBipartite
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/50'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700'
              }`}
            >
              {stats.isBipartite ? 'Bipartite' : 'Not bipartite'}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full font-bold border ${
                stats.hasCycle
                  ? 'bg-amber-950/40 text-amber-400 border-amber-500/50'
                  : 'bg-emerald-950/40 text-emerald-400 border-emerald-500/50'
              }`}
            >
              {stats.hasCycle ? 'Has cycle' : 'Acyclic'}
            </span>
          </div>

          {/* Interactive Force Graph Canvas */}
          <div className="flex-1 w-full h-full relative overflow-hidden">
            {dimensions.width > 0 && dimensions.height > 0 && (
              <ForceGraph2D
                ref={fgRef}
                width={dimensions.width}
                height={dimensions.height - 45}
                graphData={activeData}
                nodeRelSize={2.5}
                dagMode={isTreeLayout ? 'td' : undefined}
                dagLevelDistance={40}
                cooldownTicks={freezeLayout ? 0 : 100}
                linkCurvature={freezeLayout && !isTreeLayout ? 0.14 : 0}
                linkDirectionalArrowLength={0}
                linkColor={(link: any) => link.color || '#444444'}
                linkWidth={(link: any) => (link.isHighlighted ? 2.5 : 1.2)}
                linkCanvasObjectMode={() => 'after'}
                linkCanvasObject={(link: any, ctx: CanvasRenderingContext2D) => {
                  const start = link.source;
                  const end = link.target;
                  if (typeof start !== 'object' || typeof end !== 'object') return;

                  // Render solid filled triangle arrow for directed graph
                  if (isDirected) {
                    const dx = end.x - start.x;
                    const dy = end.y - start.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 0) {
                      const angle = Math.atan2(dy, dx);
                      const nodeRadius = 5.5;
                      const arrowLen = 3.5;
                      const arrowWidth = 1.8;

                      const tipX = end.x - nodeRadius * Math.cos(angle);
                      const tipY = end.y - nodeRadius * Math.sin(angle);

                      const baseX = tipX - arrowLen * Math.cos(angle);
                      const baseY = tipY - arrowLen * Math.sin(angle);

                      const perpX = -Math.sin(angle);
                      const perpY = Math.cos(angle);

                      const leftX = baseX + arrowWidth * perpX;
                      const leftY = baseY + arrowWidth * perpY;

                      const rightX = baseX - arrowWidth * perpX;
                      const rightY = baseY - arrowWidth * perpY;

                      ctx.beginPath();
                      ctx.moveTo(tipX, tipY);
                      ctx.lineTo(leftX, leftY);
                      ctx.lineTo(rightX, rightY);
                      ctx.closePath();
                      ctx.fillStyle = link.color || '#666666';
                      ctx.fill();
                    }
                  }

                  // Render edge weight label
                  if (isWeighted && link.weight !== undefined) {
                    const text = String(link.weight);
                    const x = start.x + (end.x - start.x) * 0.5;
                    const y = start.y + (end.y - start.y) * 0.5;
                    ctx.font = '7.5px sans-serif';
                    ctx.fillStyle = '#aaaaaa';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(text, x, y - 3);
                  }
                }}
                nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D) => {
                  const label = String(node.label || node.id);
                  const radius = 5.5;
                  const fontSize = label.length > 2 ? 3.8 : 5;

                  // Draw Floating Annotation with Background Badge (nền) on Top of Node
                  if (node.annotation) {
                    const annText = String(node.annotation);
                    ctx.font = 'bold 5.5px sans-serif';
                    const textWidth = ctx.measureText(annText).width;
                    const paddingX = 2.5;
                    const badgeHeight = 8;
                    const badgeWidth = textWidth + paddingX * 2;
                    const badgeX = node.x - badgeWidth / 2;
                    const badgeY = node.y - radius - badgeHeight - 2;

                    // Background badge (nền)
                    ctx.beginPath();
                    if (typeof (ctx as any).roundRect === 'function') {
                      (ctx as any).roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 2);
                    } else {
                      ctx.rect(badgeX, badgeY, badgeWidth, badgeHeight);
                    }
                    ctx.fillStyle = '#1e293b'; // Slate dark background
                    ctx.fill();
                    ctx.lineWidth = 0.8;
                    ctx.strokeStyle = '#3b82f6'; // Blue border
                    ctx.stroke();

                    // Text inside badge
                    ctx.fillStyle = '#93c5fd'; // Soft light blue text
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(annText, node.x, badgeY + badgeHeight / 2 + 0.5);
                  }

                  ctx.beginPath();
                  ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
                  ctx.fillStyle = '#1a1a1a';
                  ctx.fill();
                  ctx.lineWidth = node.isHighlighted || node.color ? 2.0 : 1.2;
                  ctx.strokeStyle = node.color ? node.color : node.isHighlighted ? '#3b82f6' : '#10b981';
                  ctx.stroke();

                  ctx.font = `bold ${fontSize}px sans-serif`;
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillStyle = '#ffffff';
                  ctx.fillText(label, node.x, node.y);
                }}
                onZoom={(transform) => {
                  setZoomLevel(transform.k);
                }}
              />
            )}
          </div>

          {/* Bottom Zoom Floating Toolbar */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-[#1e1e1e]/90 border border-[#333333] rounded-full px-4 py-1.5 flex items-center gap-3 shadow-xl backdrop-blur-md z-10 select-none font-mono text-xs">
            <button
              onClick={() => {
                if (fgRef.current) {
                  const newZoom = Math.max(0.2, zoomLevel - 0.3);
                  fgRef.current.zoom(newZoom, 200);
                }
              }}
              className="text-neutral-400 hover:text-white font-bold px-1 cursor-pointer"
            >
              -
            </button>
            <input
              type="range"
              min="0.2"
              max="4"
              step="0.1"
              value={zoomLevel}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setZoomLevel(val);
                fgRef.current?.zoom(val, 100);
              }}
              className="w-24 accent-[#007acc] cursor-pointer"
            />
            <button
              onClick={() => {
                if (fgRef.current) {
                  const newZoom = Math.min(4, zoomLevel + 0.3);
                  fgRef.current.zoom(newZoom, 200);
                }
              }}
              className="text-neutral-400 hover:text-white font-bold px-1 cursor-pointer"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
