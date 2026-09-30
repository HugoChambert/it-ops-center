import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';

const lines = (t) => t.split('\n').map((l) => l.trim()).filter(Boolean);
function Section({ title, text, ordered }) {
  if (!text) return null;
  const L = ordered ? 'ol' : 'ul';
  return (<section><h2 className="mb-1 font-semibold">{title}</h2>
    <L className={`${ordered ? 'list-decimal' : 'list-disc'} space-y-1 pl-5 text-sm`}>{lines(text).map((l, i) => <li key={i} className="break-words">{l}</li>)}</L></section>);
}
export default function ArticleView() {
  const { id } = useParams();
  const [a, setA] = useState(null), [err, setErr] = useState(null);
  useEffect(() => { api(`/articles/${id}`).then(setA).catch((e) => setErr(e.message)); }, [id]);
  if (err) return <p role="alert" className="text-crit">{err} <Link className="underline" to="/knowledge">Back to knowledge base</Link></p>;
  if (!a) return <p>Loading article…</p>;
  return (
    <article className="max-w-3xl space-y-5 rounded-lg border border-line bg-white p-6">
      <Link className="text-sm text-brand underline" to="/knowledge">Back to knowledge base</Link>
      <h1 className="text-2xl font-semibold">{a.title}</h1>
      <Section title="Symptoms" text={a.symptoms} />
      <Section title="Possible causes" text={a.causes} />
      <Section title="Diagnostic steps" text={a.diagnostic_steps} ordered />
      <Section title="Resolution" text={a.resolution} />
      <section><h2 className="mb-1 font-semibold">Related incidents</h2>
        {a.related_incidents.length === 0 ? <p className="text-sm text-slate-600">None linked.</p> :
          <ul className="space-y-1 text-sm">{a.related_incidents.map((i) => (
            <li key={i.id} className="flex items-center gap-2"><Link className="text-brand underline" to={`/incidents/${i.id}`}>INC-{i.id}: {i.title}</Link><StatusBadge value={i.status} /></li>))}</ul>}
      </section>
    </article>
  );
}
