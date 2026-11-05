import { useEffect } from 'react';
import { HashRouter, MemoryRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { ConfirmHost, SnackbarHost, showSnack } from './ui/components';
import { applyTheme, translate, usePrefs } from './ui/i18n';
import { useSync } from './data/sync';
import { RecipesList } from './ui/screens/RecipesList';
import { RecipeEditor } from './ui/screens/RecipeEditor';
import { RecipeResult } from './ui/screens/RecipeResult';
import { Shopping } from './ui/screens/Shopping';
import { IngredientsList } from './ui/screens/IngredientsList';
import { IngredientEditor } from './ui/screens/IngredientEditor';
import { StarterImport } from './ui/screens/StarterImport';
import { Settings } from './ui/screens/Settings';

/** The claude.ai preview frame does not allow #/path hashes, so the preview build keeps routes in memory. */
const Router = import.meta.env.VITE_PREVIEW ? MemoryRouter : HashRouter;

/** D-04: a fresh editor per item, so no state from the previous item can leak into the next one. */
function Keyed({ el: El, perVisit }: { el: () => React.ReactElement | null; perVisit?: boolean }) {
  const { id } = useParams();
  const loc = useLocation();
  // perVisit: remount on every navigation, even new → (save) → new in quick succession
  return <El key={perVisit ? `${id}:${loc.key}` : id} />;
}

export default function App() {
  const theme = usePrefs((p) => p.theme);
  const lang = usePrefs((p) => p.lang);
  const conflicts = useSync((s) => s.conflicts);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = () => applyTheme('system');
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [theme]);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => {
    if (conflicts.length) showSnack(translate(usePrefs.getState().lang, 'conflictMsg', { n: conflicts.length }));
  }, [conflicts]);

  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<RecipesList />} />
          <Route path="/recipe/:id" element={<Keyed el={RecipeEditor} />} />
          <Route path="/recipe/:id/result" element={<RecipeResult />} />
          <Route path="/recipe/:id/shop" element={<Shopping />} />
          <Route path="/ingredients" element={<IngredientsList />} />
          <Route path="/ingredient/:id" element={<Keyed el={IngredientEditor} perVisit />} />
          <Route path="/starter" element={<StarterImport />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <SnackbarHost />
        <ConfirmHost />
      </div>
    </Router>
  );
}
