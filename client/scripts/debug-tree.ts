/* eslint-disable */
// Reproduce the exact production tree and dump what relatives-tree returns.
// Run with: pnpm --filter client tsx scripts/debug-tree.ts
import calcTree from 'relatives-tree';
import { transformToTreeNodes } from '../src/utils/treeTransform';
import type { Person, Relationship } from '../src/types';

const persons: Person[] = [
  { id: 'b67dbb45-3d26-436a-9a15-ad96f635c26e', treeId: '', firstName: 'Baxodir',  lastName: 'Abdukadirov',  middleName: null, maidenName: null, gender: 'male',   birthDate: null, birthYear: null, birthDateKnown: false, isAlive: true,  deathDate: null, deathYear: null, deathDateKnown: false, verified: true,  note: null, photoUrl: null, phone: null },
  { id: '333430e0-8ce1-4955-836a-29b44f370f94', treeId: '', firstName: 'Miragzam', lastName: 'Abdukadirov',  middleName: null, maidenName: null, gender: 'male',   birthDate: null, birthYear: 1949, birthDateKnown: false, isAlive: false, deathDate: null, deathYear: null, deathDateKnown: false, verified: false, note: null, photoUrl: null, phone: null },
  { id: '66701e1b-2e7e-4096-8302-89996e3089ad', treeId: '', firstName: 'Djamila',  lastName: 'Ganieva',      middleName: null, maidenName: null, gender: 'female', birthDate: null, birthYear: null, birthDateKnown: false, isAlive: true,  deathDate: null, deathYear: null, deathDateKnown: false, verified: false, note: null, photoUrl: null, phone: null },
  { id: 'a29a5c76-469b-4211-9dfe-41edf3aadc57', treeId: '', firstName: 'Mirsaid',  lastName: 'Abdukadirov',  middleName: null, maidenName: null, gender: 'male',   birthDate: null, birthYear: 1976, birthDateKnown: false, isAlive: true,  deathDate: null, deathYear: null, deathDateKnown: false, verified: false, note: null, photoUrl: null, phone: null },
  { id: '9e7b2f72-09ca-49f9-9d01-135f94b5a428', treeId: '', firstName: 'Madina',   lastName: 'Abdukadirovа', middleName: null, maidenName: null, gender: 'female', birthDate: null, birthYear: null, birthDateKnown: false, isAlive: true,  deathDate: null, deathYear: null, deathDateKnown: false, verified: false, note: null, photoUrl: null, phone: null },
  { id: 'cc39f690-ee76-4e24-a287-4203036c1f01', treeId: '', firstName: 'Dilnoza',  lastName: 'Abdukadirovа', middleName: null, maidenName: null, gender: 'female', birthDate: null, birthYear: 1987, birthDateKnown: false, isAlive: true,  deathDate: null, deathYear: null, deathDateKnown: false, verified: false, note: null, photoUrl: null, phone: null },
  { id: '1d161129-dbdf-450c-b5ba-c4341e4b485e', treeId: '', firstName: 'Amirsaid', lastName: 'Abdukadirov',  middleName: null, maidenName: null, gender: 'male',   birthDate: null, birthYear: null, birthDateKnown: false, isAlive: true,  deathDate: null, deathYear: null, deathDateKnown: false, verified: false, note: null, photoUrl: null, phone: null },
  { id: '527e28b9-bb16-4af0-a30f-82abfb746347', treeId: '', firstName: 'Mukarram', lastName: null,           middleName: null, maidenName: null, gender: 'female', birthDate: null, birthYear: null, birthDateKnown: false, isAlive: true,  deathDate: null, deathYear: null, deathDateKnown: false, verified: false, note: null, photoUrl: null, phone: null },
];

