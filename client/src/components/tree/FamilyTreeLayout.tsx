/**
 * FamilyTreeLayout — renders the family tree using `relatives-tree` layout engine.
 *
 * Features:
 *   - Person cards at computed positions
 *   - SVG connector lines (solid for active couples, dashed for divorced)
 *   - Generation labels ("Дедушки и бабушки", "Родители", "Вы", "Дети", "Внуки")
 *   - Heart icons between married couples
 *   - "Разведены" badge for divorced couples
 */
import { useMemo } from 'react';
import type { Person, Relationship } from '../../types';
import { calcTreeMultiPass } from '../../utils/calcTreeMultiPass';
import PersonCard from './PersonCard';

// Node dimensions (including spacing between nodes)
const NODE_WIDTH = 210;
const NODE_HEIGHT = 270;

const HALF_W = NODE_WIDTH / 2;   // 105
const HALF_H = NODE_HEIGHT / 2;  // 135

// Line styling
const LINE_COLOR = '#cbd5e1';
const LINE_WIDTH = 2;

// Generation label names relative to owner (index 0 = owner level)
const GEN_LABELS_ABOVE = ['Родители', 'Дедушки и бабушки', 'Прадедушки и прабабушки'];
const GEN_LABELS_BELOW = ['Дети', 'Внуки', 'Правнуки'];

interface FamilyTreeLayoutProps {
  persons: Person[];
  relationships: Relationship[];
  rootId: string;
  ownerPersonId: string | null;
  onCardClick?: (person: Person) => void;
  onAddClick?: (person: Person) => void;
  onEditClick?: (person: Person) => void;
  onDeleteClick?: (person: Person) => void;
}

/** Detect couple pairs from relationships */
interface CouplePair {
  person1Id: string;
  person2Id: string;
  isDivorced: boolean;
}

