export const Skeleton = ({ width = '100%', height = 20, radius = 8 }: { width?: number | string; height?: number | string; radius?: number }) => (
  <div style={{width,height,background:'linear-gradient(90deg,rgba(255,255,255,0.04),rgba(255,255,255,0.08),rgba(255,255,255,0.04))',backgroundSize:'200% 100%',borderRadius:radius,animation:'shimmer 1.4s ease-in-out infinite'}}>
    <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
  </div>
);
