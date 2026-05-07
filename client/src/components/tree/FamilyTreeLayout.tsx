import { useMemo, useRef } from 'react';
import calcTree from 'relatives-tree';
import type { ExtNode } from 'relatives-tree/lib/types';
import type { Person, Relationship } from '../../types';
import { transformToTreeNodes } from '../../utils/treeTransform';
import { PersonCard } from './PersonCard';
import { useZoom } from '../../hooks/useZoom';
import { useDrag } from '../../hooks/useDrag';

const NODE_W = 80, NODE_H = 100;

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
      return calcTree(nodes as any, { rootId: root, placeholders: false });
    } catch (e) {
      console.warn('[tree] layout fallback', e);
      return null;
    }
  }, [nodes, ownerId]);

  useZoom(content as React.RefObject<HTMLElement>);
  useDrag(viewport as React.RefObject<HTMLElement>, content as React.RefObject<HTMLElement>);

  if (!layout) return <div style={{padding:24,color:'var(--text-muted)'}}>Дерево пусто. Добавьте первого родственника.</div>;

  const W = layout.canvas.width * NODE_W;
  const H = layout.canvas.height * NODE_H;

  const personById = new Map(persons.map((p) => [p.id, p]));

  return (
    <div ref={viewport} className="tree-stage" style={{ position: 'relative', overflow: 'auto', width: '100%', minHeight: 360, padding: 18, cursor: 'grab' }}>
      <div ref={content} style={{ position: 'relative', width: W, height: H, willChange: 'transform' }}>
        <svg width={W} height={H} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          {layout.connectors.map((c, i) => {
            const [x1, y1, x2, y2] = c;
            return <line key={i} x1={x1 * NODE_W} y1={y1 * NODE_H} x2={x2 * NODE_W} y2={y2 * NODE_H} stroke="rgba(255,255,255,0.18)" strokeWidth="1.3" />;
          })}
        </svg>
        {layout.nodes.map((n: ExtNode) => {
          const person = personById.get(n.id);
          if (!person) return null;
          return (
            <div key={n.id} style={{ position: 'absolute', transform: `translate(${n.left * (NODE_W / 2)}px, ${n.top * (NODE_H / 2)}px)`, width: NODE_W, height: NODE_H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
