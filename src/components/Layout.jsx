import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { api } from '../api.js';

// ---------------------------------------------------------------------------
// Inline SVG icons — aria-hidden, sized to 1em so they scale with text
// All paths use currentColor so they inherit the link's text colour
// ---------------------------------------------------------------------------
function Icon({ d, d2, viewBox = '0 0 20 20' }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox={viewBox} className="h-4 w-4 shrink-0 fill-none stroke-current" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
      {d2 && <path d={d2} />}
    </svg>
  );
}

const NAV_ITEMS = [
  {
    to: '/', label: 'Dashboard', end: true,
    icon: <Icon d="M3 10.5 10 3l7 7.5V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6.5Z" d2="M7 18v-6h6v6" />,
  },
  {
    to: '/incidents', label: 'Incidents',
    icon: <Icon d="M10 2a8 8 0 1 0 0 16A8 8 0 0 0 10 2Zm0 4v4l3 2" />,
  },
  {
    to: '/systems', label: 'Systems',
    icon: <Icon d="M2 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Z" d2="M6 10h.01M10 10h.01M14 10h.01" />,
  },
  {
    to: '/knowledge', label: 'Knowledge base',
    icon: <Icon d="M4 4h12v12H4zM4 9h12M9 9v7" />,
  },
  {
    to: '/performance', label: 'Performance',
    icon: <Icon d="M3 15l4-5 4 3 4-7 3 4" />,
  },
  {
    to: '/settings', label: 'Settings',
    icon: <Icon d="M10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6.3-1.7a6.5 6.5 0 0 0 .2-1.3 6.5 6.5 0 0 0-.2-1.3l1.4-1.1a.5.5 0 0 0 .1-.6l-1.3-2.3a.5.5 0 0 0-.6-.2l-1.7.7a6.6 6.6 0 0 0-1.1-.6l-.3-1.8A.5.5 0 0 0 12 2H8a.5.5 0 0 0-.5.4l-.3 1.8a6.6 6.6 0 0 0-1.1.6l-1.7-.7a.5.5 0 0 0-.6.2L2.5 7.1a.5.5 0 0 0 .1.6l1.4 1.1a6.5 6.5 0 0 0-.2 1.3 6.5 6.5 0 0 0 .2 1.3L2.6 12.5a.5.5 0 0 0-.1.6l1.3 2.3a.5.5 0 0 0 .6.2l1.7-.7c.3.2.7.4 1.1.6l.3 1.8c.1.2.3.4.5.4h4c.2 0 .4-.2.5-.4l.3-1.8a6.6 6.6 0 0 0 1.1-.6l1.7.7a.5.5 0 0 0 .6-.2l1.3-2.3a.5.5 0 0 0-.1-.6l-1.4-1.1Z" />,
  },
];

// Simple 2×2 grid logo mark
function LogoMark() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20" className="h-6 w-6 shrink-0">
      <rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9" />
      <rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9" />
      <rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9" />
      <rect x="11" y="11" width="3" height="7" rx="1" fill="currentColor" opacity="0.9" />
      <rect x="15" y="14" width="3" height="4" rx="1" fill="currentColor" />
    </svg>
  );
}

export default function Layout() {
  const [name, setName] = useState('');
  useEffect(() => { api('/settings').then((d) => setName(d.settings.technician_name)).catch(() => {}); }, []);
  return (
    <div className="min-h-screen md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-white focus:text-brand">Skip to content</a>
      <aside className="bg-rail text-slate-200 md:w-56 md:min-h-screen shrink-0">
        {/* Logo + app name */}
        <div className="flex items-center gap-2.5 px-4 py-4 text-white">
          <LogoMark />
          <span className="font-semibold leading-tight text-sm">IT Operations<br />Center</span>
        </div>
        <nav aria-label="Primary" className="flex md:block overflow-x-auto px-2 pb-3">
          {NAV_ITEMS.map(({ to, label, end, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 whitespace-nowrap rounded px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white font-medium'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {icon}
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex-1 min-w-0">
        {import.meta.env.VITE_DEMO_BANNER === 'true' && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-1.5 text-center text-xs text-amber-800">
            Demo environment: data resets periodically
          </div>
        )}
        <header className="flex items-center justify-between border-b border-line bg-white px-6 py-3">
          <span className="text-sm text-slate-500">Service desk · Production</span>
          <span className="text-sm font-medium">{name}</span>
        </header>
        <main id="main" className="p-6"><Outlet context={{ setTechnician: setName }} /></main>
      </div>
    </div>
  );
}
