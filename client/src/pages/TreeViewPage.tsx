import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import calcTree from 'relatives-tree';
import * as treesApi from '../api/trees';
import * as personsApi from '../api/persons';
import type { FullTree, Person } from '../types';
import TreeHeader from '../components/tree/TreeHeader';
import FamilyTreeLayout from '../components/tree/FamilyTreeLayout';
import { transformToTreeNodes } from '../utils/treeTransform';

import PersonInfoPopup from '../components/tree/PersonInfoPopup';
import AddPersonForm from '../components/tree/AddPersonForm';
import type { AddPersonFormData } from '../components/tree/AddPersonForm';
import EditPersonForm from '../components/tree/EditPersonForm';
import type { CreatePersonData } from '../api/persons';
import ConfirmDeleteDialog from '../components/tree/ConfirmDeleteDialog';
import ZoomControls from '../components/tree/ZoomControls';
import { useZoom } from '../hooks/useZoom';
import '../styles/tree-view.css';

export default function TreeViewPage() {
  const { treeId } = useParams<{ treeId: string }>();
  const [fullTree, setFullTree] = useState<FullTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [addTarget, setAddTarget] = useState<Person | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [saving, setSaving] = useState(false);

  // Ref to detect drag vs click
  const dragMoved = useRef(false);

  // Load tree data
  const loadTree = useCallback(() => {
    if (!treeId) return;
    treesApi
      .getFullTree(treeId)
      .then(setFullTree)
      .catch((err) => setError(err.response?.data?.error || 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, [treeId]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  // Zoom hook (react-zoom-pan-pinch)
  const { zoomIn, zoomOut, setTransformRef, transformRef } = useZoom();

  // Center on owner person (used on init + reset button)
  const centerOnOwner = useCallback((ref: ReactZoomPanPinchRef, animationTime = 0) => {
    if (!fullTree) return;
    const ownerId = fullTree.tree.ownerPersonId;
    if (!ownerId) return;

    const wrapper = ref.instance.wrapperComponent;
    const content = ref.instance.contentComponent;
    if (!wrapper || !content) return;

    const ownerEl = content.querySelector(
      `[data-person-id="${ownerId}"]`
    ) as HTMLElement | null;
    if (!ownerEl) return;

    // Reset scale to 1 first, then calculate position
    // Use the natural (unscaled) position of the owner element
    const currentScale = ref.state.scale;
    const contentRect = content.getBoundingClientRect();
    const ownerRect = ownerEl.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();

    // Get unscaled center of owner relative to content
    const ownerCenterX = ((ownerRect.left + ownerRect.right) / 2 - contentRect.left) / currentScale;
    const ownerCenterY = ((ownerRect.top + ownerRect.bottom) / 2 - contentRect.top) / currentScale;

    const offsetX = wrapperRect.width / 2 - ownerCenterX;
    const offsetY = wrapperRect.height / 2 - ownerCenterY;

    ref.setTransform(offsetX, offsetY, 1, animationTime);
  }, [fullTree]);

  // Handle library init
  const handleInit = useCallback((ref: ReactZoomPanPinchRef) => {
    setTransformRef(ref);
    // Center on owner after a short delay for layout to settle
    setTimeout(() => centerOnOwner(ref, 0), 150);
  }, [setTransformRef, centerOnOwner]);

  // Reset zoom + center on owner
  const handleZoomReset = useCallback(() => {
    const ref = transformRef.current;
    if (!ref) return;
    centerOnOwner(ref, 300);
  }, [centerOnOwner, transformRef]);

  // Track panning to distinguish drag from click
  const handlePanningStart = useCallback(() => {
    dragMoved.current = false;
  }, []);

  const handlePanning = useCallback(() => {
    dragMoved.current = true;
  }, []);

  // Card click handler
  const handleCardClick = useCallback((person: Person) => {
    if (dragMoved.current) return;
    setSelectedPerson(person);
  }, []);

  const handleAddClick = useCallback((person: Person) => {
    setAddTarget(person);
  }, []);

  const handleAddSubmit = useCallback(async (data: AddPersonFormData) => {
    if (!treeId || !addTarget) return;
    setSaving(true);

    try {
      const relationships: personsApi.CreatePersonData['relationships'] = [];

      if (data.relType === 'child') {
        relationships.push({
          category: 'parent_child',
          relatedPersonId: addTarget.id,
          childRelation: data.childRelation || 'biological',
        });
        if (data.secondParentId && data.secondParentId !== '__none__' && data.secondParentId !== '__new__') {
          relationships.push({
            category: 'parent_child',
            relatedPersonId: data.secondParentId,
            childRelation: data.childRelation || 'biological',
          });
        }
      } else if (data.relType === 'pair') {
        relationships.push({
          category: 'couple',
          relatedPersonId: addTarget.id,
          coupleStatus: data.coupleStatus || 'married',
        });
      } else if (data.relType === 'father' || data.relType === 'mother') {
        // handled after creation (need newPerson.id for parent_child + auto-couple)
      } else if (data.relType === 'sibling') {
        // Use selected parent IDs from the form (user can uncheck parents for half-siblings)
        for (const parentId of data.siblingParentIds) {
          relationships.push({
            category: 'parent_child',
            relatedPersonId: parentId,
            childRelation: data.childRelation || 'biological',
          });
        }
      }

      const newPerson = await personsApi.createPerson(treeId, {
        firstName: data.firstName,
        lastName: data.lastName || null,
        middleName: data.middleName || null,
        maidenName: data.maidenName || null,
        gender: data.gender,
        birthDate: data.birthDate,
        birthYear: data.birthYear,
        birthDateKnown: data.birthDateKnown,
        isAlive: data.isAlive,
        deathDate: data.deathDate,
        deathYear: data.deathYear,
        deathDateKnown: data.deathDateKnown,
        note: data.note || null,
        relationships: (data.relType !== 'father' && data.relType !== 'mother') ? relationships : undefined,
      });

      if (data.relType === 'father' || data.relType === 'mother') {
        // 1. Create parent_child: new person (parent) → addTarget (child)
        await personsApi.createRelationship(treeId, {
          category: 'parent_child',
          person1Id: newPerson.id,
          person2Id: addTarget.id,
          childRelation: 'biological',
        });

        // 2. Auto-couple: if child already has a parent of the OPPOSITE gender, link them as married
        const otherGender = data.relType === 'father' ? 'female' : 'male';
        const existingParentRels = fullTree!.relationships.filter(
          (r) => r.category === 'parent_child' && r.person2Id === addTarget.id
        );
        for (const rel of existingParentRels) {
          const otherParent = fullTree!.persons.find(
            (p) => p.id === rel.person1Id && p.gender === otherGender
          );
          if (otherParent) {
            // Guard against duplicate couple relationship
            const alreadyCoupled = fullTree!.relationships.some(
              (r) =>
                r.category === 'couple' &&
                ((r.person1Id === newPerson.id && r.person2Id === otherParent.id) ||
                 (r.person1Id === otherParent.id && r.person2Id === newPerson.id))
            );
            if (!alreadyCoupled) {
              await personsApi.createRelationship(treeId, {
                category: 'couple',
                person1Id: newPerson.id,
                person2Id: otherParent.id,
                coupleStatus: 'married',
              });
            }
            break; // Link to first matching opposite-gender parent
          }
        }
      }

      // Upload photo if provided
      if (data.photoFile) {
        try {
          await personsApi.uploadPersonPhoto(treeId, newPerson.id, data.photoFile);
        } catch {
          console.warn('Photo upload failed, skipping');
        }
      }

      setAddTarget(null);
      loadTree();
    } catch (err: any) {
      console.error('Failed to add person:', err);
      alert(err.response?.data?.error || 'Ошибка при добавлении');
    } finally {
      setSaving(false);
    }
  }, [treeId, addTarget, fullTree, loadTree]);

  const handleDeleteClick = useCallback((person: Person) => {
    setSelectedPerson(null);
    setDeleteTarget(person);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!treeId || !deleteTarget) return;
    try {
      await personsApi.deletePerson(treeId, deleteTarget.id);
      setDeleteTarget(null);
      loadTree();
    } catch (err: any) {
      console.error('Failed to delete person:', err);
      alert(err.response?.data?.error || 'Ошибка при удалении');
    }
  }, [treeId, deleteTarget, loadTree]);

  // Edit person
  const handleEditClick = useCallback((person: Person) => {
    setSelectedPerson(null);
    setEditingPerson(person);
  }, []);

  const handleEditSubmit = useCallback(async (data: Partial<CreatePersonData>, photoFile?: File) => {
    if (!treeId || !editingPerson) return;
    setSaving(true);

    try {
      await personsApi.updatePerson(treeId, editingPerson.id, data);

      if (photoFile) {
        await personsApi.uploadPersonPhoto(treeId, editingPerson.id, photoFile);
      }

      setEditingPerson(null);
      loadTree();
    } catch (err: any) {
      console.error('Failed to update person:', err);
      alert(err.response?.data?.error || 'Ошибка при обновлении');
    } finally {
      setSaving(false);
    }
  }, [treeId, editingPerson, loadTree]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (error || !fullTree) {
    return (
      <div className="error-screen">
        <p>{error || 'Дерево не найдено'}</p>
        <Link to="/">Назад</Link>
      </div>
    );
  }

  const ownerPerson = fullTree.persons.find(
    (p) => p.id === fullTree.tree.ownerPersonId
  );

  // Root for relatives-tree: find the rootId that includes the most nodes.
  // relatives-tree's internal traversal doesn't follow spouse→parents paths,
  // so using owner as root may miss uncles/aunts (siblings of parents).
  // Using a topmost ancestor as root may miss the other family line.
  // Solution: try all root-level ancestors (persons with no parents) + owner,
  // and pick the rootId that gives the maximum node coverage.
  const rootId = useMemo(() => {
    const ownerId = fullTree.tree.ownerPersonId || fullTree.persons[0]?.id;
    if (!ownerId || fullTree.persons.length === 0) return ownerId || '';

    // Find persons who have no parents (root ancestors)
    const hasParent = new Set<string>();
    for (const rel of fullTree.relationships) {
      if (rel.category === 'parent_child') {
        hasParent.add(rel.person2Id);
      }
    }
    const rootCandidates = fullTree.persons
      .filter(p => !hasParent.has(p.id))
      .map(p => p.id);

    // Always include owner as a candidate
    if (!rootCandidates.includes(ownerId)) {
      rootCandidates.push(ownerId);
    }

    // If only one candidate, use it
    if (rootCandidates.length <= 1) {
      return rootCandidates[0] || ownerId;
    }

    // Try each candidate and pick the one that covers most persons
    const nodes = transformToTreeNodes(fullTree.persons, fullTree.relationships);
    let bestRoot = ownerId;
    let bestCount = 0;

    for (const candidateId of rootCandidates) {
      try {
        const result = calcTree(nodes as any, { rootId: candidateId });
        if (result.nodes.length > bestCount) {
          bestCount = result.nodes.length;
          bestRoot = candidateId;
        }
        // If we found a root that covers everyone, stop searching
        if (bestCount === fullTree.persons.length) break;
      } catch {
        // Skip invalid roots
      }
    }

    return bestRoot;
  }, [fullTree]);

  return (
    <div className="tree-page">
      <TreeHeader fullTree={fullTree} ownerPerson={ownerPerson} />

      <div className="tree-viewport">
        <TransformWrapper
          initialScale={1}
          minScale={0.3}
          maxScale={2.5}
          centerOnInit={false}
          limitToBounds={false}
          panning={{ velocityDisabled: false }}
          pinch={{ step: 5 }}
          doubleClick={{ disabled: true }}
          onInit={handleInit}
          onPanningStart={handlePanningStart}
          onPanning={handlePanning}
        >
          <TransformComponent
            wrapperStyle={{
              width: '100%',
              height: '100%',
            }}
            contentStyle={{
              width: 'fit-content',
              height: 'fit-content',
            }}
          >
            <div className="tree-container">
              <FamilyTreeLayout
                persons={fullTree.persons}
                relationships={fullTree.relationships}
                rootId={rootId}
                ownerPersonId={fullTree.tree.ownerPersonId}
                onCardClick={handleCardClick}
                onAddClick={handleAddClick}
              />
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>

      <ZoomControls
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={handleZoomReset}
      />

      {selectedPerson && (
        <PersonInfoPopup
          person={selectedPerson}
          onClose={() => setSelectedPerson(null)}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteDialog
          person={deleteTarget}
          allPersons={fullTree.persons}
          relationships={fullTree.relationships}
          ownerPersonId={fullTree.tree.ownerPersonId}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {addTarget && (
        <AddPersonForm
          targetPerson={addTarget}
          persons={fullTree.persons}
          relationships={fullTree.relationships}
          saving={saving}
          onSubmit={handleAddSubmit}
          onClose={() => setAddTarget(null)}
        />
      )}

      {editingPerson && treeId && (
        <EditPersonForm
          person={editingPerson}
          treeId={treeId}
          saving={saving}
          onSubmit={handleEditSubmit}
          onClose={() => setEditingPerson(null)}
        />
      )}
    </div>
  );
}
