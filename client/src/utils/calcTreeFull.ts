/**
 * calcTreeFull — wrapper around `relatives-tree`'s calcTree that guarantees
 * ALL persons are positioned, even when the library's internal graph traversal
 * can't reach them from a single root.
 *
 * Problem: `relatives-tree` doesn't traverse spouse→parents paths, so using
 * owner as root may miss uncles/aunts (siblings of parents from the other
 * family line). No single rootId can cover all nodes in two-family-line trees.
 *
 * Solution: Run calcTree with the primary root. If some nodes are missing,
 * run secondary calcTree calls with different roots that DO cover them.
 * Align secondary results using shared nodes' positions as anchors.
 * Detect collisions and shift new nodes to avoid overlap.
 * Generate simple connectors for newly placed nodes.
 */
import calcTreeImport from 'relatives-tree';
import type { TreeNode } from './treeTransform';

// Handle both ESM and CJS default export (Vite vs tsx/Node)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const calcTree: typeof calcTreeImport = typeof calcTreeImport === 'function'
  ? calcTreeImport
  : (calcTreeImport as any).default ?? calcTreeImport;

interface LayoutNode {
  id: string;
  left: number;
  top: number;
}

interface CalcTreeResult {
  nodes: LayoutNode[];
  connectors: number[][];
  canvas: { width: number; height: number };
}

/** Result shape from calcTree library */
interface LibTreeResult {
  nodes: Array<{ id: string; left: number; top: number }>;
  connectors: ReadonlyArray<readonly number[]>;
  canvas: { width: number; height: number };
}

/**
 * Run calcTree ensuring ALL nodes are positioned.
 */
