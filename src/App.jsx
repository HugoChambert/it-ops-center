import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Incidents from './pages/Incidents.jsx';
import IncidentDetail from './pages/IncidentDetail.jsx';
import Systems from './pages/Systems.jsx';
import Knowledge from './pages/Knowledge.jsx';
import ArticleView from './pages/ArticleView.jsx';
import ArticleForm from './pages/ArticleForm.jsx';
import Settings from './pages/Settings.jsx';
import Performance from './pages/Performance.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="incidents" element={<Incidents />} />
        <Route path="incidents/:id" element={<IncidentDetail />} />
        <Route path="systems" element={<Systems />} />
        <Route path="knowledge" element={<Knowledge />} />
        <Route path="knowledge/new" element={<ArticleForm />} />
        <Route path="knowledge/:id" element={<ArticleView />} />
        <Route path="performance" element={<Performance />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
