import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { api } from '../api.js';
const nav = [['/', 'Dashboard'], ['/incidents', 'Incidents'], ['/systems', 'Systems'], ['/knowledge', 'Knowledge base'], ['/settings', 'Settings']];
export default function Layout() {
  const [name, setName] = useState('');
  useEffect(() => { api('/settings').then((d) => setName(d.settings.technician_name)).catch(() => {}); }, []);
  return (
    <div className="min-h-screen md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-2 focus:bg-white">Skip to content</a>
      <aside className="bg-rail text-slate-200 md:w-56 md:min-h-screen shrink-0">
        <div className="px-5 py-4 font-semibold text-white">IT Operations Center</div>
        <nav aria-label="Primary" className="flex md:block overflow-x-auto px-2 pb-2">
          {nav.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) =>
              `block whitespace-nowrap rounded px-3 py-2 text-sm ${isActive ? 'bg-white/15 text-white font-medium' : 'hover:bg-white/10'}`}>{label}</NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex-1 min-w-0">
        <header className="flex items-center justify-between border-b border-line bg-white px-6 py-3">
          <span className="text-sm text-slate-600">Service desk · Production</span>
          <span className="text-sm font-medium">{name}</span>
        </header>
        <main id="main" className="p-6"><Outlet context={{ setTechnician: setName }} /></main>
      </div>
    </div>
  );
}
