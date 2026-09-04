// src/components/QrGenerator.jsx
import { useEffect, useRef, useState } from 'preact/hooks';
import QRCode from 'qrcode';

const DEBOUNCE_MS = 500;
const SD_SIZE = 400;
const HD_ERROR_MESSAGE = "Free version does't support HD image download";
const TEMPLATE_DEFINITIONS = {
  Website: { fields: [{ name: 'url', label: 'Website URL', value: 'https://redgreen.studio' }], create: ({ url }) => url },
  'Connect WiFi': { fields: [{ name: 'ssid', label: 'Network name', value: 'RedGreen Wifi' }, { name: 'password', label: 'Password', value: 'Password', type: 'password' }, { name: 'security', label: 'Security', value: 'WPA', type: 'select', options: ['WPA', 'WEP', 'nopass'] }], create: ({ ssid, password, security }) => `WIFI:T:${security};S:${ssid};P:${password};;` },
  'vCard/Contact': { fields: [{ name: 'firstName', label: 'First name', value: 'Jane' }, { name: 'lastName', label: 'Last name', value: 'Doe' }, { name: 'phone', label: 'Phone number', value: '+1234567890', type: 'tel' }, { name: 'email', label: 'Email', value: 'jane.doe@example.com', type: 'email' }], create: ({ firstName, lastName, phone, email }) => `BEGIN:VCARD\nVERSION:3.0\nN:${lastName};${firstName};;;\nFN:${firstName} ${lastName}\nTEL;TYPE=CELL:${phone}\nEMAIL:${email}\nEND:VCARD` },
  WhatsApp: { fields: [{ name: 'phone', label: 'WhatsApp number', value: '+1234567890', type: 'tel' }, { name: 'message', label: 'Message', value: 'Hello!' }], create: ({ phone, message }) => `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}` },
  Email: { fields: [{ name: 'email', label: 'Email address', value: 'hello@example.com', type: 'email' }, { name: 'subject', label: 'Subject', value: 'Hello' }, { name: 'body', label: 'Message', value: 'Hello from RedGreen Studio', type: 'textarea' }], create: ({ email, subject, body }) => `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` },
  'Phone Number': { fields: [{ name: 'phone', label: 'Phone number', value: '+1234567890', type: 'tel' }], create: ({ phone }) => `tel:${phone}` },
  SMS: { fields: [{ name: 'phone', label: 'Phone number', value: '+1234567890', type: 'tel' }, { name: 'message', label: 'Message', value: 'Hello!', type: 'textarea' }], create: ({ phone, message }) => `sms:${phone}?body=${encodeURIComponent(message)}` },
  Calendar: { fields: [{ name: 'title', label: 'Event title', value: 'Tech Conference' }, { name: 'start', label: 'Starts', value: '2026-10-15T09:00', type: 'datetime-local' }, { name: 'end', label: 'Ends', value: '2026-10-15T17:00', type: 'datetime-local' }, { name: 'location', label: 'Location', value: '123 Innovation Way, New York, NY' }, { name: 'description', label: 'Description', value: 'Join us for the annual keynote event.', type: 'textarea' }], create: ({ title, start, end, location, description }) => `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${title}\nDTSTART:${start.replace(/[-:]/g, '')}00Z\nDTEND:${end.replace(/[-:]/g, '')}00Z\nLOCATION:${location}\nDESCRIPTION:${description}\nEND:VEVENT\nEND:VCALENDAR` },
  'Geo-location': { fields: [{ name: 'latitude', label: 'Latitude', value: '40.7484', type: 'number', min: -90, max: 90, step: 'any' }, { name: 'longitude', label: 'Longitude', value: '-73.9857', type: 'number', min: -180, max: 180, step: 'any' }, { name: 'label', label: 'Location name', value: 'Empire State Building' }], create: ({ latitude, longitude, label }) => `geo:${latitude},${longitude}?q=${encodeURIComponent(label).replace(/%20/g, '+')}` }
};

