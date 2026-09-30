import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { inputCls } from '../components/Field.jsx';

export default function Knowledge() {
  const [rows, setRows] = useState(null), [q, setQ] = useState(''), [err, setErr] = useState(null);
  useEffect(() => { api(`/articles${q ? `?q=${encodeURIComponent(q)}` : ''}`).then((d) => { setRows(d); setErr(null); }).catch((e) => setErr(e.message)); }, [q]);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-semibold">Knowledge base</h1>
        <Link to="/knowledge/new" className="rounded bg-brand px-4 py-2 text-sm font-medium text-white">New article</Link></div>
      <input aria-label="Search articles" placeholder="Search articles" className={`${inputCls} sm:w-96`} value={q} onChange={(e) => setQ(e.target.value)} />
      {err && <p role="alert" className="text-crit">Could not load articles: {err}</p>}
      {rows && rows.length === 0 && <p className="text-sm text-slate-600">No articles match your search. Try different words, or write a new article.</p>}
      <ul className="space-y-3">{rows?.map((a) => (
        <li key={a.id} className="rounded-lg border border-line bg-white p-4">
          <Link className="font-semibold text-brand underline" to={`/knowledge/${a.id}`}>{a.title}</Link>
          <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-slate-600">{a.symptoms}</p>
        </li>))}</ul>
    </div>
  );
}
