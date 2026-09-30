import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import Field, { inputCls } from '../components/Field.jsx';

export default function ArticleForm() {
  const nav = useNavigate(), [params] = useSearchParams(), incidentId = params.get('incident');
  const [f, setF] = useState({ title: '', symptoms: '', causes: '', diagnostic_steps: '', resolution: '' });
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  useEffect(() => {
    if (!incidentId) return;
    api(`/incidents/${incidentId}`).then((i) => setF({
      title: i.title, symptoms: i.description || '', causes: '', resolution: i.resolution || '',
      diagnostic_steps: i.events.filter((e) => e.type === 'action').map((e) => e.message).join('\n'),
    })).catch((e) => setErr(e.message));
  }, [incidentId]);
  const submit = async (e) => {
    e.preventDefault();
    try { const a = await api('/articles', { method: 'POST', body: { ...f, incident_id: incidentId ? Number(incidentId) : undefined } }); nav(`/knowledge/${a.id}`); }
    catch (x) { setErr(x.message); }
  };
  const area = (k, label, hint) => <Field label={label}><textarea className={inputCls} rows={3} value={f[k]} onChange={set(k)} placeholder={hint} /></Field>;
  return (
    <form onSubmit={submit} className="max-w-3xl space-y-3 rounded-lg border border-line bg-white p-6">
      <h1 className="text-2xl font-semibold">{incidentId ? `New article from INC-${incidentId}` : 'New article'}</h1>
      {incidentId && <p className="text-sm text-slate-600">Prefilled from the incident. Edit anything before saving.</p>}
      {err && <p role="alert" className="text-crit text-sm">{err}</p>}
      <Field label="Title"><input className={inputCls} value={f.title} onChange={set('title')} required /></Field>
      {area('symptoms', 'Symptoms', 'One per line')}
      {area('causes', 'Possible causes', 'One per line')}
      {area('diagnostic_steps', 'Diagnostic steps', 'One step per line')}
      {area('resolution', 'Resolution')}
      <div className="flex gap-2"><button className="rounded bg-brand px-4 py-2 text-sm font-medium text-white">Save article</button>
        <Link to="/knowledge" className="rounded border border-line px-4 py-2 text-sm">Cancel</Link></div>
    </form>
  );
}
