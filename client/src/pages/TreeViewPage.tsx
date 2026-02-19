import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as treesApi from '../api/trees';
import * as personsApi from '../api/persons';
import type { FullTree, Person } from '../types';
import TreeHeader from '../components/tree/TreeHeader';
import FamilyTreeLayout from '../components/tree/FamilyTreeLayout';

import PersonInfoPopup from '../components/tree/PersonInfoPopup';
import AddPersonForm from '../components/tree/AddPersonForm';
import type { AddPersonFormData } from '../components/tree/AddPersonForm';
import ConfirmDeleteDialog from '../components/tree/ConfirmDeleteDialog';
import ZoomControls from '../components/tree/ZoomControls';
import { useZoom } from '../hooks/useZoom';
import { useDrag } from '../hooks/useDrag';
import '../styles/tree-view.css';

export default function TreeViewPage() {
  const { treeId } = useParams<{ treeId: string }>();
  const [fullTree, setFullTree] = useState<FullTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [addTarget, setAddTarget] = useState<Person | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null);
  const [saving, setSaving] = useState(false);

  // Refs for viewport and container
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Zoom hook (no need for drawLines callback — connectors are React-rendered)
  const { zoomIn, zoomOut, zoomReset } = useZoom(containerRef, viewportRef);

  // Drag hook
  const { wasDragged } = useDrag(viewportRef, !!fullTree);

  // Center on owner person after initial load
  const centerOnOwner = useCallback(() => {
    const viewport = viewportRef.current;
    const container = containerRef.current;
    if (!viewport || !container || !fullTree) return;

    const ownerId = fullTree.tree.ownerPersonId;
    if (!ownerId) return;

    const ownerEl = container.querySelector(
      `[data-person-id="${ownerId}"]`
    ) as HTMLElement | null;
    if (!ownerEl) return;

    const r = ownerEl.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    const centerX = (r.left + r.right) / 2 - cRect.left;
    const centerY = (r.top + r.bottom) / 2 - cRect.top;

    viewport.scrollLeft = centerX - viewport.clientWidth / 2;
    viewport.scrollTop = centerY - viewport.clientHeight / 2;
  }, [fullTree]);

  // Center after tree renders
  useEffect(() => {
    if (!fullTree) return;
    // Small delay for React to render the layout
    const timer = setTimeout(() => {
      centerOnOwner();
    }, 100);
    return () => clearTimeout(timer);
  }, [fullTree, centerOnOwner]);

  // Card click handler
  const handleCardClick = useCallback((person: Person) => {
    if (wasDragged()) return;
    setSelectedPerson(person);
  }, [wasDragged]);

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
      } else if (data.relType === 'parent') {
        // handled after creation
      } else if (data.relType === 'sibling') {
        const parentRels = fullTree?.relationships.filter(
          (r) => r.category === 'parent_child' && r.person2Id === addTarget.id
        ) || [];
        for (const rel of parentRels) {
          relationships.push({
            category: 'parent_child',
            relatedPersonId: rel.person1Id,
            childRelation: data.childRelation || 'biological',
          });
        }
      }

      const newPerson = await personsApi.createPerson(treeId, {
        firstName: data.firstName,
        lastName: data.lastName || null,
        middleName: data.middleName || null,
        gender: data.gender,
        birthDate: data.birthDate,
        birthYear: data.birthYear,
        birthDateKnown: data.birthDateKnown,
        isAlive: data.isAlive,
        deathDate: data.deathDate,
        deathYear: data.deathYear,
        deathDateKnown: data.deathDateKnown,
        note: data.note || null,
        relationships: data.relType !== 'parent' ? relationships : undefined,
      });

      if (data.relType === 'parent') {
        await personsApi.createRelationship(treeId, {
          category: 'parent_child',
          person1Id: newPerson.id,
          person2Id: addTarget.id,
          childRelation: 'biological',
        });
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

  // Root for relatives-tree = owner person
  const rootId = fullTree.tree.ownerPersonId || (fullTree.persons[0]?.id ?? '');

  return (
    <div className="tree-page">
      <TreeHeader fullTree={fullTree} ownerPerson={ownerPerson} />

      <div className="tree-viewport" ref={viewportRef}>
        <div className="tree-container" ref={containerRef}>
          <FamilyTreeLayout
            persons={fullTree.persons}
            relationships={fullTree.relationships}
            rootId={rootId}
            ownerPersonId={fullTree.tree.ownerPersonId}
            onCardClick={handleCardClick}
            onAddClick={handleAddClick}
          />
        </div>
      </div>

      <ZoomControls
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={zoomReset}
      />

      {selectedPerson && (
        <PersonInfoPopup
          person={selectedPerson}
          onClose={() => setSelectedPerson(null)}
          onEdit={() => {/* TODO */}}
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
    </div>
  );
}
