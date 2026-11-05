import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { askConfirm, Field, Icon, SelectField, Sheet, Stepper, TopBar, showSnack } from '../components';
import { useCatalog } from '../hooks';
import { useT, translate, usePrefs } from '../i18n';
import { formatBaht, formatGrams, formatKcal, parseBahtToSatang, parseNumber, roundTo } from '../../engine/format';
import { deleteItem, deleteRecipe, duplicateRecipe, patchRecipe, restoreItem, saveItem } from '../../data/repo';
import { validateRecipe } from '../../engine/validate';
import type { Recipe, RecipeItem } from '../../engine/types';
import type { LineResult } from '../../engine/calc';
import { AddItemSheet } from './AddItemSheet';

const bahtText = (s: number | null | undefined) => (s === null || s === undefined || s === 0 ? '' : String(roundTo(s / 100, 2)));

function draftOf(recipe: Recipe, isNew: boolean): Record<string, string> {
  return {
    name: isNew ? '' : recipe.name, servingLabel: recipe.servingLabel === 'serve' ? '' : recipe.servingLabel,
    cookedWeightG: recipe.cookedWeightG ? String(recipe.cookedWeightG) : '', batchExtraCost: bahtText(recipe.batchExtraCost),
    perServeExtraCost: bahtText(recipe.perServeExtraCost), targetFoodCostPct: recipe.targetFoodCostPct ? String(recipe.targetFoodCostPct) : '',
    sellPrice: bahtText(recipe.sellPrice), notes: recipe.notes ?? '',
  };
}

