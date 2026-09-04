// src/components/JsonEditor.jsx
import { useEffect, useRef, useState } from 'preact/hooks';
import { JSONEditor } from 'vanilla-jsoneditor';
import 'vanilla-jsoneditor/themes/jse-theme-dark.css';

const getCurrentTheme = () => {
  if (typeof document === 'undefined') return undefined;
  const rootTheme = document.documentElement.dataset.theme;
  if (rootTheme === 'light' || rootTheme === 'dark') return rootTheme;

  try {
    const storedTheme = localStorage.getItem('redgreen-theme');
    if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme;
  } catch (error) {
    console.warn('Could not read theme preference for JSON editor.', error);
  }

  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

export default function JsonEditor() {
  const shellRef = useRef(null);
  const workspaceRef = useRef(null);
  const leftContainerRef = useRef(null);
  const rightContainerRef = useRef(null);
  const leftEditorRef = useRef(null);
  const rightEditorRef = useRef(null);
  const leftContentRef = useRef(null);
  const rightContentRef = useRef(null);
  const isMirroringRef = useRef(true);
  const [leftMode, setLeftMode] = useState('text');
  const [rightMode, setRightMode] = useState('tree');
  const [leftPaneWidth, setLeftPaneWidth] = useState(50);
  const [isMirroring, setIsMirroring] = useState(true);

  const initialJson = {
    appName: "RedGreen Studio",
    version: "1.0.0",
    active: true,
    features: ["JSON Fixer", "Local JSON Viewer", "JSON Sorting", "JSON Formatter", "JSON Search"],
    settings: {
      left_right_mirror: true,
      theme: "light",
      autoFormat: true,
    },
    daysActive: Math.floor(Math.abs(new Date() - new Date('2016-07-21')) / 86400000),
    
  };

  const applyEditorTheme = () => {
    shellRef.current?.classList.toggle('jse-theme-dark', getCurrentTheme() === 'dark');
  };

  useEffect(() => {
    if (!leftContainerRef.current || !rightContainerRef.current) return;

    applyEditorTheme();

    leftEditorRef.current = new JSONEditor({
      target: leftContainerRef.current,
      props: {
        content: { json: initialJson },
        mode: 'text',
        onChange: (content) => {
          leftContentRef.current = content;
          if (isMirroringRef.current) setPaneContent('right', content, false);
        }
      }
    });
    leftContentRef.current = { json: initialJson };
    rightEditorRef.current = new JSONEditor({
      target: rightContainerRef.current,
      props: {
        content: { json: initialJson },
        mode: 'tree',
        onChange: (content) => {
          rightContentRef.current = content;
          if (isMirroringRef.current) setPaneContent('left', content, false);
        }
      }
    });
    rightContentRef.current = { json: initialJson };

    return () => {
      leftEditorRef.current?.destroy();
      rightEditorRef.current?.destroy();
      leftEditorRef.current = null;
      rightEditorRef.current = null;
    };
  }, []);

  useEffect(() => {
    applyEditorTheme();

    const observer = new MutationObserver(() => {
      applyEditorTheme();
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const handleModeChange = (pane, newMode) => {
    const editor = pane === 'left' ? leftEditorRef.current : rightEditorRef.current;
    if (pane === 'left') {
      setLeftMode(newMode);
    } else {
      setRightMode(newMode);
    }
    editor?.updateProps({ mode: newMode });
  };

  const setPaneContent = (pane, content, mirror = isMirroringRef.current) => {
    const editor = pane === 'left' ? leftEditorRef.current : rightEditorRef.current;
    const contentRef = pane === 'left' ? leftContentRef : rightContentRef;
    contentRef.current = content;
    editor?.updateProps({ content });

    if (mirror) {
      setPaneContent(pane === 'left' ? 'right' : 'left', content, false);
    }
  };

  const handleMirrorChange = (event) => {
    const nextIsMirroring = event.currentTarget.checked;
    isMirroringRef.current = nextIsMirroring;
    setIsMirroring(nextIsMirroring);

    if (nextIsMirroring) setPaneContent('right', leftContentRef.current ?? { json: {} }, false);
  };

  const handleNew = (pane) => setPaneContent(pane, { json: {} });

  const handleOpen = (pane) => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,.txt,.rtf,application/json,text/plain,application/rtf';
    fileInput.onchange = async () => {
      const [file] = fileInput.files;
      if (!file) return;

      const text = await file.text();
      try {
        setPaneContent(pane, { json: JSON.parse(text) });
      } catch {
        setPaneContent(pane, { text });
      }
    };
    fileInput.click();
  };

  const handleSave = (pane) => {
    const content = pane === 'left' ? leftContentRef.current : rightContentRef.current;
    const text = content?.text ?? JSON.stringify(content?.json ?? {}, null, 2);
    const file = new Blob([text], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(file);
    const downloadLink = document.createElement('a');
    downloadLink.href = downloadUrl;
    downloadLink.download = 'document.json';
    downloadLink.click();
    URL.revokeObjectURL(downloadUrl);
  };

  const handleCopy = (fromPane) => {
    const content = fromPane === 'left' ? leftContentRef.current : rightContentRef.current;
    setPaneContent(fromPane === 'left' ? 'right' : 'left', content ?? { json: {} });
  };

  const handleDividerPointerDown = (event) => {
    const workspace = workspaceRef.current;
    if (!workspace) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    const bounds = workspace.getBoundingClientRect();

    const handlePointerMove = (moveEvent) => {
      const nextWidth = ((moveEvent.clientX - bounds.left) / bounds.width) * 100;
      setLeftPaneWidth(Math.min(80, Math.max(20, nextWidth)));
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <div ref={shellRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', minHeight: '44px', border: '1px solid var(--border)', borderBottom: 0, borderRadius: '6px 6px 0 0', background: 'var(--surface)' }}>
        <h1 style={{ gridColumn: 2, margin: 0, fontSize: '1.15rem', textAlign: 'center' }}>Json Viewer</h1>
        <label style={{ gridColumn: 3, justifySelf: 'end', display: 'inline-flex', alignItems: 'center', gap: '0.45rem', marginRight: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <span>Mirror</span>
          <input type="checkbox" checked={isMirroring} onChange={handleMirrorChange} />
        </label>
      </div>
      <div
        ref={workspaceRef}
        style={{
          display: 'grid',
          gridTemplateColumns: `${leftPaneWidth}% 10px minmax(0, 1fr)`,
          flex: '1 1 0',
          minHeight: 0,
          width: '100%',
          border: '1px solid var(--border)',
          borderRadius: '0 0 6px 6px',
          overflow: 'hidden'
        }}
      >
        <section style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <PaneToolbar
            mode={leftMode}
            copyLabel="Copy to Right"
            onNew={() => handleNew('left')}
            onOpen={() => handleOpen('left')}
            onSave={() => handleSave('left')}
            onCopy={() => handleCopy('left')}
            onModeChange={(newMode) => handleModeChange('left', newMode)}
          />
          <div ref={leftContainerRef} style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden' }} />
        </section>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize JSON editor panes"
          title="Drag to resize panes"
          onPointerDown={handleDividerPointerDown}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--editor-divider)',
            cursor: 'col-resize',
            touchAction: 'none'
          }}
        >
          <span aria-hidden="true" style={{ display: 'grid', gap: '3px' }}>
            <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--editor-dot)' }} />
            <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--editor-dot)' }} />
            <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--editor-dot)' }} />
          </span>
        </div>
        <section style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <PaneToolbar
            mode={rightMode}
            copyLabel="Copy to Left"
            onNew={() => handleNew('right')}
            onOpen={() => handleOpen('right')}
            onSave={() => handleSave('right')}
            onCopy={() => handleCopy('right')}
            onModeChange={(newMode) => handleModeChange('right', newMode)}
          />
          <div ref={rightContainerRef} style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden' }} />
        </section>
      </div>
    </div>
  );
}

function PaneToolbar({ mode, copyLabel, onNew, onOpen, onSave, onCopy, onModeChange }) {
  const buttonStyle = (active) => ({
    padding: '0.35rem 0.65rem',
    fontWeight: active ? 'bold' : 'normal',
    background: active ? 'var(--accent-blue)' : 'var(--muted)',
    color: active ? 'var(--accent-blue-foreground)' : 'var(--foreground)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    cursor: 'pointer'
  });

  return (
    <div style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem', overflowX: 'auto', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
        <button onClick={() => onModeChange('text')} style={buttonStyle(mode === 'text')}>Code</button>
        <button onClick={() => onModeChange('tree')} style={buttonStyle(mode === 'tree')}>Tree</button>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, marginLeft: 'auto' }}>
        <button onClick={onNew} style={buttonStyle(false)}>New</button>
        <button onClick={onOpen} style={buttonStyle(false)}>Open</button>
        <button onClick={onSave} style={buttonStyle(false)}>Save</button>
        <button onClick={onCopy} style={buttonStyle(false)}>{copyLabel}</button>
      </div>
    </div>
  );
}