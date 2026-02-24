import { Link } from 'react-router-dom';
import type { Person, FullTree } from '../../types';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

const TreeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

interface TreeHeaderProps {
  fullTree: FullTree;
  ownerPerson: Person | undefined;
}

export default function TreeHeader({ fullTree, ownerPerson }: TreeHeaderProps) {
  const photoSrc = ownerPerson?.photoUrl
    ? (ownerPerson.photoUrl.startsWith('http') ? ownerPerson.photoUrl : `${API_BASE}${ownerPerson.photoUrl}`)
    : null;

  const ownerName = ownerPerson
    ? [ownerPerson.firstName, ownerPerson.lastName].filter(Boolean).join(' ')
    : fullTree.tree.name;

  return (
    <header className="tree-header">
      <div className="tree-header-inner">
        <div className="tree-header-left">
          <Link to="/" className="tree-header-back">&larr;</Link>
          <div className="tree-header-icon">
            {photoSrc ? (
              <img src={photoSrc} alt={ownerPerson?.firstName} />
            ) : (
              <TreeIcon />
            )}
          </div>
          <div className="tree-header-info">
            <div className="tree-header-title">Семейное Древо <span style={{color:'#ff4444',fontSize:'12px',fontWeight:700}}>v10</span></div>
            <div className="tree-header-subtitle">{ownerName}</div>
          </div>
        </div>

        <div className="tree-header-stats">
          <div className="tree-stat">
            <div className="tree-stat-num">{fullTree.persons.length}</div>
            <div className="tree-stat-label">Членов</div>
          </div>
          <div className="tree-stat">
            <div className="tree-stat-num">{fullTree.generations.length}</div>
            <div className="tree-stat-label">Поколения</div>
          </div>
        </div>
      </div>
    </header>
  );
}
