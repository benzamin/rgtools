import { createContext } from 'preact';
import { useContext, useRef, useState } from 'preact/hooks';

const AlertContext = createContext(null);

export function AlertProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [popup, setPopup] = useState(null);
  const nextIdRef = useRef(0);

  const notify = (message, duration = 3000) => {
    const id = ++nextIdRef.current;
    setNotifications((current) => [...current, { id, message }]);
    window.setTimeout(() => {
      setNotifications((current) => current.filter((notification) => notification.id !== id));
    }, duration);
  };

  const showAlert = (message, title = 'Notice') => setPopup({ message, title });

  return (
    <AlertContext.Provider value={{ notify, showAlert }}>
      {children}
      <div className="alert-notifications" aria-live="polite" aria-atomic="true">
        {notifications.map((notification) => <div className="alert-notification" key={notification.id}>{notification.message}</div>)}
      </div>
      {popup && (
        <div className="alert-backdrop" role="presentation">
          <div className="alert-popup" role="alertdialog" aria-modal="true" aria-labelledby="alert-title">
            <h2 id="alert-title">{popup.title}</h2>
            <p>{popup.message}</p>
            <button onClick={() => setPopup(null)}>Close</button>
          </div>
        </div>
      )}
      <style>{`
        .alert-notifications { position: fixed; right: 1rem; bottom: 1rem; z-index: 200; display: grid; gap: 0.5rem; }
        .alert-notification { padding: 0.7rem 0.9rem; border: 1px solid var(--border); border-radius: 4px; background: var(--surface); color: var(--foreground); box-shadow: 0 8px 20px var(--shadow); animation: alert-notification-in 0.15s ease-out; }
        .alert-backdrop { position: fixed; inset: 0; z-index: 210; display: grid; place-items: center; padding: 1rem; background: rgba(0, 0, 0, 0.45); }
        .alert-popup { width: min(100%, 360px); padding: 1rem; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--foreground); box-shadow: 0 16px 36px var(--shadow); }
        .alert-popup h2, .alert-popup p { margin: 0 0 0.75rem; }
        .alert-popup h2 { font-size: 1.1rem; }
        .alert-popup button { display: block; margin-left: auto; padding: 0.35rem 0.65rem; border: 1px solid var(--border); border-radius: 4px; background: var(--muted); color: var(--foreground); cursor: pointer; }
        @keyframes alert-notification-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </AlertContext.Provider>
  );
}

export function useAlerts() {
  const alerts = useContext(AlertContext);
  if (!alerts) throw new Error('useAlerts must be used inside an AlertProvider.');
  return alerts;
}
