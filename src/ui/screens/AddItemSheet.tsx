import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Field, Icon, Segmented, Sheet } from '../components';
import { useT } from '../i18n';
import type { Calculator } from '../../engine/calc';
import type { Catalog, QuantityBasis, RecipeItem, Unit } from '../../engine/types';
import { parseNumber } from '../../engine/format';

type Pick = { refType: 'ingredient' | 'recipe'; refId: string } | null;

const UNITS_FOR = (piece: boolean, volume: boolean): Unit[] => {
  const base: Unit[] = ['g', 'kg'];
  if (volume) base.push('ml', 'l');
  base.push('tsp', 'tbsp', 'cup');
  if (piece) base.push('piece');
  return base;
};

/** S3: add an ingredient (or another recipe) to a recipe, or edit an existing line. */
export function AddItemSheet({
  open, onClose, catalog, calc, recipeId, editing, preselect, onSave, onRemove,
}: {
  open: boolean; onClose: () => void; catalog: Catalog; calc: Calculator; recipeId: string;
  editing?: RecipeItem | null; preselect?: string | null;
  onSave: (v: { refType: 'ingredient' | 'recipe'; refId: string; quantity: number; unit: Unit; quantityBasis: QuantityBasis }) => void;
  onRemove?: () => void;
}) {
  const { t, unit: unitLabel } = useT();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [pick, setPick] = useState<Pick>(null);
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState<Unit>('g');
  const [basis, setBasis] = useState<QuantityBasis>('net');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setPick({ refType: editing.refType, refId: editing.refId });
      setQty(String(editing.quantity));
      setUnit(editing.unit);
      setBasis(editing.quantityBasis);
    } else {
      setPick(preselect ? { refType: 'ingredient', refId: preselect } : null);
      setQty('');
      setUnit('g');
      setBasis('net');
      setQ('');
    }
  }, [open, editing, preselect]);

  const needle = q.trim().toLowerCase();
  const ingredients = useMemo(() => [...catalog.ingredients.values()]
    .filter((i) => !i.deleted && (!needle || `${i.nameTh} ${i.nameEn ?? ''}`.toLowerCase().includes(needle)))
    .sort((a, b) => a.nameTh.localeCompare(b.nameTh, 'th')), [catalog, needle]);
  const recipes = useMemo(() => [...catalog.recipes.values()]
    .filter((r) => !r.deleted && r.id !== recipeId && (!needle || r.name.toLowerCase().includes(needle))), [catalog, needle, recipeId]);

  const picked = pick ? (pick.refType === 'ingredient' ? catalog.ingredients.get(pick.refId) : catalog.recipes.get(pick.refId)) : null;
  const pickedName = picked ? ('nameTh' in picked ? picked.nameTh : picked.name) : '';
  const ingPicked = pick?.refType === 'ingredient' ? catalog.ingredients.get(pick.refId) : undefined;
  const units = pick?.refType === 'recipe'
    ? (['g', 'kg', 'tsp', 'tbsp', 'cup', 'piece'] as Unit[])
    : UNITS_FOR(!!ingPicked?.gramsPerPiece, ingPicked?.baseUnit === 'ml' || !!ingPicked?.densityGPerMl);
  const cycle = pick?.refType === 'recipe' && calc.wouldCycle(recipeId, pick.refId);
  const n = parseNumber(qty);
  const valid = !!pick && !cycle && n !== null && n > 0;

  useEffect(() => {
    // default unit: pieces for things bought by the piece
    if (!editing && ingPicked?.packUnit === 'piece' && ingPicked.gramsPerPiece) setUnit('piece');
  }, [ingPicked, editing]);

  return (
    <Sheet open={open} onClose={onClose} title={editing ? t('editItem') : t('addIngredient')}>
      {!pick && (
        <>
          <label className="search">
            <Icon name="search" size={20} />
            <span className="sr-only">{t('searchIngredient')}</span>
            <input autoFocus placeholder={t('searchIngredient')} value={q} onChange={(e) => setQ(e.target.value)} type="search" data-testid="add-search" />
          </label>
          <button className="pick" onClick={() => nav(`/ingredient/new?name=${encodeURIComponent(q.trim())}&returnTo=${encodeURIComponent(`/recipe/${recipeId}`)}`)} data-testid="create-ingredient">
            <Icon name="plus" size={20} /> <span style={{ color: 'var(--primary-text)', fontWeight: 600 }}>{q.trim() ? t('createNew', { q: q.trim() }) : t('createNewPlain')}</span>
          </button>
          <div className="stack" style={{ gap: 6 }}>
            {ingredients.map((i) => {
              const incomplete = i.packPrice === null || !i.nutrition;
              return (
                <button key={i.id} className="pick" onClick={() => setPick({ refType: 'ingredient', refId: i.id })} data-testid="pick-ingredient">
                  <span className="grow">{i.nameTh}{i.nameEn ? <span className="muted small"> · {i.nameEn}</span> : null}</span>
                  {incomplete && <Icon name="warn" size={16} className="muted" />}
                </button>
              );
            })}
          </div>
          {recipes.length > 0 && (
            <>
              <div className="small muted" style={{ paddingTop: 8 }}>{t('fromRecipes')}</div>
              <div className="stack" style={{ gap: 6 }}>
                {recipes.map((r) => (
                  <button key={r.id} className="pick" onClick={() => setPick({ refType: 'recipe', refId: r.id })} data-testid="pick-recipe">
                    <Icon name="book" size={18} /><span className="grow">{r.name}</span>
                    <span className="small muted">{t('subRecipe')}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {pick && (
        <>
          <div className="between">
            <strong style={{ fontSize: 17 }}>{pickedName}</strong>
            {!editing && <button className="btn outline sm" onClick={() => setPick(null)}>{t('back')}</button>}
          </div>
          {cycle && <div className="note-warn"><Icon name="warn" size={18} />{t('cycleError')}</div>}
          <Field label={t('quantity')} value={qty} onChange={setQty} numeric autoFocus suffix={unitLabel(unit)} testId="qty" />
          <div className="chips" role="group" aria-label={t('unit')}>
            {units.map((u) => <button key={u} className="chip sm" aria-pressed={unit === u} onClick={() => setUnit(u)}>{unitLabel(u)}</button>)}
          </div>
          {pick.refType === 'ingredient' && ingPicked && ingPicked.yieldPct < 100 && (
            <>
              <Segmented value={basis} onChange={setBasis} label={t('basisHint')}
                options={[{ value: 'net', label: t('basisNet') }, { value: 'purchased', label: t('basisPurchased') }]} />
              <span className="small muted">{t('basisHint')} · yield {ingPicked.yieldPct}%</span>
            </>
          )}
          <div className="btn-row" style={{ paddingTop: 4 }}>
            {editing && onRemove && <button className="btn danger" onClick={onRemove}>{t('removeItem')}</button>}
            <button className="btn" disabled={!valid} data-testid="save-item"
              onClick={() => valid && onSave({ refType: pick.refType, refId: pick.refId, quantity: n!, unit, quantityBasis: pick.refType === 'recipe' ? 'net' : basis })}>
              {editing ? t('save') : t('add')}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
