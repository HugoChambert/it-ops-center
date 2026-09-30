import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { inputCls } from './Field.jsx';

const SECTIONS = [['problem', 'Problem'], ['impact', 'Impact'], ['investigation', 'Investigation'],
  ['root_cause', 'Root cause'], ['resolution', 'Resolution'], ['preventative_action', 'Preventative action']];
const toText = (r) => SECTIONS.map(([k, l]) => `${l}\n${r[k] || ''}`).join('\n\n');

export default function ReportPanel({ incidentId, onSaved }) {
  const [saved, setSaved] = useState(null), [form, setForm] = useState(null), [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null), [msg, setMsg] = useState('');
  useEffect(() => { api(`/incidents/${incidentId}/report`).then(setSaved).catch((e) => setErr(e.message)); }, [incidentId]);

  const generate = async () => {
    setBusy(true); setErr(null); setMsg('');
    try { setForm(await api(`/incidents/${incidentId}/report/draft`, { method: 'POST' })); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const save = async (e) => {
    e.preventDefault(); setErr(null);
    try { setSaved(await api(`/incidents/${incidentId}/report`, { method: 'PUT', body: form })); setForm(null); setMsg('Report saved'); onSaved?.(); }
    catch (x) { setErr(x.message); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(toText(saved)); setMsg('Copied to clipboard'); } catch { setMsg('Copy failed. Select the text and copy it manually.'); } };

  return (
    <section className="space-y-3 rounded-lg border border-line bg-white p-4" aria-label="Incident report">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Incident report</h2>
        {!form && <button onClick={generate} disabled={busy} className="rounded border border-brand px-3 py-2 text-sm font-medium text-brand disabled:opacity-50">
          {busy ? 'Generating…' : saved ? 'Generate new draft' : 'Generate draft'}</button>}
      </div>
      {err && <p role="alert" className="text-sm text-crit">{err}</p>}
      {form ? (
        <form onSubmit={save} className="space-y-3 text-sm">
          <p className="rounded border border-amber-200 bg-amber-50 p-2 text-warn">Draft built from the recorded incident details. Review and edit every section before saving.</p>
          {SECTIONS.map(([k, label]) => (
            <label key={k} className="block"><span className="mb-1 block font-medium">{label}</span>
              <textarea className={inputCls} rows={k === 'investigation' ? 5 : 2} value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></label>))}
          <div className="flex gap-2"><button className="rounded bg-brand px-4 py-2 font-medium text-white">Save report</button>
            <button type="button" onClick={() => setForm(null)} className="rounded border border-line px-4 py-2">Discard draft</button></div>
        </form>
      ) : saved ? (
        <div className="space-y-3 text-sm">
          {SECTIONS.map(([k, label]) => <div key={k}><h3 className="font-medium">{label}</h3><p className="whitespace-pre-line">{saved[k] || '—'}</p></div>)}
          <div className="flex gap-2"><button onClick={() => setForm(saved)} className="rounded border border-line px-3 py-2">Edit report</button>
            <button onClick={copy} className="rounded border border-line px-3 py-2">Copy as text</button></div>
        </div>
      ) : <p className="text-sm text-slate-600">No report yet. Generate a draft, edit it, then save.</p>}
      <p role="status" className="text-sm text-slate-600">{msg}</p>
    </section>
  );
}
