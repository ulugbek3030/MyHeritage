import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as treesApi from '../api/trees';
import type { Tree } from '../types';
import '../styles/trees-list.css';

export default function TreesListPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tree, setTree] = useState<Tree | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    treesApi.listTrees()
      .then((trees) => {
        if (trees.length > 0) {
          setTree(trees[0]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await treesApi.createTree(newName.trim(), newDesc.trim() || undefined);
      navigate(`/trees/${created.id}`, { replace: true });
    } catch {
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="trees-page">
      <header className="trees-header">
        <div className="trees-header-left">
          <h1>Моя семья</h1>
        </div>
        <div className="trees-header-right">
          <span className="user-name">{user?.displayName}</span>
          <button className="btn-logout" onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </header>

      <main className="trees-content">
        {tree ? (
          /* Дерево есть — показываем карточку */
          <div className="trees-grid">
            <div className="tree-card">
              <Link to={`/trees/${tree.id}`} className="tree-card-link">
                <div className="tree-card-icon">🌳</div>
                <h3>{tree.name}</h3>
                {tree.description && <p className="tree-card-desc">{tree.description}</p>}
                <div className="tree-card-meta">
                  {tree.personCount !== undefined && (
                    <span>{tree.personCount} чел.</span>
                  )}
                </div>
              </Link>
            </div>
          </div>
        ) : !showCreate ? (
          /* Нет дерева — предлагаем создать */
          <div className="trees-empty">
            <p>У вас пока нет семейного дерева</p>
            <p>Создайте своё первое дерево!</p>
            <button
              className="btn-create-tree"
              onClick={() => setShowCreate(true)}
              style={{ marginTop: 20 }}
            >
              + Создать дерево
            </button>
          </div>
        ) : (
          /* Форма создания дерева */
          <form className="create-tree-form" onSubmit={handleCreate}>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Название дерева"
              autoFocus
              required
            />
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Описание (необязательно)"
            />
            <div className="create-tree-actions">
              <button type="submit" className="btn-primary" disabled={creating}>
                {creating ? 'Создаём...' : 'Создать'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowCreate(false)}
              >
                Отмена
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
