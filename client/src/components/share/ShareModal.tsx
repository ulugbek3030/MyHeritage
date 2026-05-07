import { useState, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { enableShare, updateShareSettings, type ShareSettings } from '../../api/share';

interface Props { open: boolean; onClose: () => void; treeId: string; existingToken?: string | null; existingSettings?: Partial<ShareSettings>; }

export const ShareModal = ({ open, onClose, treeId, existingToken, existingSettings }: Props) => {
  const [token, setToken] = useState<string | null>(existingToken ?? null);
  const [settings, setSettings] = useState<ShareSettings>({ showBirthDates: existingSettings?.showBirthDates ?? true, showPhotos: existingSettings?.showPhotos ?? true, allowSuggestions: existingSettings?.allowSuggestions ?? false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && !token) { setBusy(true); enableShare(treeId, settings).then((r) => setToken(r.token)).finally(() => setBusy(false)); }
  }, [open]);

  const url = token ? `${window.location.origin}/share/${token}` : '';
  const copy = () => { navigator.clipboard?.writeText(url); };

  const toggleSetting = (k: keyof ShareSettings) => {
    const next = { ...settings, [k]: !settings[k] };
    setSettings(next);
    updateShareSettings(treeId, { [k]: next[k] });
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{fontSize:18,fontWeight:800,marginBottom:6}}>Поделиться семьёй</div>
      <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:14,lineHeight:1.4}}>Получатель увидит дерево <b>read-only</b>. Слияния деревьев нет — у каждого пользователя своё.</div>

      <div style={{padding:10,background:'linear-gradient(135deg,rgba(251,191,36,0.08),rgba(245,158,11,0.02))',border:'1px solid rgba(251,191,36,0.2)',borderRadius:12,display:'flex',gap:10,alignItems:'center',marginBottom:14}}>
        <div style={{width:32,height:32,borderRadius:9,background:'linear-gradient(135deg,var(--accent),var(--accent-hover))',color:'#0a0a0d',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:800}}>🔗</div>
        <div style={{flex:1,minWidth:0,fontFamily:'monospace',fontSize:11,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{busy ? 'Генерация…' : url}</div>
        <button onClick={copy} disabled={busy} style={{background:'rgba(255,255,255,0.08)',color:'var(--text)',border:'1px solid var(--border)',fontSize:10,fontWeight:700,padding:'6px 10px',borderRadius:8}}>Копировать</button>
      </div>

      <div style={{fontSize:9,textTransform:'uppercase',fontWeight:800,letterSpacing:1.2,color:'var(--text-dim)',margin:'14px 0 8px'}}>Приватность</div>

      {([['showBirthDates','Показывать даты рождения','Возраст и ДР родственников'],['showPhotos','Показывать фото','Аватары родственников'],['allowSuggestions','Можно предлагать правки','Получатель пишет вам комментарий']] as const).map(([k, label, sub]) => (
        <div key={k} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderTop:'1px solid var(--border)'}}>
          <div>
            <div style={{fontSize:11,fontWeight:600}}>{label}</div>
            <div style={{fontSize:9,color:'var(--text-dim)',marginTop:1}}>{sub}</div>
          </div>
          <button onClick={() => toggleSetting(k)} style={{position:'relative',width:36,height:22,borderRadius:11,border:'none',background:settings[k]?'linear-gradient(135deg,var(--accent),var(--accent-hover))':'rgba(255,255,255,0.1)',cursor:'pointer'}}>
            <span style={{position:'absolute',top:2,[settings[k]?'right':'left']:2,width:18,height:18,borderRadius:'50%',background:'#fff',transition:'0.2s'} as any} />
          </button>
        </div>
      ))}
    </BottomSheet>
  );
};