export function calcTreeFull(
  treeNodes: TreeNode[],
  rootId: string
): CalcTreeResult {
  const allPersonIds = new Set(treeNodes.map(n => n.id));
  const nodeMap = new Map(treeNodes.map(n => [n.id, n]));

  // === Primary run ===
  let primaryResult: LibTreeResult;
  try {
    primaryResult = calcTree(treeNodes as any, { rootId }) as unknown as LibTreeResult;
  } catch {
    try {
      primaryResult = calcTree(treeNodes as any, { rootId: treeNodes[0].id }) as unknown as LibTreeResult;
    } catch {
      return { nodes: [], connectors: [], canvas: { width: 0, height: 0 } };
    }
  }

  const posMap = new Map<string, { left: number; top: number }>();
  for (const n of primaryResult.nodes) {
    posMap.set(n.id, { left: n.left, top: n.top });
  }
  const coveredIds = new Set(posMap.keys());
  const allConnectors: number[][] = primaryResult.connectors.map(c => [...c]);
  let canvasW = primaryResult.canvas.width;
  let canvasH = primaryResult.canvas.height;

  // If all covered, return immediately
  if (coveredIds.size >= allPersonIds.size) {
    return {
      nodes: primaryResult.nodes.map(n => ({ id: n.id, left: n.left, top: n.top })),
      connectors: allConnectors,
      canvas: { width: canvasW, height: canvasH },
    };
  }

  // === Find missing nodes and group into connected clusters ===
  const missingIds = [...allPersonIds].filter(id => !coveredIds.has(id));
  const missingSet = new Set(missingIds);
  const visited = new Set<string>();
  const clusters: string[][] = [];

  function dfs(id: string, cluster: string[]) {
    if (visited.has(id) || !missingSet.has(id)) return;
    visited.add(id);
    cluster.push(id);
    const node = nodeMap.get(id);
    if (!node) return;
    for (const p of node.parents) if (missingSet.has(p.id)) dfs(p.id, cluster);
    for (const c of node.children) if (missingSet.has(c.id)) dfs(c.id, cluster);
    for (const s of node.siblings) if (missingSet.has(s.id)) dfs(s.id, cluster);
    for (const sp of node.spouses) if (missingSet.has(sp.id)) dfs(sp.id, cluster);
  }

  for (const id of missingIds) {
    if (!visited.has(id)) {
      const cluster: string[] = [];
      dfs(id, cluster);
      if (cluster.length > 0) clusters.push(cluster);
    }
  }

  // === For each cluster, find a secondary root and align ===
  for (const cluster of clusters) {
    // Find covered relatives of cluster members (connection points)
    const coveredRelatives = new Set<string>();
    for (const id of cluster) {
      const node = nodeMap.get(id);
      if (!node) continue;
      for (const p of node.parents) if (coveredIds.has(p.id)) coveredRelatives.add(p.id);
      for (const c of node.children) if (coveredIds.has(c.id)) coveredRelatives.add(c.id);
      for (const s of node.siblings) if (coveredIds.has(s.id)) coveredRelatives.add(s.id);
      for (const sp of node.spouses) if (coveredIds.has(sp.id)) coveredRelatives.add(sp.id);
    }

    // Build candidate roots for the secondary run
    const secondaryRootCandidates: string[] = [];
    for (const id of cluster) {
      const node = nodeMap.get(id);
      if (!node) continue;
      for (const p of node.parents) secondaryRootCandidates.push(p.id);
    }
    secondaryRootCandidates.push(...cluster);
    secondaryRootCandidates.push(...coveredRelatives);

    // Find the best secondary run
    let bestSecondaryResult: LibTreeResult | null = null;
    let bestSharedNodes: string[] = [];
    let bestNewCount = 0;

    for (const sRoot of secondaryRootCandidates) {
      try {
        const result = calcTree(treeNodes as any, { rootId: sRoot }) as unknown as LibTreeResult;
        const resultIds = new Set(result.nodes.map(n => n.id));

        const newFromCluster = cluster.filter(id => resultIds.has(id) && !coveredIds.has(id));
        const shared = result.nodes.filter(n => coveredIds.has(n.id)).map(n => n.id);

        if (newFromCluster.length > bestNewCount && shared.length > 0) {
          bestNewCount = newFromCluster.length;
          bestSecondaryResult = result;
          bestSharedNodes = shared;
        }

        if (newFromCluster.length === cluster.length) break;
      } catch {
        // Skip invalid roots
      }
    }

    if (!bestSecondaryResult || bestSharedNodes.length === 0) {
      // Fallback: place at the right edge of current canvas
      const maxLeft = Math.max(0, ...[...posMap.values()].map(p => p.left));
      let xOff = maxLeft + 4;
      for (const id of cluster) {
        if (!coveredIds.has(id)) {
          posMap.set(id, { left: xOff, top: 0 });
          coveredIds.add(id);
          xOff += 2;
        }
      }
      canvasW = Math.max(canvasW, xOff);
      continue;
    }

    // Build secondary position map
    const secondaryPosMap = new Map<string, { left: number; top: number }>(
      bestSecondaryResult.nodes.map(n => [n.id, { left: n.left, top: n.top }])
    );

    // Find the best alignment node — prefer parent of a cluster member
    let bestAlignNode: string | null = null;
    for (const id of cluster) {
      const node = nodeMap.get(id);
      if (!node) continue;
      for (const p of node.parents) {
        if (coveredIds.has(p.id) && secondaryPosMap.has(p.id)) {
          bestAlignNode = p.id;
          break;
        }
      }
      if (bestAlignNode) break;
      for (const s of node.siblings) {
        if (coveredIds.has(s.id) && secondaryPosMap.has(s.id)) {
          bestAlignNode = s.id;
          break;
        }
      }
      if (bestAlignNode) break;
      for (const sp of node.spouses) {
        if (coveredIds.has(sp.id) && secondaryPosMap.has(sp.id)) {
          bestAlignNode = sp.id;
          break;
        }
      }
      if (bestAlignNode) break;
    }
    if (!bestAlignNode) bestAlignNode = bestSharedNodes[0];

    // Compute alignment offset
    const pPos = posMap.get(bestAlignNode)!;
    const sPos = secondaryPosMap.get(bestAlignNode)!;
    const offsetL = pPos.left - sPos.left;
    const offsetT = pPos.top - sPos.top;

    // Compute new node positions with offset
    const newNodesPos: Array<{ id: string; left: number; top: number }> = [];
    for (const sn of bestSecondaryResult.nodes) {
      if (!coveredIds.has(sn.id) && cluster.includes(sn.id)) {
        newNodesPos.push({
          id: sn.id,
          left: sn.left + offsetL,
          top: sn.top + offsetT,
        });
      }
    }

    // Collision detection: check if new nodes overlap with existing ones
    let hasCollision = false;
    for (const np of newNodesPos) {
      for (const [, pos] of posMap) {
        if (pos.top === np.top && Math.abs(pos.left - np.left) < 2) {
          hasCollision = true;
          break;
        }
      }
      if (hasCollision) break;
    }

    if (hasCollision) {
      // Shift all new nodes right to avoid collision
      const maxOccupiedOnRows = new Map<number, number>();
      for (const [, pos] of posMap) {
        const current = maxOccupiedOnRows.get(pos.top) ?? -Infinity;
        maxOccupiedOnRows.set(pos.top, Math.max(current, pos.left));
      }

      let maxShift = 0;
      for (const np of newNodesPos) {
        const maxOnRow = maxOccupiedOnRows.get(np.top) ?? -Infinity;
        if (np.left <= maxOnRow + 1) {
          const needed = (maxOnRow + 2) - np.left;
          maxShift = Math.max(maxShift, needed);
        }
      }

      const shift = Math.ceil(maxShift / 2) * 2;
      if (shift > 0) {
        for (const np of newNodesPos) {
          np.left += shift;
        }
      }
    }

    // Add new nodes to posMap
    for (const np of newNodesPos) {
      posMap.set(np.id, { left: np.left, top: np.top });
      coveredIds.add(np.id);
    }

    // Generate connectors for new nodes connecting to their relatives
    for (const np of newNodesPos) {
      const node = nodeMap.get(np.id);
      if (!node) continue;

      // Connect to parents (vertical line from parent's bottom to child's top)
      for (const p of node.parents) {
        const parentPos = posMap.get(p.id);
        if (!parentPos) continue;

        const parentCx = parentPos.left + 1; // center X in grid units
        const parentBy = parentPos.top + 2;  // bottom Y in grid units
        const childCx = np.left + 1;         // center X
        const childTy = np.top;              // top Y

        const midY = (parentBy + childTy) / 2;
        allConnectors.push([parentCx, parentBy, parentCx, midY]);
        allConnectors.push([parentCx, midY, childCx, midY]);
        allConnectors.push([childCx, midY, childCx, childTy]);
      }

      // Connect to spouses (horizontal line between them)
      for (const sp of node.spouses) {
        const spousePos = posMap.get(sp.id);
        if (!spousePos) continue;
        if (spousePos.top !== np.top) continue;

        const leftNode = spousePos.left < np.left ? spousePos : np;
        const rightNode = spousePos.left < np.left ? np : spousePos;
        const y = leftNode.top + 1;
        allConnectors.push([leftNode.left + 2, y, rightNode.left, y]);
      }
    }

    // Update canvas bounds
    for (const np of newNodesPos) {
      canvasW = Math.max(canvasW, np.left + 2);
      canvasH = Math.max(canvasH, np.top + 2);
    }
  }

  // Build final result
  const finalNodes = [...posMap.entries()].map(([id, pos]) => ({
    id,
    left: pos.left,
    top: pos.top,
  }));

  return {
    nodes: finalNodes,
    connectors: allConnectors,
    canvas: { width: canvasW, height: canvasH },
  };
}
