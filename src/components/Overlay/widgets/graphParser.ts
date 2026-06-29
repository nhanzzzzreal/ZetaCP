export interface GraphNode {
  id: string;
  label: string;
  color?: string;
  val?: number; // size
  annotation?: string; // Floating text on top of node (e.g. dist[v], order)
  isHighlighted?: boolean;
}

export interface GraphLink {
  source: string;
  target: string;
  weight?: number;
  label?: string;
  color?: string;
  isHighlighted?: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface ParseOptions {
  format: 'list' | 'matrix';
  isDirected: boolean;
  isWeighted: boolean;
  isZeroIndexed: boolean;
  overrideV?: number;
}

export function parseGraphInput(rawText: string, options: ParseOptions): GraphData {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));

  if (lines.length === 0) {
    const nodesMapEmpty = new Map<string, GraphNode>();
    if (options.overrideV && options.overrideV > 0) {
      const startNode = options.isZeroIndexed ? 0 : 1;
      for (let i = 0; i < options.overrideV; i++) {
        const idStr = String(startNode + i);
        nodesMapEmpty.set(idStr, { id: idStr, label: idStr });
      }
    }
    return { nodes: Array.from(nodesMapEmpty.values()), links: [] };
  }

  // Tokenize each line into valid numbers
  const parsedLines = lines.map((line) =>
    line
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => !isNaN(n))
  );

  const nodesMap = new Map<string, GraphNode>();
  const links: GraphLink[] = [];

  const addNode = (idVal: number) => {
    const idStr = String(idVal);
    if (!nodesMap.has(idStr)) {
      nodesMap.set(idStr, {
        id: idStr,
        label: idStr,
      });
    }
  };

  if (options.format === 'matrix') {
    // PARSE ADJACENCY MATRIX
    const N = parsedLines.length;

    // Initialize nodes
    for (let i = 0; i < N; i++) {
      const nodeVal = options.isZeroIndexed ? i : i + 1;
      addNode(nodeVal);
    }

    for (let r = 0; r < N; r++) {
      const row = parsedLines[r] || [];
      const nodeU = options.isZeroIndexed ? r : r + 1;

      for (let c = 0; c < Math.min(N, row.length); c++) {
        // Main diagonal (r === c) is self-loop, skip displaying
        if (r === c) continue;

        const val = row[c];
        if (val !== 0) {
          const nodeV = options.isZeroIndexed ? c : c + 1;
          addNode(nodeV);

          if (!options.isDirected && r > c) {
            // Avoid duplicate undirected edges from symmetric matrix
            continue;
          }

          links.push({
            source: String(nodeU),
            target: String(nodeV),
            weight: options.isWeighted ? val : undefined,
            label: options.isWeighted ? String(val) : undefined,
          });
        }
      }
    }
  } else {
    // PARSE EDGE LIST
    for (let i = 0; i < parsedLines.length; i++) {
      const tokens = parsedLines[i];
      if (tokens.length === 1) {
        // Standalone single node
        addNode(tokens[0]);
      } else if (tokens.length >= 2) {
        const u = tokens[0];
        const v = tokens[1];
        const w = tokens.length >= 3 ? tokens[2] : undefined;

        // Self-loops (u === v) skipped
        if (u === v) continue;

        addNode(u);
        addNode(v);

        links.push({
          source: String(u),
          target: String(v),
          weight: options.isWeighted ? w : undefined,
          label: options.isWeighted && w !== undefined ? String(w) : undefined,
        });
      }
    }
  }

  // Ensure overrideV nodes exist if specified by outer header inputs
  if (options.overrideV && options.overrideV > 0) {
    const startNode = options.isZeroIndexed ? 0 : 1;
    for (let i = 0; i < options.overrideV; i++) {
      addNode(startNode + i);
    }
  }

  // Sort nodes numerically
  const nodes = Array.from(nodesMap.values()).sort((a, b) => Number(a.id) - Number(b.id));

  return { nodes, links };
}
