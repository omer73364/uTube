import { useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, CheckCircle2 } from 'lucide-react';
import type { UpdateState } from '../shared';
import { updateCopy } from '../../../../packages/core/update-copy.js';

export default function Updates({ language, full = false, hasCurrentDownload = false }: { language: 'en' | 'ar'; full?: boolean; hasCurrentDownload?: boolean }) {
  const [state, setState] = useState<UpdateState>();
  const [hidden, setHidden] = useState<string>();
  const [confirm, setConfirm] = useState(false);
  const prompt = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (confirm) prompt.current?.showModal(); }, [confirm]);
  const copy = updateCopy[language];
  useEffect(() => {
    if (!window.utube?.updates) return;
    let active = true;
    const unsubscribe = window.utube.onUpdates(value => { if (active) setState(value); });
    void window.utube.updates().then(value => { if (active) setState(value); }).catch(() => {});
    return () => { active = false; unsubscribe(); };
  }, []);
  if (!state) return null;
  const portable = state.release?.kind === 'AppImage';
  const busy = ['checking', 'downloading', 'waiting', 'installing'].includes(state.phase);
  const notices = state.services.filter(rule => rule.state !== 'available');
  const key = `${state.release?.version}/${state.phase}`;
  if (!full && !notices.length && (!state.release || hidden === key)) return null;
  const action = (task: Promise<unknown>) => { void task.catch(() => {}); };
  const status = state.phase === 'checking' ? copy.checking : state.phase === 'downloading' ? copy.downloading :
    state.phase === 'ready' ? copy.ready : state.phase === 'waiting' ? copy.waiting : state.phase === 'installing' ? copy.installing :
    state.phase === 'unconfigured' ? copy.unconfigured : state.release ? copy.available : state.phase === 'current' ? copy.current : '';
  return <section className={full ? 'settings-section updates-panel' : 'alert updates-panel'} aria-label={copy.title}>
    <div className="update-content">
      {(full || state.release) && <>
        <div className="update-heading"><span className="update-icon">{state.phase === "current" ? <CheckCircle2 size={22} /> : <Download size={22} />}</span><div><h3>{copy.title}{state.release && <> · <bdi>v{state.release.version}</bdi></>}</h3><p role="status">{status}</p></div></div>
        {state.error && <p role="alert">{state.error === 'check' ? copy.checkError : state.error === 'download' ? copy.downloadError : copy.installError}</p>}
        {full && state.release?.notes[language] && <details><summary>{copy.notes}</summary><p className="update-notes" dir="auto">{state.release.notes[language]}</p></details>}
        {state.phase === 'downloading' && <progress aria-label={copy.downloading} max={state.total} value={state.loaded} />}
        <div className="ffmpeg-setup-actions">
          {full && <button className="secondary" disabled={busy || state.phase === 'unconfigured'} onClick={() => action(window.utube.checkUpdates())}><RefreshCw size={16} />{copy.check}</button>}
          {state.release && ['available', 'error'].includes(state.phase) && <button className="primary" onClick={() => action(window.utube.downloadUpdate())}>{copy.download}</button>}
          {state.phase === 'ready' && <button className="primary" onClick={() => setConfirm(true)}>{state.release?.kind === 'AppImage' ? copy.showFile : copy.install}</button>}
          {['downloading', 'waiting'].includes(state.phase) && <button className="secondary" onClick={() => action(window.utube.cancelUpdate())}>{copy.cancel}</button>}
          {!full && state.release && !busy && <button className="secondary" onClick={() => setHidden(key)}>{copy.later}</button>}
        </div>
      </>}
      {notices.map(rule => <div key={rule.provider} className="service-notice" role="status"><strong>{rule.provider === 'x' ? 'X' : rule.provider.charAt(0).toUpperCase() + rule.provider.slice(1)}</strong><p dir="auto">{rule.message[language]}</p>{rule.fixedVersion && <small>{copy.fixedIn} · <bdi>v{rule.fixedVersion}</bdi></small>}</div>)}
      {full && !state.statusVerified && state.phase !== 'unconfigured' && <p>{copy.unknown}</p>}
    </div>
    {confirm && <dialog ref={prompt} onCancel={() => setConfirm(false)} className="about-dialog update-confirm" aria-labelledby="update-confirm-title"><h2 id="update-confirm-title">{copy.ready}</h2><p>{state.release?.kind === 'AppImage' ? copy.portableHelp : copy.installerHelp}</p><div className="ffmpeg-setup-actions"><button className="primary" onClick={() => { setConfirm(false); action(window.utube.installUpdate(false)); }}>{portable ? copy.showFile : hasCurrentDownload ? copy.finish : copy.install}</button>{!portable && hasCurrentDownload && <button className="secondary" onClick={() => { setConfirm(false); action(window.utube.installUpdate(true)); }}>{copy.interrupt}</button>}<button className="secondary" onClick={() => setConfirm(false)}>{copy.later}</button></div></dialog>}
  </section>;
}
