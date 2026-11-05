import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon, TopBar, showSnack } from '../components';
import { useCatalog } from '../hooks';
import { useT } from '../i18n';
import { STARTER, type StarterItem } from '../../usda/starter';
import { bestMatch, searchUsda, UsdaError, usdaSourceLabel, type UsdaFood } from '../../usda/usda';
import { getMeta, saveIngredient } from '../../data/repo';

type Row = { item: StarterItem; match: UsdaFood | null; status: 'idle' | 'ok' | 'notfound'; selected: boolean };

/** Q3 option 1: starter ingredients, values looked up live from USDA and reviewed before import. */
export function StarterImport() {
  const { t, lang } = useT();
  const nav = useNavigate();
  const { catalog } = useCatalog();
  const [key, setKey] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>(() => STARTER.map((item) => ({ item, match: null, status: 'idle', selected: true })));
  const [progress, setProgress] = useState<{ i: number; n: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void getMeta('usdaKey', '').then(setKey); }, []);

  const have = new Set(catalog ? [...catalog.ingredients.values()].filter((i) => !i.deleted).map((i) => i.nameTh) : []);

  const fetchAll = async () => {
    if (!key) return;
    setError(null);
    const todo = rows.filter((r) => r.status === 'idle' && !have.has(r.item.nameTh));
    for (let i = 0; i < todo.length; i++) {
      setProgress({ i: i + 1, n: todo.length });
      try {
        const foods = await searchUsda(todo[i].item.query, key, { pageSize: 5 });
        const m = bestMatch(todo[i].item.query, foods);
        setRows((rs) => rs.map((r) => (r.item.key === todo[i].item.key ? { ...r, match: m, status: m ? 'ok' : 'notfound', selected: !!m } : r)));
      } catch (e) {
        const code = e instanceof UsdaError ? e.code : 'network';
        setError(code === 'bad_key' ? t('usdaBadKey') : code === 'rate_limited' ? t('usdaRate') : t('usdaNetwork'));
        break;
      }
    }
    setProgress(null);
  };

  const ready = rows.filter((r) => r.status === 'ok' && r.selected && !have.has(r.item.nameTh));
  const doImport = async () => {
    for (const r of ready) {
      const it = r.item;
      await saveIngredient({
        nameTh: it.nameTh, nameEn: it.nameEn, category: it.category, baseUnit: it.baseUnit ?? 'g', buyMode: it.buyMode,
        packPrice: null, packSize: null, packUnit: it.packUnit ?? 'g', yieldPct: 100, gramsPerPiece: it.gramsPerPiece ?? null,
        densityGPerMl: it.densityGPerMl ?? null, nutrition: r.match!.nutrition, nutritionSource: usdaSourceLabel(r.match!),
      });
    }
    showSnack(t('starterDone', { n: ready.length }));
    nav('/ingredients');
  };

  return (
    <div className="screen">
      <TopBar title={t('starterTitle')} back="/ingredients" />
      <div className="pad stack">
        <p className="muted" style={{ margin: 0 }}>{t('starterIntro', { n: STARTER.length })}</p>
        {key === '' && <div className="note-warn"><Icon name="warn" size={18} /><span>{t('usdaNeedKey')} — <Link to="/settings#usda">{t('settings')}</Link></span></div>}
        {error && <div className="note-warn"><Icon name="warn" size={18} />{error}</div>}
        <div className="btn-row">
          <button className="btn outline" disabled={!key || !!progress} onClick={fetchAll} data-testid="starter-fetch">
            {progress ? t('starterFetching', progress) : t('starterFetch')}
          </button>
          <button className="btn" disabled={!ready.length || !!progress} onClick={doImport} data-testid="starter-import">{t('starterImport', { n: ready.length })}</button>
        </div>
        <ul className="list">
          {rows.map((r) => {
            const owned = have.has(r.item.nameTh);
            return (
              <li key={r.item.key} className="line" style={{ padding: '10px 14px' }}>
                <input type="checkbox" className="check" aria-label={r.item.nameTh} checked={r.selected && !owned && r.status !== 'notfound'}
                  disabled={owned || r.status !== 'ok'} onChange={(e) => setRows((rs) => rs.map((x) => (x.item.key === r.item.key ? { ...x, selected: e.target.checked } : x)))} />
                <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="name">{lang === 'en' ? r.item.nameEn : r.item.nameTh}</span>
                  <span className="small muted" lang="en">
                    {owned ? t('alreadyHave') : r.status === 'ok' ? `${r.match!.description} · ${Math.round(r.match!.nutrition.kcal)} kcal` : r.status === 'notfound' ? t('notFound') : r.item.query}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        <span className="small muted">{t('usdaAttribution')}</span>
      </div>
    </div>
  );
}
