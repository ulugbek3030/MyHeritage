import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getSharedTree } from '../api/share';
import { FamilyTreeLayout } from '../components/tree/FamilyTreeLayout';
import type { FullTree } from '../types';
import type { ShareSettings } from '../api/share';

export const SharedTreePage = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<(FullTree & { settings: ShareSettings }) | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!token) return;
    getSharedTree(token).then(setData).catch((e) => setErr(e.response?.data?.message ?? 'Ссылка недействительна'));
  }, [token]);

  if (err) return <div style={{padding:24,textAlign:'center',color:'var(--text-muted)'}}>{err}</div>;
  if (!data) return <div style={{padding:24}}>Загрузка…</div>;

  return (
    <div style={{minHeight:'calc(100dvh - var(--safe-top, 0px))'}}>
      <header style={{padding:'12px 18px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:12}}>
        <div style={{flex:1,fontSize:15,fontWeight:800}}>{data.tree.name}</div>
        <div style={{fontSize:10,color:'var(--text-muted)'}}>Только просмотр</div>
      </header>
      <div style={{padding:'12px 12px 24px'}}>
        <FamilyTreeLayout persons={data.persons} relationships={data.relationships} ownerId={data.tree.ownerPersonId} />
      </div>
    </div>
  );
};
