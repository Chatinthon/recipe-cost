import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BottomNav, Empty, Icon, SyncPill } from '../components';
import { useCatalog } from '../hooks';
import { useT } from '../i18n';
import { costPerGram } from '../../engine/calc';
import { formatBaht } from '../../engine/format';

export function IngredientsList() {
  const { t, cat } = useT();
  const { catalog } = useCatalog();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  if (!catalog) return null;
  const all = [...catalog.ingredients.values()].filter((i) => !i.deleted);
  const cats = [...new Set(all.map((i) => i.category).filter(Boolean))] as string[];
  const needle = q.trim().toLowerCase();
  const shown = all
    .filter((i) => !filter || i.category === filter)
    .filter((i) => !needle || `${i.nameTh} ${i.nameEn ?? ''}`.toLowerCase().includes(needle))
    .sort((a, b) => a.nameTh.localeCompare(b.nameTh, 'th'));

  return (
    <div className="screen with-nav">
      <header className="home-head">
        <h1>{t('ingredients')}</h1>
        <SyncPill />
      </header>
      <div className="pad" style={{ padding: '8px 20px 12px' }}>
        <label className="search">
          <Icon name="search" size={20} />
          <span className="sr-only">{t('searchIngredient')}</span>
          <input placeholder={t('searchIngredient')} value={q} onChange={(e) => setQ(e.target.value)} type="search" />
        </label>
      </div>
      {cats.length > 0 && (
        <div className="chips pad" style={{ paddingBottom: 12 }}>
          <button className="chip" aria-pressed={!filter} onClick={() => setFilter('')}>{t('all')}</button>
          {cats.map((c) => <button key={c} className="chip" aria-pressed={filter === c} onClick={() => setFilter(c)}>{cat(c)}</button>)}
        </div>
      )}
      {all.length === 0 && (
        <Empty icon="basket" title={t('noIngredients')} hint={t('noIngredientsHint')}
          action={<div className="stack" style={{ width: '100%' }}>
            <Link to="/ingredient/new" className="btn"><Icon name="plus" size={20} />{t('newIngredient')}</Link>
            <Link to="/starter" className="btn outline">{t('importStarter')}</Link>
          </div>} />
      )}
      <ul className="list pad">
        {shown.map((i) => {
          const c = costPerGram(i, catalog);
          const perUnit = i.packUnit === 'piece' && i.gramsPerPiece && c.value !== null
            ? `${formatBaht(c.value * i.gramsPerPiece)} / ${t('u_piece')}`
            : c.value !== null ? `${formatBaht(c.value * 1000)} / kg` : null;
          const issues = [c.value === null ? t('issue_missing_price') : '', !i.nutrition ? t('issue_missing_nutrition') : ''].filter(Boolean);
          return (
            <li key={i.id}>
              <Link to={`/ingredient/${i.id}`} className="line" style={{ textDecoration: 'none', color: 'inherit' }} data-testid="ingredient-row">
                <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="name">{i.nameTh}</span>
                  <span className="small muted" style={issues.length ? { color: 'var(--warn)' } : undefined}>
                    {issues.length ? <><Icon name="warn" size={12} /> {issues.join(' · ')}</> : i.nutrition ? `${Math.round(i.nutrition.kcal)} kcal / 100 ${i.baseUnit}` : ''}
                  </span>
                </div>
                {perUnit && <span className="money num">{perUnit}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
      {all.length > 0 && <Link to="/ingredient/new" className="fab" data-testid="fab-new-ingredient"><Icon name="plus" size={20} strokeWidth={2.4} />{t('newIngredient')}</Link>}
      <BottomNav />
    </div>
  );
}
