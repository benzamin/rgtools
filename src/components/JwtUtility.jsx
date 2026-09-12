import { useEffect, useState } from 'preact/hooks';
import { decodeJwt, formatClaimValue, generateExampleJwt, HMAC_ALGORITHMS, signJwt, SUPPORTED_ALGORITHMS, verifyJwt } from '../lib/jwt.js';

const EMPTY = { decoded: null, error: '', signature: { status: 'not-checked' } };

export default function JwtUtility() {
  const [tab, setTab] = useState('encode');
  const [token, setToken] = useState('');
  const [secret, setSecret] = useState('');
  const [keyFormat, setKeyFormat] = useState('text');
  const [state, setState] = useState(EMPTY);
  const [headerView, setHeaderView] = useState('json');
  const [payloadView, setPayloadView] = useState('json');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!token.trim()) {
        setState(EMPTY);
        return;
      }
      try {
        const decoded = decodeJwt(token);
        setState({ decoded, error: '', signature: { status: 'not-checked' } });
      } catch (error) {
        setState({ decoded: null, error: error.message, signature: { status: 'not-checked' } });
      }
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [token]);

  const algorithm = state.decoded?.header.alg;
  const isHmac = HMAC_ALGORITHMS.has(algorithm);
  const verificationLabel = isHmac ? 'Secret' : 'Public Key';
  const signature = state.signature;

  useEffect(() => {
    if (!state.decoded || !secret.trim()) {
      setState((current) => current.signature.status === 'not-checked' ? current : { ...current, signature: { status: 'not-checked' } });
      return;
    }
    let cancelled = false;
    setState((current) => ({ ...current, signature: { status: 'verifying' } }));
    verifyJwt(state.decoded, secret, keyFormat).then((result) => {
      if (!cancelled) setState((current) => ({ ...current, signature: result }));
    });
    return () => { cancelled = true; };
  }, [state.decoded, secret, keyFormat]);

  const copy = async (label, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(''), 1600);
    } catch {
      setCopied('Clipboard unavailable');
    }
  };

  const clearToken = () => setToken('');
  const clearSecret = () => setSecret('');
  const generate = async () => {
    const example = await generateExampleJwt();
    setToken(example.token);
    setSecret(example.secret);
    setKeyFormat('text');
  };

  const claims = (object) => (
    <table className="jwt-claims">
      <thead><tr><th>Claim</th><th>Value</th></tr></thead>
      <tbody>{Object.entries(object).map(([key, value]) => <tr key={key}><th scope="row">{key}</th><td><code>{formatClaimValue(key, value)}</code></td></tr>)}</tbody>
    </table>
  );

  const panel = (title, object, view, setView) => {
    const json = JSON.stringify(object, null, 2);
    return <section className="jwt-panel">
      <div className="jwt-panel-heading">
        <h2>{title}</h2>
        <div className="jwt-panel-actions">
          <div className="jwt-segmented" role="tablist" aria-label={`${title} view`}>
            <button className={view === 'json' ? 'active' : ''} onClick={() => setView('json')}>JSON</button>
            <button className={view === 'claims' ? 'active' : ''} onClick={() => setView('claims')}>Claims</button>
          </div>
          <button onClick={() => copy(title, json)}>Copy</button>
        </div>
      </div>
      {view === 'json' ? <pre className="jwt-code">{json}</pre> : claims(object)}
    </section>;
  };

  const statusText = state.error ? 'Invalid JWT' : state.decoded ? 'Valid JWT' : '';
  const signatureText = {
    'not-checked': 'Signature not verified',
    verifying: 'Verifying...',
    verified: 'Signature Verified',
    invalid: 'Invalid Signature',
    unsupported: 'Unsupported Algorithm',
    error: signature.error || 'Unable to verify signature',
  }[signature.status];

  if (tab === 'encode') {
    return <JwtEncoder onDecode={() => setTab('decode')} copy={copy} copied={copied} />;
  }

  return <div className="jwt-utility">
    <header className="jwt-utility-header">
      <div><h3>JWT Utility</h3></div>
      <div className="jwt-tabs" role="tablist" aria-label="JWT utility mode">
        <button className={tab === 'encode' ? 'active' : ''} onClick={() => setTab('encode')}>Encode</button>
        <button className={tab === 'decode' ? 'active' : ''} onClick={() => setTab('decode')}>Decoder</button>
      </div>
    </header>
    <section className="jwt-card">
      <div className="jwt-section-heading"><label htmlFor="jwt-token">Encoded Token</label><div><button onClick={generate}>Generate example</button><button onClick={clearToken}>Clear</button></div></div>
      <textarea id="jwt-token" className="jwt-token-input" value={token} onInput={(event) => setToken(event.currentTarget.value)} placeholder="Paste your JWT here (xxxxx.yyyyy.zzzzz)" spellcheck="false" />
      <div className="jwt-statuses" aria-live="polite">
        {statusText && <span className={state.error ? 'status invalid' : 'status valid'}>{statusText}</span>}
        {statusText && <span className={`status ${signature.status}`}>{signatureText}</span>}
        {state.error && <span className="jwt-error">{state.error}</span>}
      </div>
    </section>
    {state.decoded && <div className="jwt-panels">
      {panel('Decoded Header', state.decoded.header, headerView, setHeaderView)}
      {panel('Decoded Payload', state.decoded.payload, payloadView, setPayloadView)}
    </div>}
    <section className="jwt-card jwt-verification">
      <div className="jwt-section-heading"><div><h2>JWT Signature Verification <small>(Optional)</small></h2><p>Enter the key used to sign the JWT below.</p></div>{secret && <button onClick={clearSecret}>Clear key</button>}</div>
      <label htmlFor="jwt-key">{verificationLabel}</label>
      <textarea id="jwt-key" className="jwt-key-input" value={secret} onInput={(event) => setSecret(event.currentTarget.value)} placeholder={isHmac ? 'Enter a signing secret' : '-----BEGIN PUBLIC KEY-----'} spellcheck="false" />
      {isHmac && <label className="jwt-checkbox"><input type="checkbox" checked={keyFormat === 'base64url'} onChange={(event) => setKeyFormat(event.currentTarget.checked ? 'base64url' : 'text')} /> Base64URL Encoded</label>}
      {!state.decoded && <p className="jwt-muted">Paste a token to enable signature verification.</p>}
    </section>
    {copied && <div className="jwt-toast" role="status">{copied}</div>}
    <style>{`
      .jwt-utility { max-width: 1100px; margin: 0 auto; padding: 2rem 1rem 4rem; color: var(--foreground); }
      .jwt-utility-header { display:grid; grid-template-columns:minmax(0,1fr) auto minmax(0,1fr); align-items:center; gap:1rem; margin-bottom:.25rem; }
      .jwt-utility-header > :first-child { grid-column:2; justify-self:center; text-align:center; }
      .jwt-utility-header .jwt-tabs { grid-column:3; justify-self:end; }
      .jwt-utility h1,.jwt-utility h3 { margin:0; line-height:1.2; }.jwt-utility h1 { font-size:clamp(1.7rem,4vw,2.3rem); }.jwt-utility h3 { font-size:1.15rem; }.jwt-utility p { color:var(--muted-foreground); margin:.2rem 0 0; }
      .jwt-tabs,.jwt-segmented { display:flex; gap:.25rem; border-bottom:1px solid var(--border); }.jwt-tabs button,.jwt-segmented button { border:0; border-bottom:2px solid transparent; background:transparent; color:var(--muted-foreground); padding:.6rem .8rem; cursor:pointer; }.jwt-tabs button.active,.jwt-segmented button.active { color:var(--foreground); border-color:var(--accent-blue); }
      .jwt-card,.jwt-panel { border:1px solid var(--border); border-radius:10px; background:var(--surface); padding:1rem; margin-bottom:1rem; }.jwt-section-heading,.jwt-panel-heading { display:flex; align-items:start; justify-content:space-between; gap:1rem; margin-bottom:.7rem; }.jwt-section-heading label,.jwt-panel-heading h2,.jwt-verification label { font-weight:700; }.jwt-panel-heading h2,.jwt-verification h2 { margin:0; font-size:1rem; }.jwt-verification small { font-weight:400; color:var(--muted-foreground); }
      button { font:inherit; }.jwt-section-heading button,.jwt-panel-actions > button { background:var(--muted); color:var(--foreground); border:1px solid var(--border); border-radius:5px; padding:.4rem .65rem; cursor:pointer; margin-left:.4rem; }.jwt-token-input,.jwt-key-input { display:block; width:100%; min-height:150px; resize:vertical; border:1px solid var(--border); border-radius:6px; background:var(--input); color:var(--foreground); padding:.8rem; font: .9rem/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; }.jwt-key-input { min-height:100px; margin-top:.45rem; }.jwt-statuses { display:flex; flex-wrap:wrap; gap:.5rem; align-items:center; margin-top:.75rem; }.status { border-radius:999px; padding:.25rem .6rem; font-size:.85rem; border:1px solid var(--border); }.status.valid,.status.verified { color:#4ade80; }.status.invalid,.status.error { color:var(--danger); }.status.verifying { color:#facc15; }.status.unsupported { color:#fb923c; }.jwt-error { color:var(--danger); font-size:.9rem; }.jwt-panels { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }.jwt-panel { min-width:0; }.jwt-panel-actions { display:flex; align-items:center; gap:.4rem; }.jwt-segmented { border:0; }.jwt-segmented button { padding:.25rem .45rem; }.jwt-code { overflow:auto; margin:0; min-height:120px; color:var(--foreground); font: .85rem/1.55 ui-monospace,SFMono-Regular,Menlo,monospace; }.jwt-claims { width:100%; border-collapse:collapse; font-size:.9rem; }.jwt-claims th,.jwt-claims td { text-align:left; vertical-align:top; padding:.5rem; border-bottom:1px solid var(--border); }.jwt-claims td code { white-space:pre-wrap; word-break:break-word; }.jwt-checkbox { display:flex; align-items:center; gap:.45rem; margin-top:.65rem; font-weight:400!important; }.jwt-muted { font-size:.9rem; }.jwt-toast { position:fixed; bottom:1.5rem; right:1.5rem; background:var(--foreground); color:var(--background); padding:.6rem .9rem; border-radius:6px; }.jwt-utility button:focus-visible,.jwt-utility textarea:focus-visible { outline:2px solid var(--accent-blue); outline-offset:2px; }
      @media (max-width:700px) { .jwt-utility-header { display:flex; flex-direction:column; align-items:stretch; }.jwt-section-heading,.jwt-panel-heading { flex-direction:column; align-items:stretch; }.jwt-tabs { align-self:flex-start; }.jwt-panels { grid-template-columns:1fr; }.jwt-panel-actions { justify-content:space-between; } }
    `}</style>
  </div>;
}

