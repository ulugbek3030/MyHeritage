import type { Person } from '../../types';
import { BottomSheet } from '../ui/BottomSheet';
import { formatBirthFull, formatDeathFull } from '../../utils/dateFormat';

interface Props {
  open: boolean;
  onClose: () => void;
  person: Person | null;
  upcomingBirthdayInDays?: number | null;
  onEdit: () => void;
  onAdd: () => void;
  onDelete: () => void;
}

export const PersonSheet = ({ open, onClose, person, upcomingBirthdayInDays, onEdit, onAdd, onDelete }: Props) => {
  if (!person) return null;
  const fullName = [person.firstName, person.lastName, person.middleName].filter(Boolean).join(' ');
  const lifespan = person.isAlive ? formatBirthFull(person) : `${formatBirthFull(person)} – ${formatDeathFull(person)}`;
  const showCta = person.isAlive && typeof upcomingBirthdayInDays === 'number' && upcomingBirthdayInDays >= 0 && upcomingBirthdayInDays <= 14;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{display:'flex',gap:12,marginBottom:14,alignItems:'flex-start'}}>
        <div style={{width:60,height:60,borderRadius:'50%',background:person.gender==='female'?'linear-gradient(135deg,#fce7f3,#f9c8dd)':'linear-gradient(135deg,#dbeafe,#c3d9f7)',color:person.gender==='female'?'#e87ba8':'#4a90d9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,fontWeight:800,flexShrink:0,border:`2px solid ${person.gender==='female'?'rgba(244,114,182,0.4)':'rgba(96,165,250,0.4)'}`,overflow:'hidden'}}>
          {person.photoUrl ? <img src={person.photoUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} /> : person.firstName?.[0]}
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:18,fontWeight:800,letterSpacing:'-0.02em'}}>{fullName}</div>
          <div style={{fontSize:11,color:'var(--text-muted)',marginTop:3}}>{lifespan}{person.verified && <span style={{marginLeft:8,color:'var(--verified)',fontWeight:700}}>✓ гос-во</span>}</div>
        </div>
      </div>

      {showCta && (
        <div style={{padding:12,marginBottom:14,borderRadius:16,border:'1px solid rgba(251,191,36,0.25)',background:'radial-gradient(140% 100% at 0% 0%,rgba(251,191,36,0.18),transparent 65%),linear-gradient(180deg,#1c1409,#0e0a04)'}}>
          <div style={{fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:1,color:'var(--accent)'}}>Через {upcomingBirthdayInDays} дн</div>
          <div style={{fontSize:14,fontWeight:800,marginBottom:10}}>День рождения</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
            {[['🎂','Торт','от 180k'],['💐','Цветы','от 90k'],['↗','Перевод','любая']].map(([icon,name,price]) => (
              <button key={name} disabled style={{background:'rgba(255,255,255,0.04)',border:'1px solid var(--border)',borderRadius:12,padding:10,color:'var(--text)',fontSize:11,fontWeight:700,cursor:'not-allowed',opacity:0.7}}>
                <div style={{fontSize:18,marginBottom:4}}>{icon}</div>
                {name}
                <div style={{fontSize:9,color:'var(--text-muted)',marginTop:2,fontWeight:500}}>{price}</div>
              </button>
            ))}
          </div>
          <div style={{fontSize:9,color:'var(--text-dim)',textAlign:'center',marginTop:8}}>Платежи появятся в Phase 2</div>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
        <button onClick={onEdit} style={{padding:12,background:'rgba(255,255,255,0.04)',border:'1px solid var(--border)',borderRadius:12,color:'var(--text)',fontWeight:700}}>Редактировать</button>
        <button onClick={onAdd} style={{padding:12,background:'linear-gradient(135deg,var(--accent),var(--accent-hover))',color:'#0a0a0d',border:'none',borderRadius:12,fontWeight:800}}>+ Родственник</button>
      </div>
      <button onClick={onDelete} style={{width:'100%',padding:10,background:'transparent',border:'1px solid rgba(248,113,113,0.3)',borderRadius:12,color:'#f87171',fontSize:12}}>Удалить</button>
    </BottomSheet>
  );
};
