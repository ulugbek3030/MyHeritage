/**
 * FamilyTreeLayout — renders the family tree using `family-chart` library.
 *
 * Features:
 *   - Custom HTML cards matching our PersonCard design
 *   - Automatic layout and SVG connector lines
 *   - Built-in zoom/pan
 *   - Gender color coding (blue/pink border-top)
 *   - Deceased styling
 *   - Owner badge
 *   - Plus-tab for adding relatives
 */
import { useEffect, useRef, useCallback } from 'react';
import * as f3 from 'family-chart';
import 'family-chart/styles/family-chart.css';
import type { Person, Relationship } from '../../types';
import type { TreeDatum } from 'family-chart';
import { transformToFamilyChartData } from '../../utils/familyChartTransform';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

interface FamilyTreeLayoutProps {
  persons: Person[];
  relationships: Relationship[];
  rootId: string;
  ownerPersonId: string | null;
  onCardClick?: (person: Person) => void;
  onAddClick?: (person: Person) => void;
}

/** Format date for card display */
function formatDateShort(dateStr: string | null, yearOnly: number | null, dateKnown: boolean): string {
  if (dateKnown && dateStr) {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
  if (yearOnly) return yearOnly.toString();
  return '';
}

function formatYears(person: Person): string {
  const birth = formatDateShort(person.birthDate, person.birthYear, person.birthDateKnown);
  if (!birth && !person.isAlive) return '';
  if (!birth && person.isAlive) return '';

  const death = !person.isAlive
    ? formatDateShort(person.deathDate, person.deathYear, person.deathDateKnown) || '?'
    : '';

  if (!person.isAlive) {
    return `${birth || '?'} — ${death}`;
  }
  return birth;
}

/** Escape HTML for safe insertion */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Male SVG icon */
const MALE_ICON_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v1.2c0 .7.5 1.2 1.2 1.2h16.8c.7 0 1.2-.5 1.2-1.2v-1.2c0-3.2-6.4-4.8-9.6-4.8z"/></svg>`;

/** Female SVG icon */
const FEMALE_ICON_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.4c-1.5 0-2.7.5-3.6 1.3C7.9 3.5 7.4 3.4 6.8 3.4c-2.2 0-3.6 1.8-3.6 3.8 0 .8.2 1.5.5 2.1C2.7 10.5 2.4 12 2.4 12s1.2.6 2.4.6c.3 0 .6 0 .8-.1.8 1.4 2.3 3.1 4 3.9V18c-3.2.5-7.2 1.8-7.2 3.6v1.2h19.2v-1.2c0-1.8-4-3.1-7.2-3.6v-1.6c1.7-.8 3.2-2.5 4-3.9.3.1.5.1.8.1 1.2 0 2.4-.6 2.4-.6s-.3-1.5-1.3-2.7c.3-.6.5-1.3.5-2.1 0-2-1.4-3.8-3.6-3.8-.6 0-1.1.1-1.6.3-.9-.8-2.1-1.3-3.6-1.3z"/></svg>`;

/** Create custom HTML for a card */
function createCardHtml(d: TreeDatum, ownerPersonId: string | null): string {
  const person = d.data?.data?._person as Person | undefined;
  if (!person) {
    // Fallback for nodes without person data
    const firstName = d.data?.data?.['first name'] || '';
    const lastName = d.data?.data?.['last name'] || '';
    return `<div class="card-inner f3-custom-card">
      <div class="card-body">
        <div class="card-name"><span class="card-name-first">${escapeHtml(firstName)} ${escapeHtml(lastName)}</span></div>
      </div>
    </div>`;
  }

  const isOwner = person.id === ownerPersonId;
  const years = formatYears(person);
  const photoSrc = person.photoUrl
    ? (person.photoUrl.startsWith('http') ? person.photoUrl : `${API_BASE}${person.photoUrl}`)
    : null;

  const deceasedClass = !person.isAlive ? ' deceased' : '';
  const ownerClass = isOwner ? ' owner' : '';
  const genderClass = person.gender;

  // Avatar HTML
  let avatarHtml: string;
  if (photoSrc) {
    avatarHtml = `<img src="${escapeHtml(photoSrc)}" alt="${escapeHtml(person.firstName)}" />`;
  } else {
    avatarHtml = person.gender === 'male' ? MALE_ICON_SVG : FEMALE_ICON_SVG;
  }

  // Name parts
  const nameParts = [person.lastName, person.middleName].filter(Boolean).join(' ');
  const maidenPart = person.maidenName ? ` (${escapeHtml(person.maidenName)})` : '';

  // Badges
  let badgesHtml = '';
  if (!person.isAlive) {
    const deceasedText = person.gender === 'male' ? 'Умер' : 'Умерла';
    badgesHtml += `<div><span class="badge-deceased">${deceasedText}</span></div>`;
  }
  if (isOwner) {
    badgesHtml += `<div><span class="badge-owner"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Это вы</span></div>`;
  }

  return `<div class="f3-custom-card card ${genderClass}${deceasedClass}${ownerClass}" data-person-id="${person.id}">
    <div class="card-body">
      <div class="avatar">${avatarHtml}</div>
      <div class="card-name">
        <span class="card-name-first">${escapeHtml(person.firstName)}</span>
        ${nameParts || person.maidenName ? `<span class="card-name-rest">${escapeHtml(nameParts)}${maidenPart}</span>` : ''}
      </div>
      ${years ? `<div class="card-years">${escapeHtml(years)}</div>` : ''}
      ${badgesHtml}
    </div>
    <button class="plus-tab" data-action="add" data-person-id="${person.id}" aria-label="Добавить родственника">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
        <line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
    </button>
  </div>`;
}

export default function FamilyTreeLayout({
  persons,
  relationships,
  rootId,
  ownerPersonId,
  onCardClick,
  onAddClick,
}: FamilyTreeLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);

  // Store callbacks in refs so chart doesn't need to be recreated
  const onCardClickRef = useRef(onCardClick);
  const onAddClickRef = useRef(onAddClick);
  const personsMapRef = useRef<Map<string, Person>>(new Map());

  onCardClickRef.current = onCardClick;
  onAddClickRef.current = onAddClick;
  personsMapRef.current = new Map(persons.map(p => [p.id, p]));

  // Handle click on card body or plus-tab
  const handleContainerClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;

    // Check for plus-tab click
    const plusTab = target.closest('.plus-tab') as HTMLElement | null;
    if (plusTab) {
      e.stopPropagation();
      const personId = plusTab.getAttribute('data-person-id');
      if (personId && onAddClickRef.current) {
        const person = personsMapRef.current.get(personId);
        if (person) onAddClickRef.current(person);
      }
      return;
    }

    // Check for card body click
    const cardBody = target.closest('.card-body') as HTMLElement | null;
    if (cardBody) {
      const card = cardBody.closest('.f3-custom-card') as HTMLElement | null;
      const personId = card?.getAttribute('data-person-id');
      if (personId && onCardClickRef.current) {
        const person = personsMapRef.current.get(personId);
        if (person) onCardClickRef.current(person);
      }
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || persons.length === 0) return;

    // Clear previous chart
    container.innerHTML = '';

    const data = transformToFamilyChartData(persons, relationships);

    try {
      const chart = f3.createChart(container, data)
        .setCardXSpacing(250)
        .setCardYSpacing(200)
        .setTransitionTime(800)
        .setSingleParentEmptyCard(false);

      chart.setCardHtml()
        .setStyle('rect')
        .setCardDim({ w: 174, h: 220, text_x: 87, text_y: 15, img_w: 60, img_h: 60, img_x: 57, img_y: 10 })
        .setCardInnerHtmlCreator((d: TreeDatum) => createCardHtml(d, ownerPersonId))
        .setOnCardClick(null); // Disable default card click (we handle it ourselves)

      // Set main person to owner (or first person)
      if (ownerPersonId) {
        chart.updateMainId(ownerPersonId);
      }

      chart.updateTree({ initial: true, tree_position: 'fit' });

      chartRef.current = chart;

      // Add click listener for our custom buttons
      container.addEventListener('click', handleContainerClick);

      return () => {
        container.removeEventListener('click', handleContainerClick);
        chartRef.current = null;
      };
    } catch (err) {
      console.error('family-chart error:', err);
      container.innerHTML = '<div style="padding:20px;text-align:center;color:#666;">Не удалось построить дерево</div>';
    }
  }, [persons, relationships, rootId, ownerPersonId, handleContainerClick]);

  if (persons.length === 0) {
    return <div className="tree-layout-empty">Не удалось построить дерево</div>;
  }

  return (
    <div
      ref={containerRef}
      className="f3 f3-custom-tree"
      style={{
        width: '100%',
        height: '100%',
      }}
    />
  );
}