export default function FamilyTreeLayout({
  persons,
  relationships,
  rootId,
  ownerPersonId,
  onCardClick,
  onAddClick,
  onEditClick,
  onDeleteClick,
}: FamilyTreeLayoutProps) {
  // Transform data and compute layout using relatives-tree with multi-pass
  const treeData = useMemo(() => {
    if (persons.length === 0) return null;

    try {
      return calcTreeMultiPass(persons, relationships, ownerPersonId || rootId);
    } catch (err) {
      console.error('calcTreeMultiPass error:', err);
      return null;
    }
  }, [persons, relationships, ownerPersonId, rootId]);

  const personMap = useMemo(
    () => new Map(persons.map(p => [p.id, p])),
    [persons]
  );

  // Build couple pairs from relationships
  const couplePairs = useMemo((): CouplePair[] => {
    return relationships
      .filter(r => r.category === 'couple')
      .map(r => ({
        person1Id: r.person1Id,
        person2Id: r.person2Id,
        isDivorced: r.coupleStatus === 'divorced',
      }));
  }, [relationships]);

  // Group nodes by Y level (generation rows)
  const generationRows = useMemo(() => {
    if (!treeData) return [];

    // Group by top value
    const rowMap = new Map<number, typeof treeData.nodes[number][]>();
    for (const node of treeData.nodes) {
      const key = node.top;
      if (!rowMap.has(key)) rowMap.set(key, []);
      rowMap.get(key)!.push(node);
    }

    // Sort by Y position
    return Array.from(rowMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([top, nodes]) => ({ top, nodes }));
  }, [treeData]);

  // Find owner's Y level for generation labeling
  const ownerTop = useMemo(() => {
    if (!treeData || !ownerPersonId) return null;
    const ownerNode = treeData.nodes.find(n => n.id === ownerPersonId);
    return ownerNode ? ownerNode.top : null;
  }, [treeData, ownerPersonId]);

  // Generate label for a generation row
  const getGenLabel = (rowTop: number): string | null => {
    if (ownerTop === null) return null;
    const diff = rowTop - ownerTop; // positive = below owner, negative = above

    if (diff === 0) {
      return 'Вы и братья/сёстры';
    }
    if (diff < 0) {
      // Above owner (parents, grandparents...)
      const level = Math.round(Math.abs(diff) / 3); // each generation is 3 units apart (ROW_HEIGHT=3)
      if (level >= 1 && level <= GEN_LABELS_ABOVE.length) {
        return GEN_LABELS_ABOVE[level - 1];
      }
      return `Поколение ${level + 1} (предки)`;
    }
    // Below owner (children, grandchildren...)
    const level = Math.round(diff / 3);
    if (level >= 1 && level <= GEN_LABELS_BELOW.length) {
      return GEN_LABELS_BELOW[level - 1];
    }
    return `Поколение ${level} (потомки)`;
  };

  // Build node position map for couple decoration placement
  const nodePositionMap = useMemo(() => {
    if (!treeData) return new Map<string, { left: number; top: number }>();
    return new Map(
      treeData.nodes.map(n => [n.id, { left: n.left, top: n.top }])
    );
  }, [treeData]);

  // Find couple decorations (heart / divorce badge) positions
  const coupleDecorations = useMemo(() => {
    const decorations: Array<{
      key: string;
      cx: number;
      cy: number;
      isDivorced: boolean;
    }> = [];

    for (const pair of couplePairs) {
      const pos1 = nodePositionMap.get(pair.person1Id);
      const pos2 = nodePositionMap.get(pair.person2Id);
      if (!pos1 || !pos2) continue;

      // Only show between nodes on same row (same top)
      if (pos1.top !== pos2.top) continue;

      // Center point between two nodes (in pixel coords)
      // Node center X = (left * HALF_W) + NODE_WIDTH/2
      const cx1 = pos1.left * HALF_W + NODE_WIDTH / 2;
      const cx2 = pos2.left * HALF_W + NODE_WIDTH / 2;
      const cy = pos1.top * HALF_H + NODE_HEIGHT / 2;

      decorations.push({
        key: `${pair.person1Id}-${pair.person2Id}`,
        cx: (cx1 + cx2) / 2,
        cy,
        isDivorced: pair.isDivorced,
      });
    }

    return decorations;
  }, [couplePairs, nodePositionMap]);

  if (!treeData) {
    return <div className="tree-layout-empty">Не удалось построить дерево</div>;
  }

  const canvasWidth = treeData.canvas.width * HALF_W;
  const canvasHeight = treeData.canvas.height * HALF_H;

  return (
    <div
      className="tree-layout"
      style={{
        position: 'relative',
        width: canvasWidth,
        height: canvasHeight,
        margin: '0 auto',
      }}
    >
      {/* SVG connector lines */}
      <svg
        className="tree-connectors"
        width={canvasWidth}
        height={canvasHeight}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        {treeData.connectors.map((connector, idx) => {
          const [x1, y1, x2, y2] = connector;

          // Check if this connector is a horizontal line between divorced spouses
          const isDivorcedLine = y1 === y2 && couplePairs.some(pair => {
            const p1 = nodePositionMap.get(pair.person1Id);
            const p2 = nodePositionMap.get(pair.person2Id);
            if (!p1 || !p2 || !pair.isDivorced) return false;
            if (p1.top !== p2.top) return false;
            // Connector Y should be near the node center Y in grid units (top + 1)
            const nodeY = p1.top + 1;
            return Math.abs(y1 - nodeY) < 0.5;
          });

          // Connectors are in grid units — multiply by HALF_W/HALF_H (like v1A)
          return (
            <line
              key={idx}
              x1={x1 * HALF_W}
              y1={y1 * HALF_H}
              x2={x2 * HALF_W}
              y2={y2 * HALF_H}
              stroke={LINE_COLOR}
              strokeWidth={LINE_WIDTH}
              strokeDasharray={isDivorcedLine ? '6,4' : undefined}
            />
          );
        })}
      </svg>

      {/* Generation labels */}
      {generationRows.map(({ top, nodes: rowNodes }) => {
        const label = getGenLabel(top);
        if (!label) return null;

        // Position label at the top of the row, centered across row nodes
        const leftMost = Math.min(...rowNodes.map(n => n.left));
        const rightMost = Math.max(...rowNodes.map(n => n.left));
        const centerX = ((leftMost + rightMost) / 2) * HALF_W + NODE_WIDTH / 2;
        const labelY = top * HALF_H - 4; // slightly above the nodes

        return (
          <div
            key={`gen-${top}`}
            className="gen-label"
            style={{
              position: 'absolute',
              left: centerX,
              top: labelY,
              transform: 'translateX(-50%)',
              zIndex: 3,
            }}
          >
            <span>{label}</span>
          </div>
        );
      })}

      {/* Couple decorations: hearts and divorce badges */}
      {coupleDecorations.map(({ key, cx, cy, isDivorced }) => (
        <div
          key={`couple-${key}`}
          style={{
            position: 'absolute',
            left: cx,
            top: cy,
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          {isDivorced ? (
            <div className="couple-badge-wrapper">
              <div className="couple-badge-divorced">
                <span>Разведены</span>
              </div>
            </div>
          ) : (
            <div className="couple-heart">
              <span role="img" aria-label="love">💕</span>
            </div>
          )}
        </div>
      ))}

      {/* Person nodes */}
      {treeData.nodes.map((node) => {
        const person = personMap.get(node.id);
        if (!person) return null;

        return (
          <div
            key={node.id}
            style={{
              position: 'absolute',
              width: NODE_WIDTH,
              height: NODE_HEIGHT,
              transform: `translate(${node.left * HALF_W}px, ${node.top * HALF_H}px)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 5,
            }}
          >
            <PersonCard
              person={person}
              isOwner={person.id === ownerPersonId}
              hasSubTree={!!node.hasSubTree}
              onCardClick={onCardClick}
              onAddClick={onAddClick}
              onEditClick={onEditClick}
              onDeleteClick={onDeleteClick}
            />
          </div>
        );
      })}
    </div>
  );
}

export { NODE_WIDTH, NODE_HEIGHT, HALF_W, HALF_H };
