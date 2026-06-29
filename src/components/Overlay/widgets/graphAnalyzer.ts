import { GraphData, GraphNode, GraphLink } from './graphParser';

export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  componentsCount: number;
  isConnected: boolean;
  isBipartite: boolean;
  hasCycle: boolean;
}

export interface AnalysisParams {
  algorithm: string;
  sourceNode?: string;
  targetNode?: string;
  isDirected: boolean;
}

const HIGHLIGHT_COLOR = '#3B82F6'; // Bright Blue

export function analyzeGraph(graph: GraphData, isDirected: boolean): GraphStats {
  const nodeIds = graph.nodes.map((n) => n.id);
  const nodeCount = nodeIds.length;
  const edgeCount = graph.links.length;

  if (nodeCount === 0) {
    return {
      nodeCount: 0,
      edgeCount: 0,
      componentsCount: 0,
      isConnected: false,
      isBipartite: true,
      hasCycle: false,
    };
  }

  // Build Adjacency List
  const adj = new Map<string, Array<{ to: string; weight?: number }>>();
  const undirAdj = new Map<string, string[]>();

  nodeIds.forEach((id) => {
    adj.set(id, []);
    undirAdj.set(id, []);
  });

  graph.links.forEach((link) => {
    const s = typeof link.source === 'object' ? (link.source as any).id : String(link.source);
    const t = typeof link.target === 'object' ? (link.target as any).id : String(link.target);

    if (adj.has(s) && adj.has(t)) {
      adj.get(s)!.push({ to: t, weight: link.weight });
      undirAdj.get(s)!.push(t);
      undirAdj.get(t)!.push(s);

      if (!isDirected) {
        adj.get(t)!.push({ to: s, weight: link.weight });
      }
    }
  });

  // 1. Connected Components
  const visited = new Set<string>();
  let componentsCount = 0;

  nodeIds.forEach((id) => {
    if (!visited.has(id)) {
      componentsCount++;
      const queue = [id];
      visited.add(id);
      while (queue.length > 0) {
        const u = queue.shift()!;
        for (const v of undirAdj.get(u) || []) {
          if (!visited.has(v)) {
            visited.add(v);
            queue.push(v);
          }
        }
      }
    }
  });

  const isConnected = componentsCount <= 1;

  // 2. Bipartite Check
  let isBipartite = true;
  const colorMap = new Map<string, number>();

  for (const id of nodeIds) {
    if (!colorMap.has(id)) {
      colorMap.set(id, 0);
      const queue = [id];
      while (queue.length > 0 && isBipartite) {
        const u = queue.shift()!;
        const cU = colorMap.get(u)!;
        for (const v of undirAdj.get(u) || []) {
          if (!colorMap.has(v)) {
            colorMap.set(v, 1 - cU);
            queue.push(v);
          } else if (colorMap.get(v) === cU) {
            isBipartite = false;
            break;
          }
        }
      }
    }
  }

  // 3. Cycle Detection
  let hasCycle = false;
  if (isDirected) {
    const state = new Map<string, number>();
    nodeIds.forEach((id) => state.set(id, 0));

    const dfsDirected = (u: string): boolean => {
      state.set(u, 1);
      for (const edge of adj.get(u) || []) {
        const v = edge.to;
        if (state.get(v) === 1) return true;
        if (state.get(v) === 0 && dfsDirected(v)) return true;
      }
      state.set(u, 2);
      return false;
    };

    for (const id of nodeIds) {
      if (state.get(id) === 0) {
        if (dfsDirected(id)) {
          hasCycle = true;
          break;
        }
      }
    }
  } else {
    const vis = new Set<string>();
    const dfsUndirected = (u: string, p: string | null): boolean => {
      vis.add(u);
      for (const v of undirAdj.get(u) || []) {
        if (v === p) continue;
        if (vis.has(v)) return true;
        if (dfsUndirected(v, u)) return true;
      }
      return false;
    };

    for (const id of nodeIds) {
      if (!vis.has(id)) {
        if (dfsUndirected(id, null)) {
          hasCycle = true;
          break;
        }
      }
    }
  }

  return {
    nodeCount,
    edgeCount,
    componentsCount,
    isConnected,
    isBipartite,
    hasCycle,
  };
}

