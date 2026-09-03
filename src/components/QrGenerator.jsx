// src/components/QrGenerator.jsx
import { useEffect, useRef, useState } from 'preact/hooks';
import QRCode from 'qrcode';

const DEBOUNCE_MS = 500;
const SD_SIZE = 400;
const HD_ERROR_MESSAGE = "Free version does't support HD image download";

export default function QrGenerator() {
  const [text, setText] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
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

  const isDownloadDisabled = isGenerating || !qrDataUrl;

  return (
    <div className="qr-generator" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', border: '1px solid #d1d5db', borderRadius: '16px', padding: '1rem', background: 'var(--background)' }}>
      <div className="qr-generator-header">
        <span className="qr-generator-title">QR Generator</span>
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

      <style>{`
        @keyframes qr-progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(320%); }
        }

        .qr-generator-header {
          display: flex;
          align-items: center;
          justify-content: center;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid #d1d5db;
        }

        .qr-generator-title {
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}
