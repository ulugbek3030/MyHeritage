// Full-screen loader overlay shown during data fetches and tree re-renders.
// Sits above the canvas so the user gets explicit feedback that something is
// in flight — without it long calcTree/reload cycles look like the app froze.
import '../../styles/loader.css';

interface Props {
  /** When false, the loader is mounted but invisible; CSS handles fade-in/out
   *  to avoid spinner flashes for sub-100ms work. */
  visible: boolean;
  label?: string;
}

export const Loader = ({ visible, label }: Props) => (
  <div className={`cf-loader-overlay${visible ? ' cf-loader-overlay--on' : ''}`} aria-hidden={!visible}>
    <div className="cf-loader-card">
      <div className="cf-loader-spinner" />
      {label && <div className="cf-loader-label">{label}</div>}
    </div>
  </div>
);