export function RecipeEditor() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const { t, unit: unitLabel, cat } = useT();
  const { catalog, calc } = useCatalog();
  const recipe = id ? catalog?.recipes.get(id) : undefined;

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [sheet, setSheet] = useState<{ open: boolean; editing: RecipeItem | null }>({ open: false, editing: null });
  const [menu, setMenu] = useState(false);
  const loaded = useRef<string | null>(null);

  // load draft strings once per recipe
  useEffect(() => {
    if (!recipe || loaded.current === recipe.id) return;
    loaded.current = recipe.id;
    setDraft(draftOf(recipe, !!params.get('new')));
  }, [recipe, params]);

  // D-03: reload text drafts when the recipe changes from elsewhere (Sheet sync), not after our own saves.
  const mine = useRef(new Set<string>());
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (!recipe || loaded.current !== recipe.id) return;
    if (seen.current === null) { seen.current = recipe.updatedAt; return; }
    if (recipe.updatedAt === seen.current) return;
    seen.current = recipe.updatedAt;
    if (mine.current.has(recipe.updatedAt)) return;
    setDraft(draftOf(recipe, false));
  }, [recipe]);

  // open sheet with a just-created ingredient (returned from S6)
  const addId = params.get('add');
  useEffect(() => {
    if (addId && catalog?.ingredients.get(addId)) setSheet({ open: true, editing: null });
  }, [addId, catalog]);

  if (!catalog || !calc) return null;
  if (!recipe || recipe.deleted) return <div className="screen"><TopBar title="" back="/" /></div>;

  const res = calc.evaluate(recipe.id)!;
  const items = res.lines;
  const label = recipe.servingLabel === 'serve' ? (usePrefs.getState().lang === 'th' ? 'serve' : 'serving') : recipe.servingLabel;
  const errors = validateRecipe({ ...recipe, name: draft.name ?? recipe.name });

  const patch = (p: Partial<Recipe>) => patchRecipe(recipe.id, p).then((r) => { if (r) mine.current.add(r.updatedAt); return r; });
  const commit = (key: string) => {
    const v = (draft[key] ?? '').trim();
    switch (key) {
      case 'name': if (v) void patch({ name: v }); break;
      case 'servingLabel': void patch({ servingLabel: v || 'serve' }); break;
      case 'cookedWeightG': { const n = parseNumber(v); void patch({ cookedWeightG: n && n > 0 ? n : null }); break; }
      case 'batchExtraCost': void patch({ batchExtraCost: parseBahtToSatang(v) ?? 0 }); break;
      case 'perServeExtraCost': void patch({ perServeExtraCost: parseBahtToSatang(v) ?? 0 }); break;
      case 'targetFoodCostPct': { const n = parseNumber(v); void patch({ targetFoodCostPct: n && n >= 1 && n <= 100 ? n : null }); break; }
      case 'sellPrice': void patch({ sellPrice: parseBahtToSatang(v) }); break;
      case 'notes': void patch({ notes: v }); break;
    }
  };
  const bind = (key: string) => ({ value: draft[key] ?? '', onChange: (v: string) => setDraft((d) => ({ ...d, [key]: v })), onBlur: () => commit(key) });

  const removeLine = async (it: RecipeItem, name: string) => {
    const removed = await deleteItem(it.id);
    setSheet({ open: false, editing: null });
    if (removed) showSnack(t('removed', { name }), { label: t('undo'), run: () => void restoreItem(removed) });
  };

  const onSaveItem = async (v: Parameters<React.ComponentProps<typeof AddItemSheet>['onSave']>[0]) => {
    if (sheet.editing) await saveItem({ ...sheet.editing, ...v });
    else await saveItem({ ...v, recipeId: recipe.id, sortOrder: (items.at(-1)?.item.sortOrder ?? 0) + 1 });
    setSheet({ open: false, editing: null });
    if (addId) { params.delete('add'); setParams(params, { replace: true }); }
  };

  const issueText = (l: LineResult) => l.issues.map((i) => t(`issue_${i}` as never)).join(' · ');
  const ps = res.perServe.nutrients;
  const incomplete = !res.costComplete || !res.nutritionComplete;

  return (
    <div className="screen with-summary">
      <TopBar title={t('editRecipe')} back="/" actions={
        <button className="icon-btn" aria-label={t('more')} onClick={() => setMenu(true)}><Icon name="more" /></button>
      } />

      <div className="pad stack">
        <Field label={t('recipeName')} {...bind('name')} placeholder={recipe.name} autoFocus={!!params.get('new')}
          error={errors.some((e) => e.field === 'name') && !params.get('new') ? t('v_required') : undefined} testId="recipe-name" />
        <div className="stepper-card">
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span className="small muted">{t('makesPerBatch')}</span>
            <input aria-label={t('servingUnit')} value={draft.servingLabel ?? ''} placeholder={label}
              onChange={(e) => setDraft((d) => ({ ...d, servingLabel: e.target.value }))} onBlur={() => commit('servingLabel')}
              style={{ border: 'none', outline: 'none', background: 'transparent', fontWeight: 600, fontSize: 15, padding: 0, width: 110 }} data-testid="serving-label" />
          </div>
          <Stepper value={recipe.servings} onChange={(n) => void patch({ servings: n })} label={t('makesPerBatch')} testId="servings" />
        </div>
        <SelectField label={t('category')} value={recipe.category ?? ''} onChange={(v) => void patch({ category: v || undefined })}
          options={[{ value: '', label: '—' }, ...t('recipeCats').split('|').map((c) => ({ value: c, label: cat(c) }))]} />
      </div>

      <div className="section-head">
        <span className="h">{t('ingredients')} ({items.length})</span>
        <span className="small muted">{t('totalCost')} <span className="num" style={{ fontWeight: 600, color: 'var(--money)' }}>{formatBaht(res.ingredientCostSatang)}{res.costComplete ? '' : '+'}</span></span>
      </div>

      <ul className="list pad">
        {items.map((l) => (
          <SwipeLine key={l.item.id} onDelete={() => void removeLine(l.item, l.name)} label={t('delete')}>
            <button className="line" onClick={() => setSheet({ open: true, editing: l.item })} data-testid="item-line">
              <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="name">{l.item.refType === 'recipe' && <Icon name="book" size={14} />} {l.name || '—'}</span>
                <span className="small muted" style={l.issues.length ? { color: 'var(--warn)' } : undefined}>
                  {l.issues.length ? <><Icon name="warn" size={12} /> {issueText(l)}</> : lineHint(l)}
                </span>
              </div>
              <span className="qty num">{formatGrams(l.item.quantity, 2)} {unitLabel(l.item.unit)}</span>
              <span className="money num">{l.costSatang === null ? '—' : formatBaht(l.costSatang)}</span>
            </button>
          </SwipeLine>
        ))}
        <li><button className="dashed-btn" onClick={() => setSheet({ open: true, editing: null })} data-testid="add-item"><Icon name="plus" size={18} strokeWidth={2.4} />{t('addIngredient')}</button></li>
        {items.length > 1 && <li className="small muted" style={{ textAlign: 'center' }}>{t('dragHint')}</li>}
      </ul>

      <div className="pad" style={{ paddingTop: 16 }}>
        <details className="disclosure">
          <summary>{t('extras')}<Icon name="chevron" size={18} /></summary>
          <div className="body">
            <Field inset label={t('cookedWeight')} hint={t('cookedWeightHint')} numeric suffix="g" {...bind('cookedWeightG')} />
            <Field inset label={t('batchExtra')} hint={t('batchExtraHint')} numeric {...bind('batchExtraCost')} />
            <Field inset label={t('perServeExtra')} hint={t('perServeExtraHint')} numeric {...bind('perServeExtraCost')} />
            <Field inset label={t('targetFoodCost')} hint={t('targetFoodCostHint', { n: catalog.settings.defaultFoodCostPct })} numeric suffix="%" {...bind('targetFoodCostPct')} />
            <Field inset label={t('sellPrice')} numeric {...bind('sellPrice')} testId="sell-price" />
            <div className="field inset">
              <label className="label" htmlFor="notes">{t('notes')}</label>
              <textarea id="notes" value={draft.notes ?? ''} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} onBlur={() => commit('notes')} />
            </div>
          </div>
        </details>
      </div>

      <section className="summary" aria-label={t('perServe', { label })} data-testid="summary">
        <div className="between" style={{ alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="l">{t('perServe', { label })}</span>
            <span className="big num" data-testid="kcal-per-serve">{formatKcal(ps.kcal)} <span className="unit">kcal</span></span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span className="l">{t('cost')}</span>
            <span className="big num money" data-testid="cost-per-serve">{formatBaht(res.perServe.costSatang)}</span>
          </div>
        </div>
        <div className="macro-bar" aria-hidden="true">
          <span className="mp" style={{ width: `${res.energySplit.protein}%` }} />
          <span className="mc" style={{ width: `${res.energySplit.carb}%` }} />
          <span className="mf" style={{ width: `${res.energySplit.fat}%` }} />
        </div>
        <div className="between">
          <div className="macro-legend num">
            <span><span className="k" style={{ color: '#7FB2FF' }}>P</span> {formatGrams(ps.protein)}g</span>
            <span><span className="k" style={{ color: '#F2C14E' }}>C</span> {formatGrams(ps.carb)}g</span>
            <span><span className="k" style={{ color: '#FF8FA0' }}>F</span> {formatGrams(ps.fat)}g</span>
          </div>
          <Link to={`/recipe/${recipe.id}/result`} className="btn tonal sm" style={{ background: '#C3E3C4', color: '#10301A' }} data-testid="view-result">{t('viewDetail')}<Icon name="next" size={16} strokeWidth={2.4} /></Link>
        </div>
        {incomplete && items.length > 0 && <span className="warn"><Icon name="warn" size={14} />{t('incomplete')}</span>}
      </section>

      <AddItemSheet open={sheet.open} onClose={() => setSheet({ open: false, editing: null })} catalog={catalog} calc={calc} recipeId={recipe.id}
        editing={sheet.editing} preselect={addId} onSave={onSaveItem}
        onRemove={sheet.editing ? () => void removeLine(sheet.editing!, items.find((l) => l.item.id === sheet.editing!.id)?.name ?? '') : undefined} />

      <Sheet open={menu} onClose={() => setMenu(false)} title={recipe.name}>
        <button className="pick" onClick={async () => { setMenu(false); const c = await duplicateRecipe(recipe.id, { name: t('copyOf', { name: recipe.name }) }); if (c) nav(`/recipe/${c.id}`); }}>
          <Icon name="copy" size={20} />{t('duplicate')}
        </button>
        <button className="pick" style={{ color: 'var(--danger)' }} data-testid="delete-recipe"
          onClick={async () => { setMenu(false); if (await askConfirm(t('confirmDeleteRecipe', { name: recipe.name }), t('delete'))) { await deleteRecipe(recipe.id); nav('/'); } }}>
          <Icon name="trash" size={20} />{t('deleteRecipe')}
        </button>
      </Sheet>
    </div>
  );
}

