import { useMemo, useRef, useState, useEffect } from 'react';
import calcTree from 'relatives-tree';
import type { ExtNode } from 'relatives-tree/lib/types';
import type { Person, Relationship } from '../../types';
import { transformToTreeNodes } from '../../utils/treeTransform';
import { PersonCard } from './PersonCard';
import { useZoom } from '../../hooks/useZoom';
import { useDrag } from '../../hooks/useDrag';

// Card grid units. NODE_W/NODE_H = full unit; relatives-tree uses half-units, so cards
// occupy 2 half-units wide. Generous values give breathing room between siblings.
// NODE_W/NODE_H control BOTH the per-card grid step (i.e. spacing between
// siblings/parents) AND the total canvas size. Cards themselves are sized in
// CSS (.pcard width=72, height ≈92). The gap between cards is NODE_W − 72.
const NODE_W = 144;   // spacing between siblings ≈ 72 px
const NODE_H = 184;   // spacing between generations ≈ 92 px
// Empty buffer above the top generation. We render "Add father" / "Add mother"
// placeholders for parentless persons one full generation above their card,
// so this needs at least NODE_H of room to keep them on canvas.
const TOP_PAD = 200;
// Extra room below the bottom generation — same intent as TOP_PAD but for
// kids being added below. 25% is enough breathing room; the canvas grows
// naturally as descendants get added.
const BOTTOM_PAD_RATIO = 0.25;

interface Props {
  persons: Person[];
  relationships: Relationship[];
  ownerId?: string | null;
  /** Per-person event icons for the current month (e.g. ['🎂','💍']). */
  personEventIcons?: Record<string, string[]>;
  onPersonClick?: (id: string) => void;
  onPlusClick?: (id: string) => void;
  /** Click on an empty parent slot above a person without parents. */
  onAddParent?: (personId: string, gender: 'male' | 'female') => void;
}

