/**
 * Multi-pass wrapper around `relatives-tree` calcTree.
 *
 * Problem: relatives-tree only traverses parents/children/spouses from rootId.
 * It does NOT follow siblings or discover other children of ancestors (uncles/aunts).
 *
 * Solution: Run calcTree multiple times:
 *   1. Primary pass with ownerPersonId as root → covers most nodes
 *   2. Find missing nodes (e.g. uncles)
 *   3. For each missing cluster, pick a secondary root and run calcTree again
 *   4. Align secondary results to primary via shared anchor nodes
 *   5. Merge all nodes and connectors, resolve collisions
 */
import calcTree from 'relatives-tree';
import type { Node as RTNode, ExtNode, Connector } from 'relatives-tree/lib/types';
import type { Person, Relationship } from '../types';
import { transformToTreeNodes } from './treeTransform';

interface MultiPassResult {
  canvas: { width: number; height: number };
  nodes: ExtNode[];
  connectors: Connector[];
}

export function calcTreeMultiPass(
  persons: Person[],
  relationships: Relationship[],
  ownerPersonId: string
): MultiPassResult {
  const treeNodes = transformToTreeNodes(persons, relationships) as unknown as RTNode[];
  const allIds = new Set(persons.map(p => p.id));

  // ── Pass 1: Primary run with owner as root ──
  const primary = calcTree(treeNodes, { rootId: ownerPersonId });
  const placedIds = new Set(primary.nodes.map(n => n.id));
  const missingIds = [...allIds].filter(id => !placedIds.has(id));

  // If all nodes covered, just return primary
  if (missingIds.length === 0) {
    return {
      canvas: { width: primary.canvas.width, height: primary.canvas.height },
      nodes: [...primary.nodes],
      connectors: [...primary.connectors],
    };
  }

  // ── Build adjacency for cluster detection ──
  const adj = new Map<string, Set<string>>();
  for (const id of allIds) {
    adj.set(id, new Set());
  }
  for (const rel of relationships) {
    if (allIds.has(rel.person1Id) && allIds.has(rel.person2Id)) {
      adj.get(rel.person1Id)!.add(rel.person2Id);
      adj.get(rel.person2Id)!.add(rel.person1Id);
    }
  }

  // ── Group missing nodes into connected clusters ──
  const visited = new Set<string>();
  const clusters: string[][] = [];

  for (const id of missingIds) {
    if (visited.has(id)) continue;
    const cluster: string[] = [];
    const stack = [id];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      // Only add to cluster if it's a missing node
      if (!placedIds.has(current)) cluster.push(current);
      // Follow edges to other missing nodes
      for (const neighbor of adj.get(current) || []) {
        if (!visited.has(neighbor) && !placedIds.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }
    if (cluster.length > 0) clusters.push(cluster);
  }

  // ── Pass 2+: For each cluster, find best secondary root ──
  // Strategy: for each missing node, run calcTree with it as root.
  // Pick the run that covers the most missing nodes AND has shared anchor nodes with primary.
  const allNodes: ExtNode[] = [...primary.nodes];
  const allConnectors: Connector[] = [...primary.connectors];
  let currentPlaced = new Set(placedIds);

  for (const cluster of clusters) {
    // Find anchor nodes: nodes in primary that are adjacent to cluster nodes
    const anchors = new Set<string>();
    for (const cid of cluster) {
      for (const neighbor of adj.get(cid) || []) {
        if (currentPlaced.has(neighbor)) anchors.add(neighbor);
      }
    }

    // Try each cluster node as root, pick best coverage
    let bestResult: ReturnType<typeof calcTree> | null = null;
    let bestCoverage = 0;

    for (const candidateRoot of cluster) {
      try {
        const result = calcTree(treeNodes, { rootId: candidateRoot });
        // Count how many cluster nodes are covered
        const coveredCluster = result.nodes.filter(n => cluster.includes(n.id)).length;
        // Count how many anchors are covered (for alignment)
        const coveredAnchors = result.nodes.filter(n => anchors.has(n.id)).length;
        const score = coveredCluster * 10 + coveredAnchors;
        if (score > bestCoverage) {
          bestCoverage = score;
          bestResult = result;
          // bestRootId tracked for debugging
        }
      } catch {
        // Skip if calcTree fails for this root
      }
    }

    if (!bestResult) continue;

    // ── Align secondary result to primary via anchor nodes ──
    // Find shared nodes between primary and secondary
    const primaryPosMap = new Map<string, { left: number; top: number }>();
    for (const n of allNodes) {
      primaryPosMap.set(n.id, { left: n.left, top: n.top });
    }

    const secondaryPosMap = new Map<string, { left: number; top: number }>();
    for (const n of bestResult.nodes) {
      secondaryPosMap.set(n.id, { left: n.left, top: n.top });
    }

    // Calculate offset from anchor nodes
    let offsetX = 0;
    let offsetY = 0;
    let anchorCount = 0;

    for (const anchorId of anchors) {
      const pPos = primaryPosMap.get(anchorId);
      const sPos = secondaryPosMap.get(anchorId);
      if (pPos && sPos) {
        offsetX += pPos.left - sPos.left;
        offsetY += pPos.top - sPos.top;
        anchorCount++;
      }
    }

    if (anchorCount > 0) {
      offsetX = Math.round(offsetX / anchorCount);
      offsetY = Math.round(offsetY / anchorCount);
    } else {
      // No anchors — place to the right of existing content
      let maxLeft = 0;
      for (const n of allNodes) {
        maxLeft = Math.max(maxLeft, n.left);
      }
      offsetX = maxLeft + 4; // gap of 4 grid units
      offsetY = 0;
    }

    // Add new (missing) nodes with offset applied
    for (const node of bestResult.nodes) {
      if (!currentPlaced.has(node.id)) {
        const shifted = {
          ...node,
          left: node.left + offsetX,
          top: node.top + offsetY,
        };
        allNodes.push(shifted);
        currentPlaced.add(node.id);
      }
    }

    // Add connectors with offset applied
    // Only add connectors that involve at least one newly-placed node
    // We need to add connectors that connect to the new nodes.
    // Since connectors are coordinate-based (not ID-based), we offset ALL
    // secondary connectors but filter to avoid duplicating primary connectors.
    for (const conn of bestResult.connectors) {
      const [x1, y1, x2, y2] = conn;
      const shifted: Connector = [
        x1 + offsetX,
        y1 + offsetY,
        x2 + offsetX,
        y2 + offsetY,
      ] as const;

      // Check if this connector already exists in primary (approximate match)
      const isDuplicate = allConnectors.some(existing => {
        const [ex1, ey1, ex2, ey2] = existing;
        return Math.abs(ex1 - shifted[0]) < 0.5 &&
               Math.abs(ey1 - shifted[1]) < 0.5 &&
               Math.abs(ex2 - shifted[2]) < 0.5 &&
               Math.abs(ey2 - shifted[3]) < 0.5;
      });

      if (!isDuplicate) {
        allConnectors.push(shifted);
      }
    }
  }

  // ── Collision resolution ──
  // Group by top (generation row)
  const rowMap = new Map<number, ExtNode[]>();
  for (const node of allNodes) {
    if (!rowMap.has(node.top)) rowMap.set(node.top, []);
    rowMap.get(node.top)!.push(node);
  }

  for (const [, rowNodes] of rowMap) {
    rowNodes.sort((a, b) => a.left - b.left);
    for (let i = 1; i < rowNodes.length; i++) {
      const prev = rowNodes[i - 1];
      const curr = rowNodes[i];
      const minGap = 2; // minimum 2 grid units between left edges
      if (curr.left - prev.left < minGap) {
        const shift = minGap - (curr.left - prev.left);
        // Shift current and all to the right
        for (let j = i; j < rowNodes.length; j++) {
          (rowNodes[j] as any).left += shift;
        }
      }
    }
  }

  // ── Compute canvas size ──
  let maxLeft = 0;
  let maxTop = 0;
  for (const n of allNodes) {
    maxLeft = Math.max(maxLeft, n.left);
    maxTop = Math.max(maxTop, n.top);
  }

  return {
    canvas: {
      width: maxLeft + 4, // +4 for padding (2 for node + 2 margin)
      height: maxTop + 4,
    },
    nodes: allNodes,
    connectors: allConnectors,
  };
}
