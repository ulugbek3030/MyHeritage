import type { Person } from '../../types';
import { BottomSheet } from '../ui/BottomSheet';
import { formatBirthFull, formatDeathFull } from '../../utils/dateFormat';

// Avatar sized at 25% larger than the previous 120px hero.
const AVATAR = 150;

interface Props {
  open: boolean;
  onClose: () => void;
  person: Person | null;
  upcomingBirthdayInDays?: number | null;
  onEdit: () => void;
  onAdd: () => void;
  onDelete: () => void;
  onEditBio?: () => void;
}

export const PersonSheet = ({ open, onClose, person, upcomingBirthdayInDays, onEdit, onAdd, onDelete, onEditBio }: Props) => {
  if (!person) return null;
  const fullName = [person.firstName, person.lastName, person.middleName].filter(Boolean).join(' ');
  const showCta = person.isAlive && typeof upcomingBirthdayInDays === 'number' && upcomingBirthdayInDays >= 0 && upcomingBirthdayInDays <= 14;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <button
          onClick={onClose}
          type="button"
          aria-label="Назад"
          style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text)', fontSize: 18, cursor: 'pointer' }}
        >
          ←
        </button>
      </div>
      {/* Centered hero: avatar + name + birth date — no field labels. */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 24 }}>
        <div style={{ width: AVATAR, height: AVATAR, borderRadius: '50%', background: person.gender === 'female' ? 'linear-gradient(135deg,#fce7f3,#f9c8dd)' : 'linear-gradient(135deg,#dbeafe,#c3d9f7)', color: person.gender === 'female' ? '#e87ba8' : '#4a90d9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56, fontWeight: 800, border: `2px solid ${person.gender === 'female' ? 'rgba(244,114,182,0.4)' : 'rgba(96,165,250,0.4)'}`, overflow: 'hidden', marginBottom: 16 }}>
          {person.photoUrl ? <img src={person.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : person.firstName?.[0]}
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.25 }}>{fullName}</div>
        {(person.birthDateKnown && person.birthDate) || person.birthYear ? (
          <div style={{ fontSize: 19, color: 'var(--text-muted)', marginTop: 8, fontFeatureSettings: "'tnum' 1" }}>
            {person.birthDateKnown && person.birthDate ? formatBirthFull(person) : `${person.birthYear} г.`}
            {!person.isAlive && (person.deathDateKnown && person.deathDate ? ` — ${formatDeathFull(person)}` : person.deathYear ? ` — ${person.deathYear} г.` : '')}
          </div>
        ) : null}
      </div>

      {/* Other details — centered values, no labels. */}
      {(() => {
        const yr = new Date().getUTCFullYear();
        const age = person.isAlive && person.birthYear ? yr - person.birthYear
          : !person.isAlive && person.birthYear && person.deathYear ? person.deathYear - person.birthYear
          : null;
        const items: Array<string | null> = [
          age !== null ? `${age} ${age % 10 === 1 && age % 100 !== 11 ? 'год' : age % 10 >= 2 && age % 10 <= 4 && (age % 100 < 10 || age % 100 >= 20) ? 'года' : 'лет'}${person.isAlive ? '' : ' (на момент смерти)'}` : null,
          person.gender === 'male' ? 'Мужской' : 'Женский',
          // Status line only for the deceased — for living people the birth
          // date in the hero already says everything ("Жив" added no info).
          !person.isAlive ? (person.gender === 'female' ? 'Умерла' : 'Умер') : null,
          person.gender === 'female' && person.maidenName ? `Девичья: ${person.maidenName}` : null,
          person.note ?? null,
        ].filter((x) => x && String(x).trim() !== '');
        if (items.length === 0) return null;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 24, padding: '18px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
            {items.map((v, i) => (
              <div key={i} style={{ fontSize: 19, fontWeight: 600, textAlign: 'center' }}>{v}</div>
            ))}
          </div>
        );
      })()}

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

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
        <button onClick={onEdit} style={{padding:16,background:'rgba(255,255,255,0.04)',border:'1px solid var(--border)',borderRadius:14,color:'var(--text)',fontWeight:700,fontSize:16}}>Редактировать</button>
        <button onClick={onAdd} style={{padding:16,background:'linear-gradient(135deg,var(--accent),var(--accent-hover))',color:'#0a0a0d',border:'none',borderRadius:14,fontWeight:800,fontSize:16}}>+ Родственник</button>
      </div>
      {onEditBio && (
        <button onClick={onEditBio} style={{width:'100%',padding:14,background:'rgba(255,255,255,0.04)',border:'1px solid var(--border)',borderRadius:14,color:'var(--text)',fontSize:15,fontWeight:700,marginBottom:10}}>📝 Биография</button>
      )}
      <button onClick={onDelete} style={{width:'100%',padding:14,background:'transparent',border:'1px solid rgba(248,113,113,0.3)',borderRadius:14,color:'#f87171',fontSize:15}}>Удалить</button>
    </BottomSheet>
  );
};