export default function QrGenerator() {
  const [text, setText] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [templateValues, setTemplateValues] = useState({});
  const [locationError, setLocationError] = useState('');
  const [isWifiPasswordVisible, setIsWifiPasswordVisible] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    window.clearTimeout(debounceRef.current);

    if (!text.trim()) {
      setQrDataUrl('');
      setIsGenerating(false);
      setError('');
      return;
    }

    setIsGenerating(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const dataUrl = await QRCode.toDataURL(text, { width: SD_SIZE, margin: 2 });
        setQrDataUrl(dataUrl);
        setError('');
      } catch (err) {
        setError('Could not generate QR code for this input.');
      } finally {
        setIsGenerating(false);
      }
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(debounceRef.current);
  }, [text]);

  const handleDownloadSd = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = 'qr-code.png';
    link.click();
  };

  const handleDownloadHd = () => {
    window.alert(HD_ERROR_MESSAGE);
  };

  const openTemplate = (templateName) => {
    const template = TEMPLATE_DEFINITIONS[templateName];
    setTemplateValues(Object.fromEntries(template.fields.map((field) => [field.name, field.value])));
    setLocationError('');
    setIsWifiPasswordVisible(false);
    setActiveTemplate(templateName);
    setIsTemplateMenuOpen(false);
  };

  const handleTemplateSubmit = (event) => {
    event.preventDefault();
    setText(TEMPLATE_DEFINITIONS[activeTemplate].create(templateValues));
    setActiveTemplate(null);
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Your browser does not support location services.');
      return;
    }

    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setTemplateValues((values) => ({ ...values, latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) })),
      () => setLocationError('Unable to access your location. Check browser permissions and try again.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const isDownloadDisabled = isGenerating || !qrDataUrl;

  return (
    <div className="qr-generator" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      <div className="qr-generator-header">
        <span className="qr-generator-title">QR Generator</span>
        <div className="qr-template-actions">
          <button type="button" onClick={() => setIsTemplateMenuOpen((isOpen) => !isOpen)} aria-expanded={isTemplateMenuOpen} aria-haspopup="menu">Add Template <span aria-hidden="true">&#9662;</span></button>
          {isTemplateMenuOpen && (
            <div className="qr-template-menu" role="menu">
              {Object.keys(TEMPLATE_DEFINITIONS).map((templateName) => <button type="button" role="menuitem" onClick={() => openTemplate(templateName)}>{templateName}</button>)}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem' }}>
        <div style={{ minWidth: 0 }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Text</label>
          <textarea
            value={text}
            onInput={(e) => setText(e.target.value)}
            rows={10}
            placeholder="Type or paste text here"
            style={{ boxSizing: 'border-box', width: '100%', height: '435px', minHeight: '200px', resize: 'vertical', fontFamily: 'monospace', padding: '0.5rem', border: '1px solid var(--border)', background: 'var(--input)', color: 'var(--foreground)' }}
          />
          
        </div>

        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <label>QR Code</label>
            {isGenerating && (
              <div
                role="progressbar"
                aria-label="Generating QR code"
                aria-valuetext="Generating QR code"
                style={{ width: '96px', height: '4px', overflow: 'hidden', borderRadius: '2px', background: 'var(--diff-progress-bg)' }}
              >
                <div style={{ width: '45%', height: '100%', background: 'var(--accent-blue)', animation: 'qr-progress 1s ease-in-out infinite' }} />
              </div>
            )}
          </div>

          <div
            style={{
              flex: 1,
              minHeight: '200px',
              height: '435px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              background: 'var(--surface)',
              padding: '1rem',
              boxSizing: 'border-box',
            }}
          >
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Generated QR code" style={{ maxWidth: '100%', maxHeight: '100%' }} />
            ) : (
              <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', margin: 0 }}>
                Write something on the left to generate QR Code Image
              </p>
            )}
          </div>
 
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>

        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--muted-foreground)' }}>
            Note: Keep text under 300 characters for optimal compatibility, as longer text may cause issues with older scanner apps.
          </p>
        <button
          onClick={handleDownloadSd}
          disabled={isDownloadDisabled}
          style={{ marginLeft: 'auto', padding: '0.4rem 0.8rem', border: 'none', borderRadius: '4px', background: 'var(--accent-blue)', color: 'var(--accent-blue-foreground)', cursor: isDownloadDisabled ? 'not-allowed' : 'pointer', opacity: isDownloadDisabled ? 0.6 : 1 }}
        >
          Download SD
        </button>
        <button
          onClick={handleDownloadHd}
          style={{ padding: '0.4rem 0.8rem', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--surface)', color: 'var(--foreground)', cursor: 'pointer' }}
        >
          Download HD
        </button>
        {error && <p role="alert" style={{ flexBasis: '100%', margin: 0, color: 'var(--danger)', textAlign: 'right' }}>{error}</p>}
      </div>

      {activeTemplate && (
        <div className="qr-template-backdrop" role="presentation">
          <form className="qr-template-dialog" onSubmit={handleTemplateSubmit} role="dialog" aria-modal="true" aria-labelledby="qr-template-title">
            <h2 id="qr-template-title">{activeTemplate}</h2>
            {activeTemplate === 'Geo-location' && <button type="button" className="qr-current-location" onClick={handleCurrentLocation}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="2"/></svg>Use Your Current Location</button>}
            {TEMPLATE_DEFINITIONS[activeTemplate].fields.map((field) => (
              <label>
                <span>{field.label}</span>
                {field.type === 'textarea' ? <textarea value={templateValues[field.name]} onInput={(event) => setTemplateValues((values) => ({ ...values, [field.name]: event.currentTarget.value }))} /> : field.type === 'select' ? <select value={templateValues[field.name]} onChange={(event) => setTemplateValues((values) => ({ ...values, [field.name]: event.currentTarget.value }))}>{field.options.map((option) => <option value={option}>{option}</option>)}</select> : field.name === 'password' && activeTemplate === 'Connect WiFi' ? <span className="qr-password-field"><input type={isWifiPasswordVisible ? 'text' : 'password'} value={templateValues[field.name]} onInput={(event) => setTemplateValues((values) => ({ ...values, [field.name]: event.currentTarget.value }))} required /><button type="button" onClick={() => setIsWifiPasswordVisible((isVisible) => !isVisible)} aria-label={isWifiPasswordVisible ? 'Hide password' : 'Show password'} title={isWifiPasswordVisible ? 'Hide password' : 'Show password'}>{isWifiPasswordVisible ? 'Hide' : 'Show'}</button></span> : <input type={field.type || 'text'} value={templateValues[field.name]} min={field.min} max={field.max} step={field.step} onInput={(event) => setTemplateValues((values) => ({ ...values, [field.name]: event.currentTarget.value }))} required />}
              </label>
            ))}
            {locationError && <p role="alert" className="qr-template-error">{locationError}</p>}
            <div className="qr-template-dialog-actions"><button type="button" onClick={() => setActiveTemplate(null)}>Cancel</button><button type="submit">Generate</button></div>
          </form>
        </div>
      )}

      <style>{`
        @keyframes qr-progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(320%); }
        }

        .qr-generator-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: center;
          gap: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--border);
        }

        .qr-generator-title {
          grid-column: 2;
          justify-self: center;
          font-weight: 700;
        }

        .qr-template-actions {
          grid-column: 3;
          justify-self: end;
          position: relative;
        }

        .qr-template-actions button {
          padding: 0.35rem 0.65rem;
          border: 1px solid var(--border);
          border-radius: 4px;
          background: var(--muted);
          color: var(--foreground);
          cursor: pointer;
        }

        .qr-template-menu { position: absolute; top: calc(100% + 0.4rem); right: 0; z-index: 20; display: grid; min-width: 180px; padding: 0.35rem; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); box-shadow: 0 12px 30px var(--shadow); }
        .qr-template-menu button { padding: 0.5rem 0.65rem; border: 0; border-radius: 4px; background: transparent; color: var(--foreground); text-align: left; }
        .qr-template-menu button:hover { background: var(--muted); }
        .qr-template-backdrop { position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; padding: 1rem; background: rgba(0, 0, 0, 0.45); }
        .qr-template-dialog { display: grid; gap: 0.75rem; width: min(100%, 440px); max-height: calc(100dvh - 2rem); overflow: auto; padding: 1rem; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--foreground); box-shadow: 0 16px 36px var(--shadow); }
        .qr-template-dialog h2 { margin: 0; font-size: 1.15rem; }
        .qr-template-dialog label { display: grid; gap: 0.35rem; font-size: 0.9rem; font-weight: 600; }
        .qr-template-dialog input, .qr-template-dialog select, .qr-template-dialog textarea { width: 100%; padding: 0.45rem; border: 1px solid var(--border); border-radius: 4px; background: var(--input); color: var(--foreground); font: inherit; }
        .qr-template-dialog textarea { min-height: 72px; resize: vertical; }
        .qr-password-field { display: flex; width: 100%; }
        .qr-password-field input { border-radius: 4px 0 0 4px; }
        .qr-password-field button { padding: 0.45rem 0.65rem; border: 1px solid var(--border); border-left: 0; border-radius: 0 4px 4px 0; background: var(--muted); color: var(--foreground); cursor: pointer; }
        .qr-current-location { justify-self: start; display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.8rem; border: 1px solid var(--border); border-radius: 4px; background: var(--muted); color: var(--foreground); cursor: pointer; }
        .qr-template-error { margin: 0; color: var(--danger); font-size: 0.9rem; }
        .qr-template-dialog-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
        .qr-template-dialog-actions button { padding: 0.4rem 0.8rem; border: 1px solid var(--border); border-radius: 4px; background: var(--muted); color: var(--foreground); cursor: pointer; }
        .qr-template-dialog-actions button[type='submit'] { border-color: var(--accent-blue); background: var(--accent-blue); color: var(--accent-blue-foreground); }

        @media (max-width: 720px) {
          .qr-generator-header {
            grid-template-columns: 1fr;
            justify-items: center;
          }

          .qr-generator-title,
          .qr-template-actions {
            grid-column: 1;
            justify-self: center;
          }
        }
      `}</style>
    </div>
  );
}