export function runAnalysisAlgorithm(params: AnalysisParams, graph: GraphData): GraphData {
  const { algorithm, sourceNode, targetNode, isDirected } = params;
  const nodes: GraphNode[] = graph.nodes.map((n) => ({
    ...n,
    annotation: undefined,
    isHighlighted: false,
    color: undefined,
  }));

  const nodeMap = new Map<string, GraphNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const links: GraphLink[] = graph.links.map((l) => {
    const sId = typeof l.source === 'object' ? (l.source as any).id : String(l.source);
    const tId = typeof l.target === 'object' ? (l.target as any).id : String(l.target);
    return {
      ...l,
      source: (nodeMap.get(sId) || l.source) as any,
      target: (nodeMap.get(tId) || l.target) as any,
      isHighlighted: false,
      color: undefined,
    };
  });

  // Build Graph Adjacency Structures
  const adj = new Map<string, Array<{ to: string; weight: number; linkRef: GraphLink }>>();
  const undirAdj = new Map<string, Array<{ to: string; weight: number; linkRef: GraphLink }>>();

  nodes.forEach((n) => {
    adj.set(n.id, []);
    undirAdj.set(n.id, []);
  });

  links.forEach((link) => {
    const s = typeof link.source === 'object' ? (link.source as any).id : String(link.source);
    const t = typeof link.target === 'object' ? (link.target as any).id : String(link.target);
    const w = link.weight !== undefined ? link.weight : 1; // Default unweighted is 1

    if (adj.has(s) && adj.has(t)) {
      adj.get(s)!.push({ to: t, weight: w, linkRef: link });
      undirAdj.get(s)!.push({ to: t, weight: w, linkRef: link });
      undirAdj.get(t)!.push({ to: s, weight: w, linkRef: link });

      if (!isDirected) {
        adj.get(t)!.push({ to: s, weight: w, linkRef: link });
      }
    }
  });

  // 1. Connected Components
  if (algorithm === 'connected-components') {
    const visited = new Set<string>();
    let compIdx = 0;

    nodes.forEach((n) => {
      if (!visited.has(n.id)) {
        compIdx++;
        const queue = [n.id];
        visited.add(n.id);
        while (queue.length > 0) {
          const u = queue.shift()!;
          if (nodeMap.has(u)) {
            nodeMap.get(u)!.annotation = `C${compIdx}`;
            nodeMap.get(u)!.isHighlighted = true;
          }
          for (const edge of undirAdj.get(u) || []) {
            if (!visited.has(edge.to)) {
              visited.add(edge.to);
              queue.push(edge.to);
            }
          }
        }
      }
    });
  }

  // 2. Bipartite Check
  else if (algorithm === 'bipartite') {
    const colorMap = new Map<string, number>();
    nodes.forEach((n) => {
      if (!colorMap.has(n.id)) {
        colorMap.set(n.id, 0);
        const queue = [n.id];
        while (queue.length > 0) {
          const u = queue.shift()!;
          const cU = colorMap.get(u)!;
          if (nodeMap.has(u)) {
            nodeMap.get(u)!.color = cU === 0 ? '#10B981' : '#3B82F6';
            nodeMap.get(u)!.annotation = undefined;
          }
          for (const edge of undirAdj.get(u) || []) {
            const v = edge.to;
            if (!colorMap.has(v)) {
              colorMap.set(v, 1 - cU);
              queue.push(v);
            } else if (colorMap.get(v) === cU) {
              edge.linkRef.color = '#EF4444'; // Highlight conflicting edge in red
            }
          }
        }
      }
    });
  }

  // 3. BFS (Breadth-First Search)
  else if (algorithm === 'bfs' && sourceNode && nodeMap.has(sourceNode)) {
    const activeAdj = isDirected ? adj : undirAdj;
    const distMap = new Map<string, number>();
    const queue = [sourceNode];
    distMap.set(sourceNode, 0);

    nodeMap.get(sourceNode)!.isHighlighted = true;
    nodeMap.get(sourceNode)!.annotation = 'd=0';

    while (queue.length > 0) {
      const u = queue.shift()!;
      const dU = distMap.get(u)!;

      for (const edge of activeAdj.get(u) || []) {
        if (!distMap.has(edge.to)) {
          distMap.set(edge.to, dU + edge.weight);
          const vNode = nodeMap.get(edge.to);
          if (vNode) {
            vNode.isHighlighted = true;
            vNode.annotation = `d=${dU + edge.weight}`;
          }
          edge.linkRef.isHighlighted = true;
          queue.push(edge.to);
        }
      }
    }
  }

  // 4. DFS (Depth-First Search)
  else if (algorithm === 'dfs' && sourceNode && nodeMap.has(sourceNode)) {
    const activeAdj = isDirected ? adj : undirAdj;
    const visited = new Set<string>();
    let step = 0;

    const dfsTraverse = (u: string) => {
      visited.add(u);
      step++;
      const uNode = nodeMap.get(u);
      if (uNode) {
        uNode.isHighlighted = true;
        uNode.annotation = `#${step}`;
      }

      for (const edge of activeAdj.get(u) || []) {
        if (!visited.has(edge.to)) {
          edge.linkRef.isHighlighted = true;
          dfsTraverse(edge.to);
        }
      }
    };

    dfsTraverse(sourceNode);
  }

  // 5. Shortest Path (Dijkstra)
  else if (algorithm === 'shortest-path' && sourceNode && targetNode && nodeMap.has(sourceNode) && nodeMap.has(targetNode)) {
    const activeAdj = isDirected ? adj : undirAdj;
    const dist = new Map<string, number>();
    const prev = new Map<string, { node: string; link: GraphLink } | null>();
    const pq: Array<{ id: string; d: number }> = [];

    nodes.forEach((n) => {
      dist.set(n.id, Infinity);
      prev.set(n.id, null);
    });

    dist.set(sourceNode, 0);
    pq.push({ id: sourceNode, d: 0 });

    while (pq.length > 0) {
      pq.sort((a, b) => a.d - b.d);
      const curr = pq.shift()!;
      if (curr.d > dist.get(curr.id)!) continue;
      if (curr.id === targetNode) break;

      for (const edge of activeAdj.get(curr.id) || []) {
        const newD = curr.d + edge.weight;
        if (newD < dist.get(edge.to)!) {
          dist.set(edge.to, newD);
          prev.set(edge.to, { node: curr.id, link: edge.linkRef });
          pq.push({ id: edge.to, d: newD });
        }
      }
    }

    // Reconstruct path
    if (dist.get(targetNode)! !== Infinity) {
      let curr: string | null = targetNode;
      while (curr) {
        const nNode = nodeMap.get(curr);
        if (nNode) {
          nNode.isHighlighted = true;
          nNode.annotation = `d=${dist.get(curr)}`;
        }
        const pInfo = prev.get(curr);
        if (pInfo) {
          pInfo.link.isHighlighted = true;
          curr = pInfo.node;
        } else {
          curr = null;
        }
      }
    }
  }

  // 6. Spanning Tree (MST Kruskal / Prim)
  else if (algorithm === 'spanning-tree') {
    const activeAdj = isDirected ? adj : undirAdj;
    const visited = new Set<string>();
    const startNode = nodes[0]?.id;

    if (startNode) {
      visited.add(startNode);
      if (nodeMap.has(startNode)) nodeMap.get(startNode)!.isHighlighted = true;

      while (visited.size < nodes.length) {
        let minEdge: { from: string; to: string; weight: number; link: GraphLink } | null = null;

        for (const u of visited) {
          for (const edge of activeAdj.get(u) || []) {
            if (!visited.has(edge.to)) {
              if (!minEdge || edge.weight < minEdge.weight) {
                minEdge = { from: u, to: edge.to, weight: edge.weight, link: edge.linkRef };
              }
            }
          }
        }

        if (!minEdge) break; // Disconnected components

        visited.add(minEdge.to);
        minEdge.link.isHighlighted = true;
        if (nodeMap.has(minEdge.to)) nodeMap.get(minEdge.to)!.isHighlighted = true;
      }
    }
  }

  // 7. Topological Sort
  else if (algorithm === 'topo-sort') {
    const inDegree = new Map<string, number>();
    nodes.forEach((n) => inDegree.set(n.id, 0));

    links.forEach((link) => {
      const t = typeof link.target === 'object' ? (link.target as any).id : String(link.target);
      if (inDegree.has(t)) {
        inDegree.set(t, inDegree.get(t)! + 1);
      }
    });

    const queue: string[] = [];
    nodes.forEach((n) => {
      if (inDegree.get(n.id) === 0) queue.push(n.id);
    });

    let order = 0;
    while (queue.length > 0) {
      const u = queue.shift()!;
      order++;
      const uNode = nodeMap.get(u);
      if (uNode) {
        uNode.isHighlighted = true;
        uNode.annotation = `#${order}`;
      }

      for (const edge of adj.get(u) || []) {
        const v = edge.to;
        edge.linkRef.isHighlighted = true;
        inDegree.set(v, inDegree.get(v)! - 1);
        if (inDegree.get(v) === 0) {
          queue.push(v);
        }
      }
    }
  }

  // 8. Cycle Finder
  else if (algorithm === 'cycle-finder') {
    const CYCLE_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
    let cycleCount = 0;

    if (isDirected) {
      const state = new Map<string, number>(); // 0: unvisited, 1: visiting, 2: visited
      const pathNodes: string[] = [];
      const pathLinks: GraphLink[] = [];
      nodes.forEach((n) => state.set(n.id, 0));

      const dfsCycleDirected = (u: string) => {
        state.set(u, 1);
        pathNodes.push(u);

        for (const edge of adj.get(u) || []) {
          const v = edge.to;
          if (state.get(v) === 1) {
            // Found cycle! Extract cycle path from v to u
            cycleCount++;
            const color = CYCLE_COLORS[(cycleCount - 1) % CYCLE_COLORS.length];
            const vIdx = pathNodes.indexOf(v);
            const cycleNodes = pathNodes.slice(vIdx);
            const cycleEdges = pathLinks.slice(vIdx);
            cycleEdges.push(edge.linkRef);

            cycleNodes.forEach((nId) => {
              const nNode = nodeMap.get(nId);
              if (nNode) {
                nNode.isHighlighted = true;
                nNode.annotation = nNode.annotation ? `${nNode.annotation},C${cycleCount}` : `C${cycleCount}`;
              }
            });

            cycleEdges.forEach((l) => {
              l.isHighlighted = true;
              l.color = color;
            });
          } else if (state.get(v) === 0) {
            pathLinks.push(edge.linkRef);
            dfsCycleDirected(v);
            pathLinks.pop();
          }
        }

        pathNodes.pop();
        state.set(u, 2);
      };

      nodes.forEach((n) => {
        if (state.get(n.id) === 0) {
          dfsCycleDirected(n.id);
        }
      });
    } else {
      const vis = new Set<string>();
      const pathNodes: string[] = [];
      const pathLinks: GraphLink[] = [];

      const dfsCycleUndirected = (u: string, p: string | null) => {
        vis.add(u);
        pathNodes.push(u);

        for (const edge of undirAdj.get(u) || []) {
          const v = edge.to;
          if (v === p) continue;

          if (vis.has(v)) {
            const vIdx = pathNodes.indexOf(v);
            if (vIdx !== -1) {
              cycleCount++;
              const color = CYCLE_COLORS[(cycleCount - 1) % CYCLE_COLORS.length];
              const cycleNodes = pathNodes.slice(vIdx);
              const cycleEdges = pathLinks.slice(vIdx);
              cycleEdges.push(edge.linkRef);

              cycleNodes.forEach((nId) => {
                const nNode = nodeMap.get(nId);
                if (nNode) {
                  nNode.isHighlighted = true;
                  nNode.annotation = nNode.annotation ? `${nNode.annotation},C${cycleCount}` : `C${cycleCount}`;
                }
              });

              cycleEdges.forEach((l) => {
                l.isHighlighted = true;
                l.color = color;
              });
            }
          } else {
            pathLinks.push(edge.linkRef);
            dfsCycleUndirected(v, u);
            pathLinks.pop();
          }
        }

        pathNodes.pop();
      };

      nodes.forEach((n) => {
        if (!vis.has(n.id)) {
          dfsCycleUndirected(n.id, null);
        }
      });
    }
  }

  // Apply highlight styling for links without custom colors
  links.forEach((l) => {
    if (l.isHighlighted && !l.color) {
      l.color = HIGHLIGHT_COLOR;
    }
  });

  return { nodes, links };
}
