import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Field, Icon, Sheet } from '../components';
import { useT } from '../i18n';
import { labelToPer100 } from '../../engine/validate';
import { formatGrams, parseNumber } from '../../engine/format';
import { searchUsda, UsdaError, usdaSourceLabel, type UsdaFood } from '../../usda/usda';
import { getMeta } from '../../data/repo';
import type { Nutrition } from '../../engine/types';

type Apply = (n: Partial<Nutrition>, source?: string, nameEn?: string) => void;

/** Q3 option 3: per-serving values on a label → per 100 g. */
export function LabelSheet({ open, onClose, onApply }: { open: boolean; onClose: () => void; onApply: Apply }) {
  const { t } = useT();
  const [v, setV] = useState<Record<string, string>>({});
  useEffect(() => { if (open) setV({}); }, [open]);
  const serving = parseNumber(v.serving ?? '');
  const keys: [keyof Nutrition, string, string][] = [
    ['kcal', t('energy'), 'kcal'], ['protein', t('protein'), 'g'], ['carb', t('carb'), 'g'], ['fat', t('fat'), 'g'],
    ['sugar', t('sugar'), 'g'], ['fiber', t('fiber'), 'g'], ['satFat', t('satFat'), 'g'], ['sodiumMg', t('sodium'), 'mg'],
  ];
  const vals: Partial<Nutrition> = {};
  keys.forEach(([k]) => { const n = parseNumber(v[k] ?? ''); if (n !== null) (vals as Record<string, number>)[k] = n; });
  const ok = serving !== null && serving > 0 && vals.kcal !== undefined;
  const per100 = ok ? labelToPer100(vals, serving!) : null;
  return (
    <Sheet open={open} onClose={onClose} title={t('labelTitle')}>
      <Field label={t('servingSize')} value={v.serving ?? ''} onChange={(s) => setV((x) => ({ ...x, serving: s }))} numeric suffix="g" autoFocus testId="label-serving" />
      <span className="small muted">{t('labelValues')}</span>
      <div className="grid2">
        {keys.map(([k, name, u]) => (
          <Field key={k} inset label={`${name} (${u})`} value={v[k] ?? ''} onChange={(s) => setV((x) => ({ ...x, [k]: s }))} numeric
            hint={per100 && per100[k] !== undefined ? `→ ${formatGrams(per100[k] as number)} / 100 g` : undefined} testId={`label-${k}`} />
        ))}
      </div>
      <button className="btn" disabled={!ok} onClick={() => { onApply(per100!, 'ฉลากสินค้า'); onClose(); }} data-testid="label-apply">{t('applyValues')}</button>
    </Sheet>
  );
}

/** Q3 option 2: search USDA FoodData Central with the user's key. */
export function UsdaSheet({ open, onClose, onApply, initialQuery }: { open: boolean; onClose: () => void; onApply: Apply; initialQuery: string }) {
  const { t } = useT();
  const [q, setQ] = useState(initialQuery);
  const [branded, setBranded] = useState(false);
  const [state, setState] = useState<{ loading: boolean; error: string | null; results: UsdaFood[] | null }>({ loading: false, error: null, results: null });
  const [key, setKey] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => { if (open) { setQ(initialQuery); setState({ loading: false, error: null, results: null }); void getMeta('usdaKey', '').then(setKey); } }, [open, initialQuery]);

  const run = async () => {
    if (!q.trim() || !key) return;
    ctrl.current?.abort();
    ctrl.current = new AbortController();
    setState({ loading: true, error: null, results: null });
    try {
      const results = await searchUsda(q.trim(), key, { branded, signal: ctrl.current.signal });
      setState({ loading: false, error: results.length ? null : t('usdaNoResult'), results });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      const code = e instanceof UsdaError ? e.code : 'network';
      setState({ loading: false, error: code === 'bad_key' ? t('usdaBadKey') : code === 'rate_limited' ? t('usdaRate') : t('usdaNetwork'), results: null });
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('usdaTitle')}>
      {key === '' ? (
        <div className="note-warn"><Icon name="warn" size={18} /><span>{t('usdaNeedKey')} — <Link to="/settings#usda" onClick={onClose}>{t('settings')}</Link></span></div>
      ) : (
        <>
          <form className="row" onSubmit={(e) => { e.preventDefault(); void run(); }}>
            <label className="search grow">
              <Icon name="search" size={20} />
              <span className="sr-only">{t('usdaHint')}</span>
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('usdaHint')} lang="en" data-testid="usda-query" />
            </label>
            <button className="btn sm" type="submit" disabled={state.loading}>{t('searchUsda')}</button>
          </form>
          <label className="row small"><input type="checkbox" className="check" checked={branded} onChange={(e) => setBranded(e.target.checked)} />{t('includeBranded')}</label>
          {state.loading && <span className="muted small">…</span>}
          {state.error && <span className="muted small">{state.error}</span>}
          <div className="stack" style={{ gap: 6 }}>
            {state.results?.map((f) => (
              <button key={f.fdcId} className="pick" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }} data-testid="usda-result"
                onClick={() => { onApply(f.nutrition, usdaSourceLabel(f), f.description); onClose(); }}>
                <span style={{ fontWeight: 600 }}>{f.description}</span>
                <span className="small muted num">
                  {f.dataType}{f.brandOwner ? ` · ${f.brandOwner}` : ''} · {Math.round(f.nutrition.kcal)} kcal · P {formatGrams(f.nutrition.protein)} · C {formatGrams(f.nutrition.carb)} · F {formatGrams(f.nutrition.fat)}
                  {f.partial ? ` · ${t('partialData')}` : ''}
                </span>
              </button>
            ))}
          </div>
          <span className="small muted">{t('usdaAttribution')}</span>
        </>
      )}
    </Sheet>
  );
}
