import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function AiPanel({ incidentId, onRecord }) {
  const [s, setS] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState(null), [note, setNote] = useState('');
  const load = async () => {
    setBusy(true); setErr(null);
    try { setS(await api(`/incidents/${incidentId}/troubleshoot`, { method: 'POST' })); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const copy = async (c) => { try { await navigator.clipboard.writeText(c); setNote('Copied to clipboard'); } catch { setNote('Copy failed. Select the command and copy it manually.'); } };
  return (
    <section className="rounded-lg border border-line bg-white overflow-hidden" aria-label="AI troubleshooting">
      {/* Glass header strip — only this row gets the glass treatment */}
      <div className="glass-card flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="font-semibold">AI troubleshooting</h2>
        <button onClick={load} disabled={busy} className="rounded border border-brand px-3 py-2 text-sm font-medium text-brand disabled:opacity-50">
          {busy ? 'Analysing…' : s ? 'Refresh suggestions' : 'Get suggestions'}</button>
      </div>
      <div className="space-y-3 p-4">
      {err && <p role="alert" className="text-sm text-crit">{err}</p>}
      {!s && !err && <p className="text-sm text-slate-600">Get recommended checks and commands based on this incident's title and description.</p>}
      {s && (<div className="space-y-4 text-sm">
        <p className="rounded border border-amber-200 bg-amber-50 p-2 text-warn">{s.disclaimer}</p>
        <div><h3 className="font-medium">Possible cause</h3><p>{s.possibleCause}</p></div>
        <div><h3 className="font-medium">Recommended investigation</h3>
          <ol className="mt-1 space-y-1">{s.investigation.map((step, n) => (
            <li key={n} className="flex items-start justify-between gap-2"><span>{n + 1}. {step}</span>
              <button onClick={() => onRecord(step)} className="shrink-0 text-brand underline">Record as action</button></li>))}</ol></div>
        <div><h3 className="font-medium">Suggested commands</h3>
          <p className="text-slate-600">Examples only. Review and adjust names before running.</p>
          <ul className="mt-1 space-y-2">{s.commands.map((c) => (
            <li key={c.command}><div>{c.label}</div>
              <div className="flex items-center gap-2"><code className="block flex-1 overflow-x-auto rounded bg-slate-100 p-2">{c.command}</code>
                <button onClick={() => copy(c.command)} className="shrink-0 rounded border border-line px-2 py-1">Copy</button></div></li>))}</ul>
          <p role="status" className="mt-1 text-slate-600">{note}</p></div>
        {s.relatedArticles.length > 0 && <div><h3 className="font-medium">Related articles</h3>
          <ul>{s.relatedArticles.map((a) => <li key={a.id}><Link className="text-brand underline" to={`/knowledge/${a.id}`}>{a.title}</Link></li>)}</ul></div>}
      </div>)}
      </div>
    </section>
  );
}
