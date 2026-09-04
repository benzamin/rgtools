import { useEffect, useRef, useState } from 'preact/hooks';
import { AlertProvider, useAlerts } from './AlertProvider.jsx';

const INITIAL_TEXT = 'RedGreen Studio';

const encodeBase64 = (value) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const decodeBase64 = (value) => {
  const binary = atob(value.trim());
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export default function Base64Utility() {
  return (
    <AlertProvider>
      <Base64UtilityContent />
    </AlertProvider>
  );
}

function Base64UtilityContent() {
  const [mode, setMode] = useState('encode');
  const [inputText, setInputText] = useState(INITIAL_TEXT);
  const [outputText, setOutputText] = useState(encodeBase64(INITIAL_TEXT));
  const [error, setError] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [textareaHeight, setTextareaHeight] = useState(420);
  const inputTextareaRef = useRef(null);
  const outputTextareaRef = useRef(null);
  const textareaHeightRef = useRef(textareaHeight);
  const { notify } = useAlerts();

  useEffect(() => {
    setIsConverting(true);
    const timeoutId = window.setTimeout(() => {
      try {
        setOutputText(mode === 'encode' ? encodeBase64(inputText) : decodeBase64(inputText));
        setError('');
      } catch {
        setOutputText('');
        setError('Enter a valid Base64 value to decode.');
      }
      setIsConverting(false);
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [inputText, mode]);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const resizedEntry = entries.find((entry) => entry.target.offsetHeight !== textareaHeightRef.current);
      if (!resizedEntry) return;

      const nextHeight = Math.max(100, resizedEntry.target.offsetHeight);
      textareaHeightRef.current = nextHeight;
      setTextareaHeight(nextHeight);
    });

    observer.observe(inputTextareaRef.current);
    observer.observe(outputTextareaRef.current);
    return () => observer.disconnect();
  }, []);

  const handleOpen = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.txt,text/plain';
    fileInput.onchange = async () => {
      const [file] = fileInput.files;
      if (file) setInputText(await file.text());
    };
    fileInput.click();
  };

  const handlePaste = async () => {
    try {
      setInputText(await navigator.clipboard.readText());
    } catch {
      setError('Clipboard access was unavailable. Paste directly into the input field.');
    }
  };

  const handleSave = () => {
    const file = new Blob([outputText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = mode === 'encode' ? 'encoded-base64.txt' : 'decoded-text.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(outputText);
      setError('');
      notify('Copied');
    } catch {
      setError('Clipboard access was unavailable. Copy the output manually.');
    }
  };

  const textareaStyle = {
    boxSizing: 'border-box',
    width: '100%',
    height: `${textareaHeight}px`,
    minHeight: '100px',
    resize: 'vertical',
    fontFamily: 'monospace',
    padding: '0.5rem',
    border: '1px solid var(--border)',
    background: 'var(--input)',
    color: 'var(--foreground)'
  };

  return (
    <div className="base64-utility" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      <div className="base64-utility-header">
        <span className="base64-utility-title">Base64 Utility</span>
        <fieldset className="base64-mode-group" aria-label="Base64 operation">
          <legend>Base64 operation</legend>
          <label><input type="radio" name="base64-mode" value="encode" checked={mode === 'encode'} onChange={(event) => setMode(event.currentTarget.value)} /> Encode</label>
          <label><input type="radio" name="base64-mode" value="decode" checked={mode === 'decode'} onChange={(event) => setMode(event.currentTarget.value)} /> Decode</label>
        </fieldset>
      </div>

      <div className="base64-panes">
        <section>
          <div className="base64-pane-toolbar">
            <label>Input</label>
            <div><button onClick={handleOpen}>Open</button><button onClick={handlePaste}>Paste</button></div>
          </div>
          <textarea ref={inputTextareaRef} value={inputText} onInput={(event) => setInputText(event.currentTarget.value)} aria-label="Base64 input" style={textareaStyle} />
        </section>
        <section>
          <div className="base64-pane-toolbar">
            <div className="base64-output-heading">
              <label>Output</label>
              {isConverting && (
                <div role="progressbar" aria-label={`${mode === 'encode' ? 'Encoding' : 'Decoding'} text`} aria-valuetext={mode === 'encode' ? 'Encoding text' : 'Decoding text'} className="base64-progress">
                  <div />
                </div>
              )}
            </div>
            <div><button onClick={handleSave}>Save</button><button onClick={handleCopy}>Copy</button></div>
          </div>
          <textarea ref={outputTextareaRef} value={outputText} readOnly aria-label="Base64 output" style={textareaStyle} />
        </section>
      </div>
      {error && <p role="alert" className="base64-error">{error}</p>}
      <style>{`
        .base64-utility-header { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border); }
        .base64-utility-title { grid-column: 2; justify-self: center; font-weight: 700; font-size: 1.15rem; text-align: center; }
        .base64-mode-group { grid-column: 3; justify-self: end; display: flex; align-items: center; gap: 0.85rem; margin: 0; padding: 0; border: 0; color: var(--foreground); font-size: 0.9rem; }
        .base64-mode-group legend { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
        .base64-mode-group label { display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer; white-space: nowrap; font-size: 1rem; font-weight: 700; }
        .base64-mode-group input { accent-color: var(--accent-blue); }
        .base64-panes { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1rem; }
        .base64-panes section { min-width: 0; }
        .base64-pane-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.5rem; }
        .base64-output-heading { display: inline-flex; align-items: center; gap: 0.6rem; }
        .base64-progress { width: 96px; height: 4px; overflow: hidden; border-radius: 2px; background: var(--diff-progress-bg); }
        .base64-progress div { width: 45%; height: 100%; background: var(--accent-blue); animation: base64-progress 1s ease-in-out infinite; }
        .base64-pane-toolbar div { display: flex; gap: 0.5rem; }
        .base64-pane-toolbar button { padding: 0.35rem 0.65rem; border: 1px solid var(--border); border-radius: 4px; background: var(--muted); color: var(--foreground); cursor: pointer; }
        .base64-error { margin: 0; color: var(--danger); text-align: right; }
        @keyframes base64-progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(320%); } }
        @media (max-width: 720px) { .base64-utility-header { grid-template-columns: 1fr; justify-items: center; } .base64-utility-title, .base64-mode-group { grid-column: 1; justify-self: center; } .base64-panes { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