const relationships: Relationship[] = [
  { id: 'r1',  treeId: '', category: 'parent_child', person1Id: '333430e0-8ce1-4955-836a-29b44f370f94', person2Id: 'b67dbb45-3d26-436a-9a15-ad96f635c26e', coupleStatus: null,         childRelation: 'biological', startDate: null, endDate: null },
  { id: 'r2',  treeId: '', category: 'parent_child', person1Id: '66701e1b-2e7e-4096-8302-89996e3089ad', person2Id: 'b67dbb45-3d26-436a-9a15-ad96f635c26e', coupleStatus: null,         childRelation: 'biological', startDate: null, endDate: null },
  { id: 'r3',  treeId: '', category: 'couple',       person1Id: '66701e1b-2e7e-4096-8302-89996e3089ad', person2Id: '333430e0-8ce1-4955-836a-29b44f370f94', coupleStatus: 'married',    childRelation: null,         startDate: null, endDate: null },
  { id: 'r4',  treeId: '', category: 'parent_child', person1Id: '333430e0-8ce1-4955-836a-29b44f370f94', person2Id: 'a29a5c76-469b-4211-9dfe-41edf3aadc57', coupleStatus: null,         childRelation: 'biological', startDate: null, endDate: null },
  { id: 'r5',  treeId: '', category: 'parent_child', person1Id: '66701e1b-2e7e-4096-8302-89996e3089ad', person2Id: 'a29a5c76-469b-4211-9dfe-41edf3aadc57', coupleStatus: null,         childRelation: 'biological', startDate: null, endDate: null },
  { id: 'r6',  treeId: '', category: 'parent_child', person1Id: 'b67dbb45-3d26-436a-9a15-ad96f635c26e', person2Id: '9e7b2f72-09ca-49f9-9d01-135f94b5a428', coupleStatus: null,         childRelation: 'biological', startDate: null, endDate: null },
  { id: 'r7',  treeId: '', category: 'couple',       person1Id: 'cc39f690-ee76-4e24-a287-4203036c1f01', person2Id: 'b67dbb45-3d26-436a-9a15-ad96f635c26e', coupleStatus: 'married',    childRelation: null,         startDate: null, endDate: null },
  { id: 'r8',  treeId: '', category: 'parent_child', person1Id: 'cc39f690-ee76-4e24-a287-4203036c1f01', person2Id: '9e7b2f72-09ca-49f9-9d01-135f94b5a428', coupleStatus: null,         childRelation: 'biological', startDate: null, endDate: null },
  { id: 'r9',  treeId: '', category: 'parent_child', person1Id: '1d161129-dbdf-450c-b5ba-c4341e4b485e', person2Id: 'cc39f690-ee76-4e24-a287-4203036c1f01', coupleStatus: null,         childRelation: 'biological', startDate: null, endDate: null },
  { id: 'r10', treeId: '', category: 'parent_child', person1Id: '527e28b9-bb16-4af0-a30f-82abfb746347', person2Id: 'cc39f690-ee76-4e24-a287-4203036c1f01', coupleStatus: null,         childRelation: 'biological', startDate: null, endDate: null },
  { id: 'r11', treeId: '', category: 'couple',       person1Id: '527e28b9-bb16-4af0-a30f-82abfb746347', person2Id: '1d161129-dbdf-450c-b5ba-c4341e4b485e', coupleStatus: 'married',    childRelation: null,         startDate: null, endDate: null },
];

const ownerId = 'b67dbb45-3d26-436a-9a15-ad96f635c26e'; // Baxodir
const nameById = new Map(persons.map((p) => [p.id, p.firstName]));

const nodes = transformToTreeNodes(persons, relationships, ownerId);
console.log('=== TreeNodes (input to calcTree) ===');
for (const n of nodes) {
  console.log(
    `${nameById.get(n.id)?.padEnd(10)} parents=${n.parents.map((p) => nameById.get(p.id)).join(',') || '—'}` +
    ` spouses=${n.spouses.map((s) => nameById.get(s.id)).join(',') || '—'}` +
    ` children=${n.children.map((c) => nameById.get(c.id)).join(',') || '—'}` +
    ` siblings=${n.siblings.map((s) => nameById.get(s.id)).join(',') || '—'}`
  );
}

for (const placeholders of [true, false] as const) {
  console.log(`\n=== calcTree({rootId: Baxodir, placeholders: ${placeholders}}) ===`);
  const layout = calcTree(nodes as any, { rootId: ownerId, placeholders });
  console.log(`canvas: ${layout.canvas.width} × ${layout.canvas.height} half-units`);
  console.log(`nodes: ${layout.nodes.length}`);
  for (const n of layout.nodes) {
    const name = nameById.get(n.id) ?? `phantom(${n.id.slice(0, 6)})`;
    console.log(`  (${String(n.left).padStart(2)},${String(n.top).padStart(2)})  ${name}`);
  }
  console.log(`connectors: ${layout.connectors.length}`);
}
