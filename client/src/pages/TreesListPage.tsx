import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as treesApi from '../api/trees';
import OnboardingForm from '../components/OnboardingForm';
import type { Tree } from '../types';
import '../styles/trees-list.css';

export default function TreesListPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tree, setTree] = useState<Tree | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    treesApi.listTrees()
      .then((trees) => {
        if (trees.length > 0) {
          setTree(trees[0]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

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
          <span className="user-name">{user?.phone}</span>
          <button className="btn-logout" onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </header>

      <main className="trees-content">
        {tree ? (
          /* Tree exists — show card */
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
        ) : (
          /* No tree — show onboarding form */
          <OnboardingForm onComplete={(treeId) => navigate(`/trees/${treeId}`, { replace: true })} />
        )}
      </main>
    </div>
  );
}
