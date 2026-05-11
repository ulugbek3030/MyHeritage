import { useState, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { enableShare, updateShareSettings, type ShareSettings } from '../../api/share';
import QRCode from 'qrcode';
import { exportTreeAsPng, downloadBlob } from '../../utils/treeExport';

interface Props { open: boolean; onClose: () => void; treeId: string; existingToken?: string | null; existingSettings?: Partial<ShareSettings>; }

export const ShareModal = ({ open, onClose, treeId, existingToken, existingSettings }: Props) => {
  const [token, setToken] = useState<string | null>(existingToken ?? null);
  const [settings, setSettings] = useState<ShareSettings>({ showBirthDates: existingSettings?.showBirthDates ?? true, showPhotos: existingSettings?.showPhotos ?? true, allowSuggestions: existingSettings?.allowSuggestions ?? false });
  const [busy, setBusy] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgBusy, setImgBusy] = useState(false);

  useEffect(() => {
    if (open && !token) { setBusy(true); enableShare(treeId, settings).then((r) => setToken(r.token)).finally(() => setBusy(false)); }
  }, [open]);

  const url = token ? `${window.location.origin}/share/${token}` : '';
  const copy = () => { navigator.clipboard?.writeText(url); };

  useEffect(() => { if (url) QRCode.toDataURL(url, { color: { dark: '#0a0a0d', light: '#ffffff' }, width: 240 }).then(setQrDataUrl); }, [url]);

  const onImageExport = async () => {
    const tree = document.querySelector('.tree-stage') as HTMLElement | null;
    if (!tree) { alert('Откройте дерево перед экспортом'); return; }
    setImgBusy(true);
    try {
      const blob = await exportTreeAsPng(tree);
      // Show in a preview overlay; user picks "Скачать" or just closes.
      if (imgUrl) URL.revokeObjectURL(imgUrl);
      setImgUrl(URL.createObjectURL(blob));
    } finally {
      setImgBusy(false);
    }
  };

  const onImageDownload = async () => {
    if (!imgUrl) return;
    const blob = await fetch(imgUrl).then((r) => r.blob());
    downloadBlob(blob, 'family-tree.png');
  };

  const toggleSetting = (k: keyof ShareSettings) => {
    const next = { ...settings, [k]: !settings[k] };
    setSettings(next);
    updateShareSettings(treeId, { [k]: next[k] });
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
        <button onClick={onClose} type="button" aria-label="Назад" style={{width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,0.06)',border:'none',color:'var(--text)',fontSize:18,cursor:'pointer'}}>←</button>
        <div style={{flex:1,fontSize:18,fontWeight:800}}>Поделиться семьёй</div>
      </div>
      <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:14,lineHeight:1.4}}>Получатель увидит дерево <b>read-only</b>. Слияния деревьев нет — у каждого пользователя своё.</div>

      <div style={{padding:10,background:'linear-gradient(135deg,rgba(251,191,36,0.08),rgba(245,158,11,0.02))',border:'1px solid rgba(251,191,36,0.2)',borderRadius:12,display:'flex',gap:10,alignItems:'center',marginBottom:14}}>
        <div style={{width:32,height:32,borderRadius:9,background:'linear-gradient(135deg,var(--accent),var(--accent-hover))',color:'#0a0a0d',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:800}}>🔗</div>
        <div style={{flex:1,minWidth:0,fontFamily:'monospace',fontSize:11,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{busy ? 'Генерация…' : url}</div>
        <button onClick={copy} disabled={busy} style={{background:'rgba(255,255,255,0.08)',color:'var(--text)',border:'1px solid var(--border)',fontSize:10,fontWeight:700,padding:'6px 10px',borderRadius:8}}>Копировать</button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
        <button onClick={() => setShowQr(!showQr)} style={{padding:10,background:'rgba(255,255,255,0.04)',border:'1px solid var(--border)',borderRadius:12,color:'var(--text)',fontSize:11,fontWeight:700,textAlign:'left'}}>
          <div style={{fontSize:18,marginBottom:4}}>⊞</div>QR-код
        </button>
        <button onClick={onImageExport} disabled={imgBusy} style={{padding:10,background:'rgba(255,255,255,0.04)',border:'1px solid var(--border)',borderRadius:12,color:'var(--text)',fontSize:11,fontWeight:700,textAlign:'left'}}>
          <div style={{fontSize:18,marginBottom:4}}>🖼</div>{imgBusy ? 'Готовим…' : 'Показать как картинку'}
        </button>
      </div>

      {imgUrl && (
        <div onClick={() => setImgUrl(null)} style={{position:'fixed',inset:0,zIndex:60,background:'rgba(0,0,0,0.85)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:16}}>
          <div onClick={(e) => e.stopPropagation()} style={{maxWidth:'95vw',maxHeight:'85vh',overflow:'auto',background:'#fff',borderRadius:14,padding:8,marginBottom:14}}>
            <img src={imgUrl} alt="Family tree" style={{display:'block',maxWidth:'100%',height:'auto'}} />
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={onImageDownload} style={{padding:'12px 22px',background:'linear-gradient(135deg,var(--accent),var(--accent-hover))',color:'#0a0a0d',border:'none',borderRadius:14,fontSize:15,fontWeight:800}}>Скачать</button>
            <button onClick={() => setImgUrl(null)} style={{padding:'12px 22px',background:'rgba(255,255,255,0.1)',color:'var(--text)',border:'1px solid var(--border)',borderRadius:14,fontSize:15,fontWeight:700}}>Закрыть</button>
          </div>
        </div>
      )}
      {showQr && qrDataUrl && (
        <div style={{padding:14,background:'#fff',borderRadius:14,marginBottom:12,textAlign:'center'}}>
          <img src={qrDataUrl} alt="QR" style={{maxWidth:200}} />
          <div style={{fontSize:10,color:'#0a0a0d',marginTop:6,fontWeight:700}}>Покажите бабушке с экрана</div>
        </div>
      )}

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
