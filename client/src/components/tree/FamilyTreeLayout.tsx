/**
 * FamilyTreeLayout — renders the family tree using `relatives-tree` layout engine.
 *
 * The library computes node positions and connector line segments.
 * We render our custom PersonCard components at those positions,
 * and draw SVG lines from the computed connectors.
 */
import { useMemo } from 'react';
import calcTree from 'relatives-tree';
import type { Person, Relationship } from '../../types';
import { transformToTreeNodes } from '../../utils/treeTransform';
import PersonCard from './PersonCard';

// Node dimensions (including spacing between nodes)
const NODE_WIDTH = 210;
const NODE_HEIGHT = 270;

const HALF_W = NODE_WIDTH / 2;   // 105
const HALF_H = NODE_HEIGHT / 2;  // 135

// Line styling
const LINE_COLOR = '#cbd5e1';
const LINE_WIDTH = 2;

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
  // Transform data and compute layout
  const treeData = useMemo(() => {
    if (persons.length === 0) return null;

    const nodes = transformToTreeNodes(persons, relationships);

    try {
      return calcTree(nodes as any, { rootId });
    } catch (err) {
      console.error('calcTree error:', err);
      return null;
    }
  }, [persons, relationships, rootId]);

  const personMap = useMemo(
    () => new Map(persons.map(p => [p.id, p])),
    [persons]
  );

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
          return (
            <line
              key={idx}
              x1={x1 * HALF_W}
              y1={y1 * HALF_H}
              x2={x2 * HALF_W}
              y2={y2 * HALF_H}
              stroke={LINE_COLOR}
              strokeWidth={LINE_WIDTH}
            />
          );
        })}
      </svg>

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
