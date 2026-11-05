import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Icon, Sheet, Stepper, TopBar, showSnack } from '../components';
import { useCatalog } from '../hooks';
import { useT } from '../i18n';
import { formatBaht, formatGrams, roundTo } from '../../engine/format';
import { buildShoppingList, scaleRecipe, type ShoppingLine } from '../../engine/shopping';
import { duplicateRecipe } from '../../data/repo';

/** S8: scale a recipe (original unchanged) and build the shopping list; more recipes can be added (FR-24). */
export function Shopping() {
  const { id } = useParams();
  const { t, unit: unitLabel, lang } = useT();
  const nav = useNavigate();
  const { catalog } = useCatalog();
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [extra, setExtra] = useState<string[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [picker, setPicker] = useState(false);

  if (!catalog || !id) return null;
  const recipe = catalog.recipes.get(id);
  if (!recipe) return <div className="screen"><TopBar title="" back="/" /></div>;
  const lbl = (s: string) => (s === 'serve' ? (lang === 'th' ? 'serve' : 'serving') : s);
  const target = (rid: string) => targets[rid] ?? catalog.recipes.get(rid)!.servings;
  const ids = [id, ...extra.filter((x) => catalog.recipes.has(x))];
  const list = buildShoppingList(catalog, ids.map((rid) => ({ recipeId: rid, targetServings: target(rid) })));
  const scaled = scaleRecipe(catalog, id, target(id))!;
  const perServe = list.usedCostSatang && target(id) && ids.length === 1 ? list.usedCostSatang / target(id) : null;

  const lineText = (l: ShoppingLine) => {
    const ing = catalog.ingredients.get(l.ingredientId)!;
    const use = l.netPieces !== null ? `${formatGrams(l.netPieces, 1)} ${unitLabel('piece')}` : `${formatGrams(l.netGrams, 0)} g`;
    let buy: string;
    if (l.buyMode === 'weight') buy = `${t('weighBuy')} ${formatGrams(l.buyGrams, 0)} g${ing.yieldPct < 100 ? ` (yield ${ing.yieldPct}%)` : ''}`;
    else if (l.packs !== null) buy = `${t('buy')} ${l.packs} × ${formatGrams(l.packSize ?? 0, 2)} ${unitLabel(l.packUnit ?? 'g')}`;
    else buy = `${t('buy')} ${formatGrams(l.buyGrams, 0)} g`;
    let left = '';
    if (l.leftoverPieces !== null && l.leftoverPieces > 0.01) left = ` · ${t('leftover')} ${formatGrams(l.leftoverPieces, 1)} ${unitLabel('piece')}`;
    else if (l.leftoverGrams !== null && l.leftoverGrams > 0.5) left = ` · ${t('leftover')} ${formatGrams(l.leftoverGrams, 0)} g`;
    return `${t('use')} ${use} · ${buy}${left}`;
  };

  const shareText = () => {
    const lines = list.lines.map((l) => `${checked[l.ingredientId] ? '✓' : '•'} ${l.name}: ${lineText(l)} — ${formatBaht(l.paySatang)}`);
    const head = ids.map((rid) => `${catalog.recipes.get(rid)!.name} × ${target(rid)} ${lbl(catalog.recipes.get(rid)!.servingLabel)}`).join(', ');
    return `${head}\n${lines.join('\n')}\n${t('payTotal')}: ${formatBaht(list.totalPaySatang)}`;
  };
  const share = async () => {
    const text = shareText();
    try {
      if (navigator.share) await navigator.share({ text, title: recipe.name });
      else { await navigator.clipboard.writeText(text); showSnack(t('copied')); }
    } catch { /* cancelled */ }
  };
  const saveNew = async () => {
    const n = target(id);
    const name = `${recipe.name} (${n} ${lbl(recipe.servingLabel)})`;
    const c = await duplicateRecipe(id, { name, servings: n, factor: n / recipe.servings });
    if (c) { showSnack(t('savedAsNew', { name })); nav(`/recipe/${c.id}`); }
  };

  return (
    <div className="screen">
      <TopBar title={t('shopping')} back={`/recipe/${id}/result`} />
      <div className="pad stack">
        {ids.map((rid) => {
          const r = catalog.recipes.get(rid)!;
          return (
            <div key={rid} className="stepper-card" style={{ borderRadius: 20, padding: '12px 12px 12px 16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                {ids.length > 1 && <strong style={{ fontSize: 14 }}>{r.name}</strong>}
                <span className="small muted">{t('originalMakes', { n: r.servings, label: lbl(r.servingLabel) })}</span>
                <span className="muted" style={{ fontSize: 13 }}>{t('factor')} <b className="num" style={{ color: 'var(--text)' }}>× {roundTo(target(rid) / r.servings, 2)}</b></span>
              </div>
              <div className="row" style={{ gap: 4 }}>
                <Stepper value={target(rid)} onChange={(n) => setTargets((s) => ({ ...s, [rid]: n }))} label={r.name} testId={rid === id ? 'target-servings' : undefined} />
                {rid !== id && <button className="icon-btn" aria-label={t('removeFromList')} onClick={() => setExtra((e) => e.filter((x) => x !== rid))}><Icon name="minus" /></button>}
              </div>
            </div>
          );
        })}
        <button className="dashed-btn" onClick={() => setPicker(true)}><Icon name="plus" size={18} />{t('addAnotherRecipe')}</button>

        <div className="hero between" style={{ alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="l">{t('payTotal')}</span>
            <span className="big num money" data-testid="pay-total">{formatBaht(list.totalPaySatang)}{list.complete ? '' : '+'}</span>
          </div>
          <div className="l" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            <span>{t('usedCost')} <b className="num" style={{ color: '#fff' }} data-testid="used-cost">{formatBaht(list.usedCostSatang)}</b></span>
            {perServe !== null && <span>{t('samePerServe', { label: lbl(recipe.servingLabel) })} <b className="num" style={{ color: '#fff' }}>{formatBaht(perServe)}</b></span>}
          </div>
        </div>
      </div>

      <div className="section-head">
        <span className="h">{t('toBuy', { n: list.lines.length })}</span>
        <span className="small muted">{t('tickWhenBought')}</span>
      </div>
      <ul className="list pad">
        {list.lines.map((l) => (
          <li key={l.ingredientId} className={`line ${checked[l.ingredientId] ? 'struck' : ''}`} style={{ padding: '12px 14px' }} data-testid="shop-line">
            <input type="checkbox" className="check" checked={!!checked[l.ingredientId]} aria-label={t('boughtCheck', { name: l.name })}
              onChange={(e) => setChecked((c) => ({ ...c, [l.ingredientId]: e.target.checked }))} />
            <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="name">{l.name}</span>
              <span className="small muted">{lineText(l)}</span>
            </div>
            <span className="money num" style={checked[l.ingredientId] ? { color: 'var(--text-2)' } : undefined}>{l.paySatang === null ? t('noPrice') : formatBaht(l.paySatang)}</span>
          </li>
        ))}
      </ul>

      {ids.length === 1 && (
        <details className="disclosure" style={{ margin: '16px 20px 0' }}>
          <summary>{t('scaledQuantities')}<Icon name="chevron" size={18} /></summary>
          <div className="body">
            {scaled.items.map((s) => (
              <div key={s.item.id} className="between small"><span>{s.name}</span><span className="num">{formatGrams(s.quantity, 2)} {unitLabel(s.unit)}</span></div>
            ))}
          </div>
        </details>
      )}

      <div className="pad btn-row" style={{ paddingTop: 16 }}>
        <button className="btn outline" onClick={saveNew} disabled={ids.length > 1 || target(id) === recipe.servings} data-testid="save-as-new">{t('saveAsNew')}</button>
        <button className="btn" onClick={share}>{t('shareList')}</button>
      </div>

      <Sheet open={picker} onClose={() => setPicker(false)} title={t('addAnotherRecipe')}>
        {[...catalog.recipes.values()].filter((r) => !r.deleted && !ids.includes(r.id)).map((r) => (
          <button key={r.id} className="pick" onClick={() => { setExtra((e) => [...e, r.id]); setPicker(false); }}>
            <Icon name="book" size={18} /><span className="grow">{r.name}</span><span className="small muted">{r.servings} {lbl(r.servingLabel)}</span>
          </button>
        ))}
      </Sheet>
    </div>
  );
}