export const FamilyTreeLayout = ({ persons, relationships, ownerId, personEventIcons, onPersonClick, onPlusClick, onAddParent }: Props) => {
  const viewport = useRef<HTMLDivElement>(null);
  // Track real viewport size — re-runs the auto-centre when WebView orientation
  // or chrome height changes.
  const [vpSize, setVpSize] = useState({ w: 0, h: 0 });
  const content = useRef<HTMLDivElement>(null);
  // Remember the canvas dimensions we last auto-fit for. When the tree grows
  // (or shrinks) — i.e. someone adds/removes a person — the dims string
  // changes and we re-run fit. Manual zooms between additions stay intact.
  const lastFitDimsRef = useRef<string>('');

  const nodes = useMemo(() => transformToTreeNodes(persons, relationships, ownerId), [persons, relationships, ownerId]);

  // Owner's existing father/mother. Used to decide which "Add father / Add
  // mother" placeholders to render and where to put them (above the owner
  // when both are missing, next to the existing parent when only one is).
  const ownerParents = useMemo(() => {
    if (!ownerId) return null;
    let fatherId: string | null = null, motherId: string | null = null;
    for (const r of relationships) {
      if (r.category !== 'parent_child' || r.person2Id !== ownerId) continue;
      const parent = persons.find((p) => p.id === r.person1Id);
      if (!parent) continue;
      if (parent.gender === 'male' && !fatherId) fatherId = parent.id;
      else if (parent.gender === 'female' && !motherId) motherId = parent.id;
    }
    return { fatherId, motherId };
  }, [persons, relationships, ownerId]);

  const layout = useMemo(() => {
    if (!nodes.length) return null;
    try {
      const root = ownerId && nodes.some((n) => n.id === ownerId) ? ownerId : nodes[0].id;
      // placeholders: false — relatives-tree's invisible spouse/parent anchors
      // generate stray connector segments (an H-bar plus side V-stubs) that
      // overlap our own "Add father / Add mother" placeholder T-junction. We
      // own the parent-slot rendering ourselves now, so we don't need
      // relatives-tree's phantom column anchors.
      return calcTree(nodes as any, { rootId: root, placeholders: false });
    } catch (e) {
      console.warn('[tree] layout fallback', e);
      return null;
    }
  }, [nodes, ownerId]);

  // Build SVG <path d=...> strings for connectors with rounded corners.
  // Two-pass approach:
  //   1. For each junction with a perpendicular pair, compute ONE radius (min of
  //      half each incident segment's screen length, capped at ARC_R). All segment
  //      shortening AND all arcs at this junction use this exact radius — so the
  //      shortened segment end and the arc's approach point are the same point.
  //   2. Render each segment as a `M L` line shortened by junction[start].r and
  //      junction[end].r where applicable. Then render Q-bezier arcs at each
  //      junction for every perpendicular pair.
  const connectorPaths = useMemo(() => {
    if (!layout) return [] as string[];
    const segs = layout.connectors;
    const sX = NODE_W / 2;
    const sY = NODE_H / 2;
    const ARC_R = 14;
    const key = (x: number, y: number) => `${Math.round(x * 100)},${Math.round(y * 100)}`;
    type Item = { idx: number; isStart: boolean; far: [number, number] };
    const incident = new Map<string, Item[]>();
    segs.forEach((seg, i) => {
      const k1 = key(seg[0], seg[1]);
      const k2 = key(seg[2], seg[3]);
      if (!incident.has(k1)) incident.set(k1, []);
      if (!incident.has(k2)) incident.set(k2, []);
      incident.get(k1)!.push({ idx: i, isStart: true, far: [seg[2], seg[3]] });
      incident.get(k2)!.push({ idx: i, isStart: false, far: [seg[0], seg[1]] });
    });
    const isPerp = (ax: number, ay: number, bx: number, by: number) => {
      const lenA = Math.hypot(ax, ay);
      const lenB = Math.hypot(bx, by);
      if (lenA < 1e-6 || lenB < 1e-6) return false;
      return Math.abs((ax * bx + ay * by) / (lenA * lenB)) < 0.05;
    };
    const segScreenLen = (idx: number) => {
      const s = segs[idx];
      return Math.hypot((s[2] - s[0]) * sX, (s[3] - s[1]) * sY);
    };
    // Pass 1: determine each junction's radius (only if at least one perp pair exists).
    const junctionR = new Map<string, number>();
    incident.forEach((items, k) => {
      if (items.length < 2) return;
      let hasPerp = false;
      for (let i = 0; i < items.length && !hasPerp; i++) {
        for (let j = i + 1; j < items.length && !hasPerp; j++) {
          const a = items[i];
          const b = items[j];
          const aSeg = segs[a.idx];
          const bSeg = segs[b.idx];
          const aNear = a.isStart ? [aSeg[0], aSeg[1]] : [aSeg[2], aSeg[3]];
          const bNear = b.isStart ? [bSeg[0], bSeg[1]] : [bSeg[2], bSeg[3]];
          if (isPerp(a.far[0] - aNear[0], a.far[1] - aNear[1], b.far[0] - bNear[0], b.far[1] - bNear[1])) {
            hasPerp = true;
          }
        }
      }
      if (!hasPerp) return;
      // r = min(ARC_R, half of shortest incident segment in screen px)
      let minLen = Infinity;
      items.forEach((it) => {
        const len = segScreenLen(it.idx);
        if (len < minLen) minLen = len;
      });
      junctionR.set(k, Math.min(ARC_R, minLen * 0.45));
    });
    const paths: string[] = [];
    // Pass 2a: each segment as a line with ends shortened by the per-junction r.
    segs.forEach((seg, i) => {
      const x1p = seg[0] * sX;
      const y1p = seg[1] * sY;
      const x2p = seg[2] * sX;
      const y2p = seg[3] * sY;
      const dx = x2p - x1p;
      const dy = y2p - y1p;
      const len = Math.hypot(dx, dy);
      if (len < 0.01) return;
      const ux = dx / len;
      const uy = dy / len;
      const k1 = key(seg[0], seg[1]);
      const k2 = key(seg[2], seg[3]);
      const r1 = junctionR.get(k1) ?? 0;
      const r2 = junctionR.get(k2) ?? 0;
      const sx = x1p + ux * r1;
      const sy = y1p + uy * r1;
      const ex = x2p - ux * r2;
      const ey = y2p - uy * r2;
      paths.push(`M ${sx},${sy} L ${ex},${ey}`);
    });
    // Pass 2b: Q-bezier arc at each junction for every perpendicular pair.
    const drawn = new Set<string>();
    incident.forEach((items, k) => {
      const r = junctionR.get(k);
      if (r === undefined) return;
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i];
          const b = items[j];
          const aSeg = segs[a.idx];
          const bSeg = segs[b.idx];
          const aNear = a.isStart ? [aSeg[0], aSeg[1]] : [aSeg[2], aSeg[3]];
          const bNear = b.isStart ? [bSeg[0], bSeg[1]] : [bSeg[2], bSeg[3]];
          const aDx = a.far[0] - aNear[0];
          const aDy = a.far[1] - aNear[1];
          const bDx = b.far[0] - bNear[0];
          const bDy = b.far[1] - bNear[1];
          if (!isPerp(aDx, aDy, bDx, bDy)) continue;
          const arcKey = a.idx < b.idx ? `${k}|${a.idx}-${b.idx}` : `${k}|${b.idx}-${a.idx}`;
          if (drawn.has(arcKey)) continue;
          drawn.add(arcKey);
          const jx = aNear[0] * sX;
          const jy = aNear[1] * sY;
          const aDxs = aDx * sX;
          const aDys = aDy * sY;
          const bDxs = bDx * sX;
          const bDys = bDy * sY;
          const lenAs = Math.hypot(aDxs, aDys);
          const lenBs = Math.hypot(bDxs, bDys);
          const apAx = jx + (aDxs / lenAs) * r;
          const apAy = jy + (aDys / lenAs) * r;
          const apBx = jx + (bDxs / lenBs) * r;
          const apBy = jy + (bDys / lenBs) * r;
          paths.push(`M ${apAx},${apAy} Q ${jx},${jy} ${apBx},${apBy}`);
        }
      }
    });
    return paths;
  }, [layout]);

  const zoom = useZoom(content as React.RefObject<HTMLElement>);
  useDrag(viewport as React.RefObject<HTMLElement>, content as React.RefObject<HTMLElement>);

  // Observe the viewport so the auto-centre re-runs when chrome/orientation
  // changes (Click WebView occasionally reflows on first paint).
  useEffect(() => {
    const vp = viewport.current;
    if (!vp) return;
    const update = () => setVpSize({ w: vp.clientWidth, h: vp.clientHeight });
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(update);
    obs.observe(vp);
    return () => obs.disconnect();
  }, []);

  // Auto-fit (zoom out to fit the whole tree) + centre owner card. Runs once
  // per mount (fittedRef gates the fit so subsequent re-renders don't snap
  // the user back). We retry across rAFs because Click's WebView sometimes
  // reports clientWidth/Height as 0 on the first paint.
  // Uses a manual scrollLeft/scrollTop delta on the .tree-stage container
  // instead of card.scrollIntoView — the native call walks the scroll chain
  // and was yanking the page header out of view.
  useEffect(() => {
    if (!layout || !ownerId) return;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let raf: number | null = null;
    const tryCentre = () => {
      attempts += 1;
      const vp = viewport.current;
      if (!vp) return;
      const card = vp.querySelector<HTMLElement>(`[data-person-id="${ownerId}"]`);
      if (card && vp.clientWidth && vp.clientHeight) {
        // Re-fit when the canvas changed shape (someone got added/removed).
        // dimsKey also includes viewport size so an orientation change
        // re-fits too. Manual user zooms between additions stay intact —
        // the dimsKey hasn't changed.
        const dimsKey = `${layout.canvas.width}x${layout.canvas.height}@${vp.clientWidth}x${vp.clientHeight}`;
        if (lastFitDimsRef.current !== dimsKey) {
          const W = layout.canvas.width * (NODE_W / 2);
          const H = layout.canvas.height * (NODE_H / 2) + TOP_PAD;
          const fit = Math.min(vp.clientWidth / W, vp.clientHeight / H, 1);
          zoom.setTo(fit < 1 ? fit : 1);
          lastFitDimsRef.current = dimsKey;
        }
        const centreOwner = () => {
          const vpRect = vp.getBoundingClientRect();
          const cardRect = card.getBoundingClientRect();
          vp.scrollLeft += (cardRect.left + cardRect.width / 2) - (vpRect.left + vpRect.width / 2);
          vp.scrollTop  += (cardRect.top  + cardRect.height / 2) - (vpRect.top  + vpRect.height / 2);
        };
        centreOwner();
        raf = requestAnimationFrame(centreOwner);
        return;
      }
      if (attempts < 20) {
        timer = setTimeout(() => { raf = requestAnimationFrame(tryCentre); }, 50);
      }
    };
    raf = requestAnimationFrame(tryCentre);
    return () => {
      if (raf != null) cancelAnimationFrame(raf);
      if (timer != null) clearTimeout(timer);
    };
  }, [layout, ownerId, vpSize.w, vpSize.h, zoom]);

  if (!layout) return <div style={{padding:24,color:'var(--text-muted)'}}>Дерево пусто. Добавьте первого родственника.</div>;

  // canvas.width/height come back in HALF-units (same scale as node.left/top),
  // so the rendered box must be NODE_W/2 × NODE_H/2 per half-unit. Spacing
  // and canvas size are now both driven by NODE_W/NODE_H — no extra fudge.
  // We pad the rendered canvas an extra 20% below the bottom generation so
  // there's room to scroll past the lowest cards (helps when adding children).
  const W = layout.canvas.width * (NODE_W / 2);
  const layoutH = layout.canvas.height * (NODE_H / 2) + TOP_PAD;
  const H = Math.round(layoutH * (1 + BOTTOM_PAD_RATIO));

  const personById = new Map(persons.map((p) => [p.id, p]));

  // Compute owner-only parent placeholder slots. We deliberately don't show
  // placeholders for anyone except the owner: it's THEIR tree and the most
  // important UX is letting them complete their own parents row. Slots:
  //   - Both missing → father/mother dashed cards above the owner.
  //   - Father exists, mother missing → mother slot RIGHT of father (his
  //     spouse position).
  //   - Mother exists, father missing → father slot LEFT of mother.
  //   - Neither missing → no slots, no rendering at all.
  // Each slot also drives the corresponding T-junction connector.
  type ParentSlot = { gender: 'male' | 'female'; x: number; y: number };
  const parentSlots: ParentSlot[] = [];
  let connectorAnchor: { fatherSlotX: number; motherSlotX: number; parentY: number } | null = null;
  if (ownerId && ownerParents) {
    const ownerNode = layout.nodes.find((n) => n.id === ownerId);
    if (ownerNode) {
      const ownerWX = ownerNode.left * (NODE_W / 2);
      const ownerWY = ownerNode.top * (NODE_H / 2) + TOP_PAD;
      const missingFather = !ownerParents.fatherId;
      const missingMother = !ownerParents.motherId;
      if (missingFather && missingMother) {
        const parentY = ownerWY - NODE_H;
        parentSlots.push({ gender: 'male',   x: ownerWX,                  y: parentY });
        parentSlots.push({ gender: 'female', x: ownerWX + NODE_W / 2,     y: parentY });
        connectorAnchor = {
          fatherSlotX: ownerWX,
          motherSlotX: ownerWX + NODE_W / 2,
          parentY,
        };
      } else if (missingMother && ownerParents.fatherId) {
        const fNode = layout.nodes.find((n) => n.id === ownerParents.fatherId);
        if (fNode) {
          parentSlots.push({
            gender: 'female',
            x: fNode.left * (NODE_W / 2) + NODE_W,
            y: fNode.top * (NODE_H / 2) + TOP_PAD,
          });
        }
      } else if (missingFather && ownerParents.motherId) {
        const mNode = layout.nodes.find((n) => n.id === ownerParents.motherId);
        if (mNode) {
          parentSlots.push({
            gender: 'male',
            x: mNode.left * (NODE_W / 2) - NODE_W / 2,
            y: mNode.top * (NODE_H / 2) + TOP_PAD,
          });
        }
      }
    }
  }

  return (
    <div
      ref={viewport}
      className="tree-stage"
      style={{
        position: 'relative',
        overflow: 'auto',
        width: '100%',
        height: '100%',
        minHeight: 360,
        cursor: 'grab',
        // Centre the content box when it's smaller than the viewport (e.g. a
        // 1-person tree). `safe` keyword falls back to start-alignment when
        // content overflows, so larger trees stay scrollable instead of
        // getting clipped at top/left.
        display: 'flex',
        justifyContent: 'safe center',
        alignItems: 'safe center',
      }}
    >
      <div ref={content} style={{ position: 'relative', width: W, height: H, willChange: 'transform' }}>
        <svg width={W} height={H} style={{ position: 'absolute', top: TOP_PAD, left: 0, pointerEvents: 'none' }}>
          {/* strokeLinecap="butt" — at junctions the segment's shortened end and
              the arc's start share the same point; round caps would double up there
              and render as a small dot. Butt caps are flush. */}
          {connectorPaths.map((d, i) => (
            <path
              key={i}
              d={d}
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="butt"
            />
          ))}
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
                transform: `translate(${n.left * (NODE_W / 2)}px, ${n.top * (NODE_H / 2) + TOP_PAD}px)`,
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
                eventIcons={personEventIcons?.[person.id]}
                onClick={onPersonClick}
                onPlusClick={onPlusClick}
                showPlus={true}
              />
            </div>
          );
        })}

        {/* Owner-only parent slots. Connectors only render when both parents
            are missing (T-junction); for the half-parented case the existing
            parent's relatives-tree connector covers the spouse line, and the
            new placeholder sits next to them visually as a spouse position. */}
        {connectorAnchor && ownerId && (() => {
          const ownerNode = layout.nodes.find((n) => n.id === ownerId);
          if (!ownerNode) return null;
          const cardWrapperX = ownerNode.left * (NODE_W / 2);
          const cardWrapperY = ownerNode.top * (NODE_H / 2) + TOP_PAD;
          const childCenterX = cardWrapperX + NODE_W / 2;
          const fatherCenterX = connectorAnchor.fatherSlotX + NODE_W / 4;
          const motherCenterX = connectorAnchor.motherSlotX + NODE_W / 4;
          const PLACEHOLDER_H = 82;
          const PERSON_H = 92;
          const parentBottomY = connectorAnchor.parentY + (NODE_H + PLACEHOLDER_H) / 2;
          const childTopY = cardWrapperY + (NODE_H - PERSON_H) / 2;
          const stubY = parentBottomY + (childTopY - parentBottomY) / 2;
          const stroke = { stroke: 'rgba(255,255,255,0.3)', strokeWidth: '1.4', strokeDasharray: '3 3' };
          return (
            <svg width={W} height={H} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
              <line x1={fatherCenterX} y1={parentBottomY} x2={fatherCenterX} y2={stubY} {...stroke} />
              <line x1={motherCenterX} y1={parentBottomY} x2={motherCenterX} y2={stubY} {...stroke} />
              <line x1={fatherCenterX} y1={stubY} x2={motherCenterX} y2={stubY} {...stroke} />
              <line x1={childCenterX} y1={stubY} x2={childCenterX} y2={childTopY} {...stroke} />
            </svg>
          );
        })()}

        {parentSlots.map((slot) => (
          <div
            key={slot.gender}
            style={{
              position: 'absolute',
              transform: `translate(${slot.x}px, ${slot.y}px)`,
              width: NODE_W / 2,
              height: NODE_H,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              className="pcard-placeholder"
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); if (ownerId) onAddParent?.(ownerId, slot.gender); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (ownerId) onAddParent?.(ownerId, slot.gender); } }}
            >
              <span className="pcard-placeholder-plus" aria-hidden="true">+</span>
              <span className="pcard-placeholder-label">Добавить<br />{slot.gender === 'male' ? 'отца' : 'мать'}</span>
            </div>
          </div>
        ))}

        {/* "Start here" hint over the mother slot — only on a brand-new tree
            (just the Click-seeded owner with both parents missing). */}
        {persons.length === 1 && parentSlots.find((s) => s.gender === 'female') && (() => {
          const motherSlot = parentSlots.find((s) => s.gender === 'female')!;
          return (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                transform: `translate(${motherSlot.x + NODE_W / 4}px, ${motherSlot.y + 6}px) translate(-50%, 0)`,
                pointerEvents: 'none',
                zIndex: 2,
              }}
            >
              <div
                style={{
                  background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                  color: '#0a0a0d',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '4px 9px 4px 8px',
                  borderRadius: 999,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 10px rgba(251,191,36,0.45)',
                  animation: 'cf-hint-bob 1.6s ease-in-out infinite',
                }}
              >
                начни отсюда ↓
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