function lineHint(l: LineResult) {
  if (l.item.refType === 'recipe') return translate(usePrefs.getState().lang, 'subRecipe');
  if (Math.abs(l.purchasedGrams - l.netGrams) > 0.01) return `${formatGrams(l.netGrams)} g → ${formatGrams(l.purchasedGrams)} g`;
  return l.nutrients ? `${formatKcal(l.nutrients.kcal)} kcal` : '';
}

/** Swipe left to delete (doc section 8 UX rules) with a visible delete fallback in the item sheet. */
function SwipeLine({ children, onDelete, label }: { children: React.ReactNode; onDelete: () => void; label: string }) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiping = useRef(false);
  return (
    <li className="swipe-wrap"
      onTouchStart={(e) => { start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; swiping.current = false; }}
      onTouchMove={(e) => {
        if (!start.current) return;
        const x = e.touches[0].clientX - start.current.x;
        const y = e.touches[0].clientY - start.current.y;
        if (!swiping.current && Math.abs(x) > 10 && Math.abs(x) > Math.abs(y)) swiping.current = true;
        if (swiping.current) setDx(Math.min(0, x));
      }}
      onTouchEnd={() => { if (dx < -100) onDelete(); setDx(0); start.current = null; }}
      onClickCapture={(e) => { if (swiping.current) { e.stopPropagation(); e.preventDefault(); swiping.current = false; } }}>
      <div className="swipe-bg" aria-hidden="true">{label}</div>
      <div style={{ transform: `translateX(${dx}px)`, transition: dx ? 'none' : 'transform .15s' }}>{children}</div>
    </li>
  );
}
