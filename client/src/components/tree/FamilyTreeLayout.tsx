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
// Empty buffer above the top generation so the user can scroll up and intuit
// that more parents/grandparents can be added there.
const TOP_PAD = 100;
// Extra room below the bottom generation — same intent as TOP_PAD but for kids
// being added below. 60% of the laid-out canvas height (the user asked for
// repeated +20% bumps).
const BOTTOM_PAD_RATIO = 0.6;

interface Props {
  persons: Person[];
  relationships: Relationship[];
  ownerId?: string | null;
  /** Per-person event icons for the current month (e.g. ['🎂','💍']). */
  personEventIcons?: Record<string, string[]>;
  onPersonClick?: (id: string) => void;
  onPlusClick?: (id: string) => void;
}

export const FamilyTreeLayout = ({ persons, relationships, ownerId, personEventIcons, onPersonClick, onPlusClick }: Props) => {
  const viewport = useRef<HTMLDivElement>(null);
  // Track real viewport size — re-runs the auto-centre when WebView orientation
  // or chrome height changes.
  const [vpSize, setVpSize] = useState({ w: 0, h: 0 });
  const content = useRef<HTMLDivElement>(null);
  const fittedRef = useRef(false);

  const nodes = useMemo(() => transformToTreeNodes(persons, relationships, ownerId), [persons, relationships, ownerId]);

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
        if (!fittedRef.current) {
          const W = layout.canvas.width * (NODE_W / 2);
          const H = layout.canvas.height * (NODE_H / 2) + TOP_PAD;
          const fit = Math.min(vp.clientWidth / W, vp.clientHeight / H, 1);
          if (fit < 1) zoom.setTo(fit);
          fittedRef.current = true;
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
      </div>
    </div>
  );
};
