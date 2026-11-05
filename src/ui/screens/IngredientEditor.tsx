import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { askConfirm, Field, Icon, Segmented, SelectField, TopBar, showSnack } from '../components';
import { useCatalog } from '../hooks';
import { useT } from '../i18n';
import { db, type PriceHistoryRow } from '../../data/db';
import { deleteIngredient, recipesUsing, saveIngredient } from '../../data/repo';
import { costPerGram } from '../../engine/calc';
import { formatBaht, parseBahtToSatang, parseNumber, roundTo } from '../../engine/format';
import { validateIngredient } from '../../engine/validate';
import type { Ingredient, Nutrition, PackUnit } from '../../engine/types';
import { LabelSheet, UsdaSheet } from './NutritionSheets';

type Form = Record<string, string>;
const s = (v: number | null | undefined, d = 4) => (v === null || v === undefined ? '' : String(roundTo(v, d)));

function toForm(i: Ingredient | null, name = ''): Form {
  const n = i?.nutrition;
  return {
    nameTh: i?.nameTh ?? name, nameEn: i?.nameEn ?? '', category: i?.category ?? '', baseUnit: i?.baseUnit ?? 'g', buyMode: i?.buyMode ?? 'pack',
    packPrice: i?.packPrice != null ? s(i.packPrice / 100, 2) : '', packSize: s(i?.packSize), packUnit: i?.packUnit ?? 'g',
    yieldPct: s(i?.yieldPct ?? 100), gramsPerPiece: s(i?.gramsPerPiece), densityGPerMl: s(i?.densityGPerMl),
    kcal: s(n?.kcal, 1), protein: s(n?.protein, 2), fat: s(n?.fat, 2), carb: s(n?.carb, 2),
    sugar: s(n?.sugar, 2), fiber: s(n?.fiber, 2), satFat: s(n?.satFat, 2), sodiumMg: s(n?.sodiumMg, 1),
    nutritionSource: i?.nutritionSource ?? '', store: '',
  };
}

function fromForm(f: Form, base: Ingredient | null): Omit<Ingredient, 'updatedAt' | 'id'> & { id?: string } {
  const num = (k: string) => parseNumber(f[k] ?? '');
  const kcal = num('kcal'), protein = num('protein'), fat = num('fat'), carb = num('carb');
  const hasN = kcal !== null || protein !== null || fat !== null || carb !== null;
  const nutrition: Nutrition | null = hasN
    ? { kcal: kcal ?? 0, protein: protein ?? 0, fat: fat ?? 0, carb: carb ?? 0, sugar: num('sugar'), fiber: num('fiber'), satFat: num('satFat'), sodiumMg: num('sodiumMg') }
    : null;
  return {
    ...(base ?? {}),
    id: base?.id,
    nameTh: f.nameTh.trim(), nameEn: f.nameEn.trim() || undefined, category: f.category || undefined,
    baseUnit: f.baseUnit === 'ml' ? 'ml' : 'g', buyMode: f.buyMode === 'weight' ? 'weight' : 'pack',
    packPrice: parseBahtToSatang(f.packPrice), packSize: num('packSize'), packUnit: (f.packUnit || 'g') as PackUnit,
    yieldPct: num('yieldPct') ?? 100, gramsPerPiece: num('gramsPerPiece'), densityGPerMl: num('densityGPerMl'),
    nutrition, nutritionSource: f.nutritionSource.trim() || undefined, deleted: false,
  };
}

