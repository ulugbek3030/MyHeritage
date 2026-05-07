import type { Person, Relationship } from '../types';

export interface TreeNode {
  id: string;
  gender: 'male' | 'female';
  parents: { id: string; type: 'blood' | 'adopted' | 'half' }[];
  children: { id: string; type: 'blood' | 'adopted' | 'half' }[];
  siblings: { id: string; type: 'blood' | 'half' }[];
  spouses: { id: string; type: 'married' | 'divorced' }[];
}

export const transformToTreeNodes = (persons: Person[], rels: Relationship[]): TreeNode[] => {
  const byId: Record<string, TreeNode> = {};
  for (const p of persons) byId[p.id] = { id: p.id, gender: p.gender, parents: [], children: [], siblings: [], spouses: [] };

  const addUnique = <T extends { id: string }>(arr: T[], v: T) => { if (!arr.some((x) => x.id === v.id)) arr.push(v); };

  for (const r of rels) {
    if (r.category === 'couple') {
      const t = r.coupleStatus === 'divorced' ? 'divorced' : 'married';
      if (byId[r.person1Id] && byId[r.person2Id]) {
        addUnique(byId[r.person1Id].spouses, { id: r.person2Id, type: t });
        addUnique(byId[r.person2Id].spouses, { id: r.person1Id, type: t });
      }
    } else if (r.category === 'parent_child') {
      const cr = r.childRelation;
      const type: 'blood' | 'adopted' | 'half' = cr === 'biological' ? 'blood' : cr === 'stepchild' ? 'half' : 'adopted';
      const parent = byId[r.person1Id], child = byId[r.person2Id];
      if (parent && child) {
        addUnique(parent.children, { id: child.id, type });
        addUnique(child.parents, { id: parent.id, type });
      }
    }
  }

  // Compute siblings via shared parents
  for (const node of Object.values(byId)) {
    for (const parent of node.parents) {
      const p = byId[parent.id];
      if (!p) continue;
      for (const sib of p.children) {
        if (sib.id === node.id) continue;
        const sibNode = byId[sib.id];
        const sharedCount = sibNode.parents.filter((sp) => node.parents.some((np) => np.id === sp.id)).length;
        const t: 'blood' | 'half' = sharedCount >= 2 ? 'blood' : 'half';
        addUnique(node.siblings, { id: sib.id, type: t });
      }
    }
  }

  return Object.values(byId);
};
