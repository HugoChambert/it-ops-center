import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, PRIORITIES } from '../api.js';
import Field, { inputCls } from '../components/Field.jsx';

export default function Settings() {
  const { setTechnician } = useOutletContext();
  const [data, setData] = useState(null), [form, setForm] = useState(null), [err, setErr] = useState(null), [msg, setMsg] = useState('');
  useEffect(() => { api('/settings').then((d) => { setData(d); setForm(d.settings); }).catch((e) => setErr(e.message)); }, []);
  const save = async (e) => {
    e.preventDefault(); setErr(null); setMsg('');
    try { const d = await api('/settings', { method: 'PUT', body: form }); setData(d); setForm(d.settings); setTechnician(d.settings.technician_name); setMsg('Settings saved'); }
    catch (x) { setErr(x.message); }
  };
  if (!form) return err ? <p role="alert" className="text-crit">Could not load settings: {err}</p> : <p>Loading settings…</p>;
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <form onSubmit={save} className="space-y-3 rounded-lg border border-line bg-white p-4">
        <h2 className="font-semibold">Preferences</h2>
        {err && <p role="alert" className="text-sm text-crit">{err}</p>}
        <Field label="Your name"><input className={inputCls} value={form.technician_name} onChange={(e) => setForm({ ...form, technician_name: e.target.value })} /></Field>
        <p className="-mt-2 text-xs text-slate-600">Shown in the header and recorded on new timeline entries.</p>
        <Field label="Default priority for new incidents"><select className={inputCls} value={form.default_priority} onChange={(e) => setForm({ ...form, default_priority: e.target.value })}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
        <div className="flex items-center gap-3"><button className="rounded bg-brand px-4 py-2 text-sm font-medium text-white">Save settings</button>
          <span role="status" className="text-sm text-ok">{msg}</span></div>
      </form>
      <section className="space-y-2 rounded-lg border border-line bg-white p-4 text-sm">
        <h2 className="font-semibold">AI provider</h2>
        <dl className="grid grid-cols-2 gap-2">
          <dt className="text-slate-600">Provider</dt><dd>{data.ai.provider}</dd>
          <dt className="text-slate-600">API key</dt><dd>{data.ai.keyConfigured ? 'Configured' : 'Not set'}</dd>
          <dt className="text-slate-600">Version</dt><dd>{data.app.version}</dd>
        </dl>
        <p className="text-slate-600">To change the provider or key, edit the <code>.env</code> file (see <code>.env.example</code>) and restart the app.</p>
      </section>
    </div>
  );
}
