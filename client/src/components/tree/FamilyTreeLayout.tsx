import { useMemo, useRef, useEffect } from 'react';
import calcTree from 'relatives-tree';
import type { ExtNode } from 'relatives-tree/lib/types';
import type { Person, Relationship } from '../../types';
import { transformToTreeNodes } from '../../utils/treeTransform';
import { PersonCard } from './PersonCard';
import { useZoom } from '../../hooks/useZoom';
import { useDrag } from '../../hooks/useDrag';

// Card grid units. NODE_W/NODE_H = full unit; relatives-tree uses half-units, so cards
// occupy 2 half-units wide. Generous values give breathing room between siblings.
const NODE_W = 110;
const NODE_H = 132;

interface Props {
  persons: Person[];
  relationships: Relationship[];
  ownerId?: string | null;
  upcomingBirthdayIds?: Set<string>;
  onPersonClick?: (id: string) => void;
  onPlusClick?: (id: string) => void;
  onLongPress?: (personId: string, pos: { x: number; y: number }) => void;
}

export const FamilyTreeLayout = ({ persons, relationships, ownerId, upcomingBirthdayIds, onPersonClick, onPlusClick, onLongPress }: Props) => {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);

  const nodes = useMemo(() => transformToTreeNodes(persons, relationships), [persons, relationships]);

  const layout = useMemo(() => {
    if (!nodes.length) return null;
    try {
      const root = ownerId && nodes.some((n) => n.id === ownerId) ? ownerId : nodes[0].id;
      // placeholders: true — relatives-tree adds invisible spouse/parent anchors so connector
      // lines don't bleed into wrong columns (e.g. spouse's parents row). We skip rendering
      // any node not present in personById (placeholders fall through that filter).
      return calcTree(nodes as any, { rootId: root, placeholders: true });
    } catch (e) {
      console.warn('[tree] layout fallback', e);
      return null;
    }
  }, [nodes, ownerId]);

  useZoom(content as React.RefObject<HTMLElement>);
  useDrag(viewport as React.RefObject<HTMLElement>, content as React.RefObject<HTMLElement>);

  // Center owner horizontally on first render (and when owner changes).
  useEffect(() => {
    if (!layout || !ownerId || !viewport.current) return;
    const ownerNode = layout.nodes.find((n) => n.id === ownerId);
    if (!ownerNode) return;
    const ownerLeftPx = ownerNode.left * (NODE_W / 2);
    const vp = viewport.current;
    const target = ownerLeftPx + NODE_W / 2 - vp.clientWidth / 2;
    vp.scrollLeft = Math.max(0, target);
  }, [layout, ownerId]);

  if (!layout) return <div style={{padding:24,color:'var(--text-muted)'}}>Дерево пусто. Добавьте первого родственника.</div>;

  const W = layout.canvas.width * NODE_W;
  const H = layout.canvas.height * NODE_H;

  const personById = new Map(persons.map((p) => [p.id, p]));

  return (
    <div ref={viewport} className="tree-stage" style={{ position: 'relative', overflow: 'auto', width: '100%', minHeight: 360, padding: 18, cursor: 'grab' }}>
      <div ref={content} style={{ position: 'relative', width: W, height: H, willChange: 'transform' }}>
        <svg width={W} height={H} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          {layout.connectors.map((c, i) => {
            // relatives-tree connector coords are in half-units, aligned to card centers
            // when nodes are rendered at NODE_W/2 scale. No extra shift needed.
            const [x1, y1, x2, y2] = c;
            return (
              <line
                key={i}
                x1={(x1 * NODE_W) / 2}
                y1={(y1 * NODE_H) / 2}
                x2={(x2 * NODE_W) / 2}
                y2={(y2 * NODE_H) / 2}
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="1.4"
              />
            );
          })}
        </svg>
        {layout.nodes.map((n: ExtNode) => {
          const person = personById.get(n.id);
          // Skip placeholder nodes (relatives-tree's spouse/parent anchors with no real Person).
          if (!person) return null;
          return (
            <div
              key={n.id}
              data-person-id={n.id}
              style={{
                position: 'absolute',
                transform: `translate(${n.left * (NODE_W / 2)}px, ${n.top * (NODE_H / 2)}px)`,
                width: NODE_W,
                height: NODE_H,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PersonCard
                person={person}
                isOwner={person.id === ownerId}
                hasUpcomingBirthday={upcomingBirthdayIds?.has(person.id)}
                onClick={onPersonClick}
                onPlusClick={onPlusClick}
                onLongPress={onLongPress}
                showPlus={person.id === ownerId}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
