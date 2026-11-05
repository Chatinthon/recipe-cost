import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BottomNav, Empty, Icon, RecipeThumb, SyncPill } from '../components';
import { useCatalog } from '../hooks';
import { useT } from '../i18n';
import { formatBaht, formatKcal } from '../../engine/format';
import { saveRecipe } from '../../data/repo';
import { syncNow } from '../../data/sync';

export function RecipesList() {
  const { t, cat } = useT();
  const { catalog, calc } = useCatalog();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<string>('');
  const [pull, setPull] = useState(0);
  const startY = useRef<number | null>(null);

  const recipes = catalog ? [...catalog.recipes.values()].filter((r) => !r.deleted) : [];
  const cats = [...new Set(recipes.map((r) => r.category).filter(Boolean))] as string[];
  const needle = q.trim().toLowerCase();
  const shown = recipes
    .filter((r) => !filter || r.category === filter)
    .filter((r) => {
      if (!needle) return true;
      if (r.name.toLowerCase().includes(needle)) return true;
      // also match by ingredient name
      return (catalog!.itemsByRecipe.get(r.id) ?? []).some((it) => {
        const ing = catalog!.ingredients.get(it.refId);
        return ing && `${ing.nameTh} ${ing.nameEn ?? ''}`.toLowerCase().includes(needle);
      });
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const create = async () => {
    const r = await saveRecipe({ name: t('newRecipe'), servings: 1, servingLabel: 'serve', batchExtraCost: 0, perServeExtraCost: 0 });
    nav(`/recipe/${r.id}?new=1`);
  };

  // pull to refresh (FR-30)
  const onTouchStart = (e: React.TouchEvent) => { if (window.scrollY <= 0) startY.current = e.touches[0].clientY; };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    const d = e.touches[0].clientY - startY.current;
    setPull(d > 0 ? Math.min(d, 100) : 0);
  };
  const onTouchEnd = () => {
    if (pull > 70) void syncNow();
    startY.current = null;
    setPull(0);
  };

  return (
    <div className="screen with-nav" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div className="ptr" style={{ height: pull ? pull * 0.5 : 0 }} aria-hidden="true">{pull > 70 ? t('releaseToRefresh') : t('pullToRefresh')}</div>
      <header className="home-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="muted" style={{ fontSize: 13 }}>{t('hello')}</span>
          <h1>{t('myRecipes')}</h1>
        </div>
        <SyncPill />
      </header>

      <div className="pad" style={{ padding: '8px 20px 12px' }}>
        <label className="search">
          <Icon name="search" size={20} />
          <span className="sr-only">{t('searchRecipe')}</span>
          <input placeholder={t('searchRecipe')} value={q} onChange={(e) => setQ(e.target.value)} type="search" />
        </label>
      </div>

      {cats.length > 0 && (
        <div className="chips pad" style={{ paddingBottom: 16 }}>
          <button className="chip" aria-pressed={!filter} onClick={() => setFilter('')}>{t('all')}</button>
          {cats.map((c) => <button key={c} className="chip" aria-pressed={filter === c} onClick={() => setFilter(c)}>{cat(c)}</button>)}
        </div>
      )}

      {catalog && recipes.length === 0 && (
        <Empty icon="book" title={t('noRecipes')} hint={t('noRecipesHint')}
          action={<button className="btn" onClick={create}><Icon name="plus" size={20} />{t('createFirstRecipe')}</button>} />
      )}

      <main className="pad stack">
        {calc && shown.map((r) => {
          const res = calc.evaluate(r.id)!;
          const items = catalog!.itemsByRecipe.get(r.id) ?? [];
          const missingPrice = res.lines.filter((l) => l.costSatang === null).length;
          return (
            <Link key={r.id} to={`/recipe/${r.id}`} className="recipe-card" data-testid="recipe-card">
              <RecipeThumb category={r.category} name={r.name} />
              <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{r.name}</span>
                <span className="muted" style={{ fontSize: 13 }}>{r.servings} {r.servingLabel} · {t('itemsCount', { n: items.length })}</span>
                <div className="badges">
                  {items.length > 0 && <span className="badge kcal num">{res.nutritionComplete ? '' : '≥ '}{formatKcal(res.perServe.nutrients.kcal)} kcal</span>}
                  {items.length > 0 && missingPrice === 0 && <span className="badge money num">{formatBaht(res.perServe.costSatang)} {t('per', { label: r.servingLabel })}</span>}
                  {missingPrice > 0 && <span className="badge warn"><Icon name="warn" size={14} />{t('missingPrice', { n: missingPrice })}</span>}
                </div>
              </div>
            </Link>
          );
        })}
      </main>

      {recipes.length > 0 && (
        <button className="fab" onClick={create} data-testid="fab-new-recipe"><Icon name="plus" size={20} strokeWidth={2.4} />{t('newRecipe')}</button>
      )}
      <BottomNav />
    </div>
  );
}