const INITIAL_HEADER = `{
  "alg": "HS256",
  "typ": "JWT"
}`;
const INITIAL_PAYLOAD = `{
  "sub": "1234567890",
  "name": "John Doe",
  "admin": true,
  "iat": 1516239022
}`;
const INITIAL_SECRET = 'a-string-secret-at-least-256-bits-long';

function JwtEncoder({ onDecode, copy, copied }) {
  const [header, setHeader] = useState(INITIAL_HEADER);
  const [payload, setPayload] = useState(INITIAL_PAYLOAD);
  const [algorithm, setAlgorithm] = useState('HS256');
  const [key, setKey] = useState(INITIAL_SECRET);
  const [keyFormat, setKeyFormat] = useState('text');
  const [encodedToken, setEncodedToken] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      let parsedHeader;
      let parsedPayload;
      try {
        parsedHeader = JSON.parse(header);
        parsedPayload = JSON.parse(payload);
        if (!parsedHeader || typeof parsedHeader !== 'object' || Array.isArray(parsedHeader)) throw new Error('Header must be a JSON object.');
        if (!parsedPayload || typeof parsedPayload !== 'object' || Array.isArray(parsedPayload)) throw new Error('Payload must be a JSON object.');
      } catch (parseError) {
        if (!cancelled) {
          setEncodedToken('');
          setStatus('error');
          setError(`Invalid JSON: ${parseError.message}`);
        }
        return;
      }
      if (!key.trim()) {
        if (!cancelled) {
          setEncodedToken('');
          setStatus('ready');
          setError('Enter a secret to sign this JWT.');
        }
        return;
      }
      setStatus('signing');
      try {
        const token = await signJwt({ ...parsedHeader, alg: algorithm }, parsedPayload, key, keyFormat);
        if (!cancelled) {
          setEncodedToken(token);
          setStatus('generated');
          setError('');
        }
      } catch (signError) {
        if (!cancelled) {
          setEncodedToken('');
          setStatus('error');
          setError(signError.message);
        }
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [header, payload, algorithm, key, keyFormat]);

  const updateAlgorithm = (event) => {
    const nextAlgorithm = event.currentTarget.value;
    setAlgorithm(nextAlgorithm);
    try {
      const parsed = JSON.parse(header);
      setHeader(JSON.stringify({ ...parsed, alg: nextAlgorithm }, null, 2));
    } catch {
      // The signing effect reports the invalid JSON while preserving the user's input.
    }
  };

  const updateHeader = (event) => {
    const nextHeader = event.currentTarget.value;
    setHeader(nextHeader);
    try {
      const parsed = JSON.parse(nextHeader);
      if (SUPPORTED_ALGORITHMS.includes(parsed.alg)) setAlgorithm(parsed.alg);
    } catch {
      // The signing effect reports invalid JSON while preserving the user's input.
    }
  };

  const clear = () => {
    setHeader(INITIAL_HEADER);
    setPayload(INITIAL_PAYLOAD);
    setAlgorithm('HS256');
    setKey('');
    setKeyFormat('text');
    setEncodedToken('');
    setStatus('idle');
    setError('');
  };

  const isHmac = HMAC_ALGORITHMS.has(algorithm);
  const statusText = {
    idle: '',
    ready: 'Ready to sign',
    signing: 'Signing...',
    generated: 'JWT Generated',
    error: error.startsWith('Invalid JSON') ? 'Cannot encode: invalid JSON' : error,
  }[status];

  return <div className="jwt-utility">
    <header className="jwt-utility-header">
      <h1>JWT Utility</h1>
      <div className="jwt-tabs" role="tablist" aria-label="JWT utility mode">
        <button className="active" onClick={() => {}}>Encode</button>
        <button onClick={onDecode}>Decoder</button>
      </div>
    </header>
    <div className="jwt-encoder-layout">
      <div className="jwt-encoder-inputs">
      <section className="jwt-card">
        <div className="jwt-section-heading"><label htmlFor="jwt-encoder-header">Header</label></div>
        <textarea id="jwt-encoder-header" className="jwt-editor" value={header} onInput={updateHeader} spellcheck="false" />
      </section>
      <section className="jwt-card">
        <div className="jwt-section-heading"><label htmlFor="jwt-encoder-payload">Payload</label></div>
        <textarea id="jwt-encoder-payload" className="jwt-editor" value={payload} onInput={(event) => setPayload(event.currentTarget.value)} spellcheck="false" />
      </section>
      <section className="jwt-card">
      <div className="jwt-section-heading"><div><h2>Signature / Signing Key</h2><p>Select an algorithm and provide the key used to sign this JWT.</p></div><button onClick={clear}>Clear</button></div>
      <label htmlFor="jwt-algorithm">Algorithm</label>
      <select id="jwt-algorithm" value={algorithm} onChange={updateAlgorithm}>
        {SUPPORTED_ALGORITHMS.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <label htmlFor="jwt-signing-key" className="jwt-key-label">{isHmac ? 'Secret' : 'Private Key'}</label>
      <textarea id="jwt-signing-key" className="jwt-key-input" value={key} onInput={(event) => setKey(event.currentTarget.value)} placeholder={isHmac ? 'Enter a signing secret' : '-----BEGIN PRIVATE KEY-----'} spellcheck="false" />
      {isHmac && <label className="jwt-checkbox"><input type="checkbox" checked={keyFormat === 'base64url'} onChange={(event) => setKeyFormat(event.currentTarget.checked ? 'base64url' : 'text')} /> Base64URL Encoded</label>}
      </section>
      </div>
    <section className="jwt-card jwt-encoded-panel">
      <div className="jwt-section-heading"><label htmlFor="jwt-encoded-output">Encoded JWT</label><button disabled={!encodedToken} onClick={() => copy('JWT', encodedToken)}>Copy</button></div>
      <textarea id="jwt-encoded-output" className="jwt-token-input" value={encodedToken} readOnly placeholder="Your signed JWT will appear here" spellcheck="false" />
      <div className="jwt-statuses" aria-live="polite">
        {statusText && <span className={`status ${status === 'generated' ? 'verified' : status === 'error' ? 'error' : ''}`}>{statusText}</span>}
        {error && <span className="jwt-error">{error}</span>}
        <span className="jwt-warning">JWTs are encoded, not encrypted. Do not put secrets in the payload.</span>
      </div>
    </section>
    </div>
    {copied && <div className="jwt-toast" role="status">{copied}</div>}
    <style>{`
      .jwt-utility { max-width:1100px; margin:0 auto; padding:2rem 1rem 4rem; color:var(--foreground); }
      .jwt-utility-header { display:grid; grid-template-columns:minmax(0,1fr) auto minmax(0,1fr); align-items:center; gap:1rem; margin-bottom:.25rem; }
      .jwt-utility-header > :first-child { grid-column:2; justify-self:center; text-align:center; }
      .jwt-utility-header .jwt-tabs { grid-column:3; justify-self:end; }
      .jwt-utility h1 { margin:0; line-height:1.2; font-size:1.15rem; }
      .jwt-utility p { color:var(--muted-foreground); margin:.2rem 0 0; }
      .jwt-tabs { display:flex; gap:.25rem; border-bottom:1px solid var(--border); }
      .jwt-tabs button { border:0; border-bottom:2px solid transparent; background:transparent; color:var(--muted-foreground); padding:.6rem .8rem; cursor:pointer; font:inherit; }
      .jwt-tabs button.active { color:var(--foreground); border-color:var(--accent-blue); }
      .jwt-card { border:1px solid var(--border); border-radius:10px; background:var(--surface); padding:1rem; margin-bottom:1rem; }
      .jwt-section-heading { display:flex; align-items:start; justify-content:space-between; gap:1rem; margin-bottom:.7rem; }
      .jwt-section-heading label,.jwt-section-heading h2 { font-weight:700; }
      .jwt-section-heading h2 { margin:0; font-size:1rem; }
      .jwt-section-heading button { background:var(--muted); color:var(--foreground); border:1px solid var(--border); border-radius:5px; padding:.4rem .65rem; cursor:pointer; margin-left:.4rem; font:inherit; }
      .jwt-encoder-layout { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:1rem; align-items:stretch; }
      .jwt-encoder-inputs { display:flex; flex-direction:column; gap:1rem; min-width:0; }
      .jwt-editor,.jwt-token-input,.jwt-key-input { display:block; width:100%; resize:vertical; border:1px solid var(--border); border-radius:6px; background:var(--input); color:var(--foreground); padding:.8rem; font:.9rem/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; }
      .jwt-editor { min-height:120px; text-align:left; }
      .jwt-token-input { min-height:150px; }
      .jwt-key-input { min-height:100px; margin-top:.45rem; }
      .jwt-encoded-panel { display:flex; flex-direction:column; min-height:100%; }
      .jwt-encoded-panel .jwt-token-input { flex:1; min-height:0; resize:vertical; text-align:left; }
      #jwt-algorithm { display:block; margin-top:.45rem; padding:.5rem; min-width:180px; background:var(--input); color:var(--foreground); border:1px solid var(--border); border-radius:6px; font:inherit; }
      .jwt-key-label { display:block; margin-top:1rem; }
      .jwt-checkbox { display:flex; align-items:center; gap:.45rem; margin-top:.65rem; }
      .jwt-statuses { display:flex; flex-wrap:wrap; gap:.5rem; align-items:center; margin-top:.75rem; }
      .status { border-radius:999px; padding:.25rem .6rem; font-size:.85rem; border:1px solid var(--border); }
      .status.verified { color:#4ade80; }.status.error { color:var(--danger); }
      .jwt-error { color:var(--danger); font-size:.9rem; }.jwt-warning { width:100%; color:var(--muted-foreground); font-size:.85rem; }
      .jwt-toast { position:fixed; bottom:1.5rem; right:1.5rem; background:var(--foreground); color:var(--background); padding:.6rem .9rem; border-radius:6px; }
      .jwt-utility button:focus-visible,.jwt-utility textarea:focus-visible,.jwt-utility select:focus-visible { outline:2px solid var(--accent-blue); outline-offset:2px; }
      .jwt-utility button:disabled { opacity:.5; cursor:not-allowed; }
      @media (max-width:700px) { .jwt-utility-header { display:flex; flex-direction:column; align-items:stretch; }.jwt-section-heading { flex-direction:column; align-items:stretch; }.jwt-tabs { align-self:flex-start; }.jwt-encoder-layout { grid-template-columns:1fr; }.jwt-encoded-panel { min-height:300px; } }
    `}</style>
  </div>;
}
