export const FAB = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    aria-label="Добавить родственника"
    style={{
      position: 'fixed',
      // 18px (page padding) + 102px (QA row height ≈ 90px + 12 margin) = 120 — sits ABOVE QuickActions
      bottom: 120,
      right: 18,
      width: 56,
      height: 56,
      background: 'linear-gradient(135deg,var(--accent),var(--accent-hover))',
      borderRadius: 18,
      border: 'none',
      fontSize: 26,
      fontWeight: 800,
      color: '#0a0a0d',
      boxShadow: '0 8px 24px rgba(251,191,36,0.4), 0 0 40px rgba(251,191,36,0.15)',
      cursor: 'pointer',
      zIndex: 20,
    }}
  >+</button>
);