export function IngredientEditor() {
  const { id } = useParams();
  const isNew = id === 'new';
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { t, cat, unit: unitLabel } = useT();
  const { catalog } = useCatalog();
  const existing = !isNew && id ? catalog?.ingredients.get(id) ?? null : null;
  const [form, setForm] = useState<Form | null>(null);
  const [touched, setTouched] = useState(false);
  const [sheet, setSheet] = useState<'label' | 'usda' | null>(null);
  const [usedIn, setUsedIn] = useState(0);
  const loadedFor = useRef<string | null>(null);
  const history = useLiveQuery(() => (id && !isNew ? db.priceHistory.where('ingredientId').equals(id).sortBy('updatedAt') : Promise.resolve([] as PriceHistoryRow[])), [id]);

  useEffect(() => {
    if (!catalog) return;
    const key = isNew ? 'new' : id ?? '';
    if (loadedFor.current === key) return;
    if (!isNew && !existing) return;
    loadedFor.current = key;
    setForm(toForm(existing, params.get('name') ?? ''));
    if (existing) void recipesUsing(existing.id).then((r) => setUsedIn(r.length));
  }, [catalog, existing, isNew, id, params]);

  const skipFirst = useRef(true);
  // D-03: when the stored row changes from elsewhere (sync from the Sheet), reload the form instead of keeping stale values.
  const mySaves = useRef(new Set<string>());
  const seenAt = useRef<string | null>(null);
  useEffect(() => {
    if (!existing || !form) return;
    if (seenAt.current === null) { seenAt.current = existing.updatedAt; return; }
    if (existing.updatedAt === seenAt.current) return;
    seenAt.current = existing.updatedAt;
    if (mySaves.current.has(existing.updatedAt)) return;
    skipFirst.current = true;
    setForm(toForm(existing));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.updatedAt]);
  const persist = (c: Parameters<typeof saveIngredient>[0], store?: string) =>
    saveIngredient(c, store).then((saved) => { mySaves.current.add(saved.updatedAt); return saved; });

  // Debounced autosave while typing, so nothing is lost if the app is closed before a field loses focus (NFR-04).
  useEffect(() => {
    if (!form || isNew || !existing) return;
    if (skipFirst.current) { skipFirst.current = false; return; }
    const h = setTimeout(() => {
      const c = fromForm(form, existing);
      if (!validateIngredient(c).errors.length) void persist(c, form.store.trim() || undefined);
    }, 800);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const candidate = useMemo(() => (form ? fromForm(form, existing) : null), [form, existing]);
  const v = candidate ? validateIngredient(candidate) : { errors: [], warnings: [] };
  const err = (field: string) => {
    const e = v.errors.find((x) => x.field === field || (field === 'macros' && x.field === 'macros'));
    return e && (touched || !isNew) ? t(`v_${e.code}` as never) : undefined;
  };

  if (!catalog || !form || !candidate) return null;

  const set = (k: string, val: string) => setForm((f) => ({ ...f!, [k]: val }));
  /** Autosave for existing ingredients when the form is valid (NFR-04). */
  const autosave = (next?: Form) => {
    if (isNew) return;
    const c = fromForm(next ?? form, existing);
    if (validateIngredient(c).errors.length) return;
    void persist(c, (next ?? form).store.trim() || undefined);
  };
  const bind = (k: string) => ({ value: form[k] ?? '', onChange: (val: string) => set(k, val), onBlur: () => autosave() });
  const create = async () => {
    setTouched(true);
    if (v.errors.length) return;
    const saved = await saveIngredient(candidate, form.store.trim() || undefined);
    // D-04: clear the form right away, so this screen can never be reused for the next new ingredient with old values.
    setForm(toForm(null, ''));
    setTouched(false);
    showSnack(t('created'));
    const ret = params.get('returnTo');
    nav(ret ? `${ret}?add=${saved.id}` : `/ingredient/${saved.id}`, { replace: true });
  };
  const applyNutrition = (n: Partial<Nutrition>, source?: string, nameEn?: string) => {
    const next = { ...form };
    (['kcal', 'protein', 'fat', 'carb', 'sugar', 'fiber', 'satFat', 'sodiumMg'] as const).forEach((k) => {
      const val = n[k];
      if (typeof val === 'number') next[k] = String(roundTo(val, k === 'kcal' || k === 'sodiumMg' ? 1 : 2));
    });
    if (source) next.nutritionSource = source;
    if (nameEn && !next.nameEn) next.nameEn = nameEn;
    setForm(next);
    autosave(next);
  };

  const cpg = costPerGram({ ...candidate, id: 'x', updatedAt: '' } as Ingredient, catalog);
  const perPiece = form.packUnit === 'piece' && candidate.gramsPerPiece && cpg.value !== null;
  const computed = cpg.value === null ? '—'
    : perPiece ? `${formatBaht(cpg.value * candidate.gramsPerPiece!)} / ${unitLabel('piece')}`
    : candidate.baseUnit === 'ml' ? `${formatBaht(cpg.value * 100)} / 100 ml` : `฿${roundTo(cpg.value / 100, 3)} / g`;
  const spark = (history ?? []).filter((h) => !h.deleted).slice(-6);
  const maxP = Math.max(1, ...spark.map((h) => h.packPrice / (h.packSize || 1)));
  const ub = candidate.baseUnit;

  return (
    <div className="screen">
      <TopBar title={isNew ? t('newIngredient') : t('editIngredient')} back={params.get('returnTo') ?? '/ingredients'} />
      <div className="pad stack" style={{ gap: 14 }}>
        <Field label={t('nameTh')} {...bind('nameTh')} error={err('nameTh')} autoFocus={isNew && !form.nameTh} testId="ing-name" />
        <div className="grid2">
          <Field label={t('nameEn')} {...bind('nameEn')} />
          <SelectField label={t('category')} value={form.category} onChange={(val) => { const n = { ...form, category: val }; setForm(n); autosave(n); }}
            options={[{ value: '', label: '—' }, ...t('categories').split('|').map((c) => ({ value: c, label: cat(c) }))]} />
        </div>

        <section className="card stack">
          <div className="between">
            <h2>{t('purchasePrice')}</h2>
            <Segmented small value={form.buyMode} onChange={(val) => { const n = { ...form, buyMode: val }; setForm(n); autosave(n); }}
              options={[{ value: 'pack', label: t('buyPack') }, { value: 'weight', label: t('buyWeight') }]} />
          </div>
          <div className="grid2">
            <Field inset label={t('packPrice')} {...bind('packPrice')} numeric error={err('packPrice')} testId="ing-price" />
            <div className={`field inset ${err('packSize') ? 'error' : ''}`}>
              <label className="label" htmlFor="packSize">{t('packSize')}</label>
              <div className="with-suffix">
                <input id="packSize" className="num" inputMode="decimal" value={form.packSize} onChange={(e) => set('packSize', e.target.value)} onBlur={() => autosave()} data-testid="ing-pack-size" />
                <select aria-label={t('unit')} value={form.packUnit} onChange={(e) => { const n = { ...form, packUnit: e.target.value }; setForm(n); autosave(n); }}
                  style={{ border: 'none', background: 'transparent', color: 'var(--primary-text)', fontWeight: 600, width: 'auto' }} data-testid="ing-pack-unit">
                  {(['g', 'kg', 'ml', 'l', 'piece'] as const).map((u) => <option key={u} value={u}>{unitLabel(u)}</option>)}
                </select>
              </div>
              {err('packSize') && <span className="err">{err('packSize')}</span>}
            </div>
          </div>
          {form.packUnit === 'piece' && (
            <Field inset label={t('gramsPerPiece')} {...bind('gramsPerPiece')} numeric suffix="g" error={err('gramsPerPiece')} testId="ing-gpp" />
          )}
          <div className="between" style={{ background: 'var(--money-bg)', borderRadius: 14, padding: '10px 14px' }}>
            <span style={{ fontSize: 13, color: 'var(--tip-text)' }}>{t('computed')}</span>
            <span className="num" style={{ fontSize: 16, fontWeight: 700, color: 'var(--money)' }} data-testid="ing-computed">{computed}</span>
          </div>
          {!isNew && <Field inset label={t('store')} {...bind('store')} />}
          {spark.length > 1 && (
            <div className="spark" aria-label={t('priceHistory')}>
              {spark.map((h, i) => <span key={h.id} className={i === spark.length - 1 ? 'last' : ''} style={{ height: `${Math.max(8, ((h.packPrice / (h.packSize || 1)) / maxP) * 100)}%` }} title={`${h.recordedAt} ${formatBaht(h.packPrice)}`} />)}
              <span className="small muted" style={{ flex: 'none', alignSelf: 'center', background: 'none', marginLeft: 6 }}>{t('priceHistory')}</span>
            </div>
          )}
        </section>

        <section className="card stack">
          <div className="between">
            <h2>{t('nutritionPer100', { u: ub })}</h2>
            <span className="small muted" style={{ textAlign: 'right', maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={form.nutritionSource}>{form.nutritionSource}</span>
          </div>
          <div className="btn-row">
            <button className="btn outline sm" onClick={() => setSheet('usda')} data-testid="open-usda"><Icon name="db" size={16} />{t('searchUsda')}</button>
            <button className="btn outline sm" onClick={() => setSheet('label')} data-testid="open-label"><Icon name="label" size={16} />{t('fromLabel')}</button>
          </div>
          <div className="grid2 nut-tiles">
            <Field inset className="tile-kcal" label={`${t('energy')} (kcal)`} {...bind('kcal')} numeric error={err('kcal')} testId="ing-kcal" />
            <Field inset className="tile-p" label={`${t('protein')} (g)`} {...bind('protein')} numeric error={err('protein')} testId="ing-protein" />
            <Field inset className="tile-c" label={`${t('carb')} (g)`} {...bind('carb')} numeric error={err('carb')} testId="ing-carb" />
            <Field inset className="tile-f" label={`${t('fat')} (g)`} {...bind('fat')} numeric error={err('fat')} testId="ing-fat" />
          </div>
          {err('macros') && <div className="note-warn" role="alert"><Icon name="warn" size={18} />{err('macros')}</div>}
          {v.warnings.map((w) => <div key={w.code} className="note-warn"><Icon name="warn" size={18} />{t(`v_${w.code}` as never)}</div>)}
          <details className="disclosure" style={{ border: 'none', background: 'transparent' }}>
            <summary style={{ padding: '4px', color: 'var(--primary-text)', fontWeight: 600 }}>{t('optionalNutrients')}<Icon name="chevron" size={18} /></summary>
            <div className="body grid2" style={{ padding: '8px 0 0' }}>
              <Field inset label={`${t('sugar')} (g)`} {...bind('sugar')} numeric />
              <Field inset label={`${t('fiber')} (g)`} {...bind('fiber')} numeric />
              <Field inset label={`${t('satFat')} (g)`} {...bind('satFat')} numeric />
              <Field inset label={`${t('sodium')} (mg)`} {...bind('sodiumMg')} numeric />
            </div>
          </details>
          <Field inset label={t('source')} {...bind('nutritionSource')} />
        </section>

        <details className="disclosure">
          <summary>{t('advanced')}<Icon name="chevron" size={18} /></summary>
          <div className="body">
            <Field inset label={t('yieldPct')} hint={t('yieldHint')} {...bind('yieldPct')} numeric suffix="%" error={err('yieldPct')} testId="ing-yield" />
            {form.packUnit !== 'piece' && <Field inset label={t('gramsPerPiece')} {...bind('gramsPerPiece')} numeric suffix="g" error={err('gramsPerPiece')} />}
            <Field inset label={t('density')} hint={t('densityHint')} {...bind('densityGPerMl')} numeric suffix="g/ml" error={err('densityGPerMl')} />
            <Segmented small label={t('baseUnit')} value={form.baseUnit} onChange={(val) => { const n = { ...form, baseUnit: val }; setForm(n); autosave(n); }}
              options={[{ value: 'g', label: `${t('baseUnit')}: g` }, { value: 'ml', label: `${t('baseUnit')}: ml` }]} />
          </div>
        </details>

        {isNew ? (
          <button className="btn" onClick={create} data-testid="ing-save">{t('save')}</button>
        ) : (
          <>
            <p className="small muted" style={{ textAlign: 'center', margin: 0 }}>{t('autosaved')} · {t('usedIn', { n: usedIn })}</p>
            <button className="btn danger" onClick={async () => {
              if (await askConfirm(t('confirmDeleteIngredient', { name: candidate.nameTh, n: usedIn }), t('delete'))) { await deleteIngredient(existing!.id); nav('/ingredients'); }
            }}><Icon name="trash" size={18} />{t('deleteIngredient')}</button>
          </>
        )}
      </div>
      <LabelSheet open={sheet === 'label'} onClose={() => setSheet(null)} onApply={applyNutrition} />
      <UsdaSheet open={sheet === 'usda'} onClose={() => setSheet(null)} onApply={applyNutrition} initialQuery={form.nameEn || ''} />
    </div>
  );
}
