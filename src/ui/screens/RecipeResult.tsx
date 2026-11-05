import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toPng } from 'html-to-image';
import { Field, Icon, Segmented, TopBar, showSnack } from '../components';
import { useCatalog } from '../hooks';
import { useT } from '../i18n';
import { formatBaht, formatGrams, formatKcal, formatPct, parseBahtToSatang, roundTo } from '../../engine/format';
import { atwaterCheck } from '../../engine/calc';
import { patchRecipe } from '../../data/repo';
import type { NutrientTotals } from '../../engine/types';

type Basis = 'serve' | '100g' | 'all';

export function RecipeResult() {
  const { id } = useParams();
  const { t, lang } = useT();
  const { catalog, calc } = useCatalog();
  const [tab, setTab] = useState<'nutrition' | 'cost'>('cost');
  const [basis, setBasis] = useState<Basis>('serve');
  const [sell, setSell] = useState<string | null>(null);
  const shareRef = useRef<HTMLDivElement>(null);

  if (!catalog || !calc || !id) return null;
  const recipe = catalog.recipes.get(id);
  if (!recipe) return <div className="screen"><TopBar title="" back="/" /></div>;
  const res = calc.evaluate(id)!;
  const label = recipe.servingLabel === 'serve' ? (lang === 'th' ? 'serve' : 'serving') : recipe.servingLabel;
  const sellText = sell ?? (recipe.sellPrice ? String(roundTo(recipe.sellPrice / 100, 2)) : '');
  const sellSatang = parseBahtToSatang(sellText);
  const profit = sellSatang && sellSatang > 0 ? sellSatang - res.perServe.costSatang : null;
  const margin = profit !== null && sellSatang ? (profit / sellSatang) * 100 : null;
  const top = res.breakdown[0];

  const nut: NutrientTotals | null = basis === 'serve' ? res.perServe.nutrients : basis === '100g' ? res.per100g : res.nutrients;
  const at = atwaterCheck(res.nutrients);
  const missing = res.lines.filter((l) => l.issues.length);

  const share = async () => {
    if (!shareRef.current) return;
    try {
      const bg = getComputedStyle(document.body).backgroundColor;
      const url = await toPng(shareRef.current, { pixelRatio: 2, backgroundColor: bg });
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], `${recipe.name}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: recipe.name });
      else {
        const a = document.createElement('a');
        a.href = url; a.download = file.name; a.click();
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') showSnack(t('err_unknown'));
    }
  };

  const row = (name: string, v: number | null | undefined, u: string, major = false, color?: string, known = true) => (
    <tr className={major ? 'major' : ''}>
      <td>{color && <span className="dot" style={{ background: color }} />}{name}</td>
      <td>{!known || v === null || v === undefined ? '—' : u === 'kcal' ? formatKcal(v) : u === 'mg' ? Math.round(v).toLocaleString('en-US') : formatGrams(v)} {u}</td>
    </tr>
  );

  return (
    <div className="screen">
      <TopBar title={recipe.name} back={`/recipe/${id}`} actions={
        <button className="icon-btn" aria-label={t('shareImage')} onClick={share}><Icon name="share" /></button>
      } />
      <div className="pad">
        <div className="segmented" role="tablist">
          <button role="tab" aria-selected={tab === 'nutrition'} onClick={() => setTab('nutrition')} data-testid="tab-nutrition">{t('nutrition')}</button>
          <button role="tab" aria-selected={tab === 'cost'} onClick={() => setTab('cost')} data-testid="tab-cost">{t('costTab')}</button>
        </div>
      </div>

      <div ref={shareRef} className="pad stack" style={{ paddingTop: 16, paddingBottom: 4 }}>
        {tab === 'cost' && (
          <>
            <div className="grid2">
              <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="small muted">{t('costPerServe', { label })}</span>
                <span className="num" style={{ fontSize: 28, fontWeight: 700, color: 'var(--money)' }} data-testid="result-cost">{formatBaht(res.perServe.costSatang)}</span>
                <span className="small muted">{t('wholeBatch', { v: formatBaht(res.batchCostSatang) })}</span>
              </div>
              <div className="hero" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 2, borderRadius: 20 }}>
                <span className="l">{t('suggestedPrice')}</span>
                <span className="num money" style={{ fontSize: 28, fontWeight: 700 }} data-testid="suggested-price">{formatBaht(res.suggestedPriceSatang)}</span>
                <span className="l">{t('foodCostAt', { n: res.foodCostPct })}</span>
              </div>
            </div>
            <div className="card between" style={{ padding: '12px 16px' }}>
              <Field label={t('actualPrice', { label })} value={sellText} onChange={setSell} numeric inset className="grow"
                onBlur={() => void patchRecipe(recipe.id, { sellPrice: sellSatang })} testId="result-sell" />
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="small muted">{t('profitPer', { label })}</span>
                <span className="num" style={{ fontSize: 18, fontWeight: 700, color: profit !== null && profit < 0 ? 'var(--danger)' : 'var(--good)' }} data-testid="profit">
                  {profit === null ? '—' : `${formatBaht(profit)} · ${formatPct(margin!)}`}
                </span>
              </div>
            </div>
            <section className="card stack" style={{ gap: 14 }}>
              <div className="between"><h2>{t('breakdown')}</h2><span className="small muted">{t('sortedDesc')}</span></div>
              {res.breakdown.map((b, i) => (
                <div key={b.itemId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-testid="breakdown-row">
                  <div className="between" style={{ fontSize: 14 }}>
                    <span style={{ fontWeight: i === 0 ? 600 : 400 }}>{b.name}</span>
                    <span className="num">{i === 0 ? <b>{formatBaht(b.costSatang)}</b> : formatBaht(b.costSatang)} <span className="muted">{formatPct(b.pct)}</span></span>
                  </div>
                  <div className="bar-track"><div className={`bar-fill ${i === 0 ? 'strong' : ''}`} style={{ width: `${b.pct}%` }} /></div>
                </div>
              ))}
              {top && top.pct >= 40 && res.breakdown.length > 1 && <p className="tip">{t('topCostTip', { name: top.name, pct: formatPct(top.pct) })}</p>}
            </section>
          </>
        )}

        {tab === 'nutrition' && (
          <>
            <Segmented small value={basis} onChange={setBasis}
              options={[{ value: 'serve', label: t('perServe', { label }) }, { value: '100g', label: t('per100g') }, { value: 'all', label: t('wholeRecipe') }]} />
            <section className="card row" style={{ gap: 16 }}>
              <Donut split={res.energySplit} kcal={nut ? nut.kcal : 0} />
              <div className="stack grow" style={{ gap: 6, fontSize: 14 }}>
                <span className="small muted">{t('energyFrom')}</span>
                <span><span className="dot" style={{ background: 'var(--p)' }} />{t('protein')} <b className="num">{formatPct(res.energySplit.protein, 0)}</b></span>
                <span><span className="dot" style={{ background: 'var(--c)' }} />{t('carb')} <b className="num">{formatPct(res.energySplit.carb, 0)}</b></span>
                <span><span className="dot" style={{ background: 'var(--f)' }} />{t('fat')} <b className="num">{formatPct(res.energySplit.fat, 0)}</b></span>
              </div>
            </section>
            <section className="card">
              <table className="nut-table" data-testid="nutrition-table">
                <tbody>
                  {row(t('energy'), nut?.kcal, 'kcal', true)}
                  {row(t('protein'), nut?.protein, 'g', true, 'var(--p)')}
                  {row(t('carb'), nut?.carb, 'g', true, 'var(--c)')}
                  {row(`  ${t('sugar')}`, nut?.sugar, 'g', false, undefined, res.nutrientKnown.sugar)}
                  {row(`  ${t('fiber')}`, nut?.fiber, 'g', false, undefined, res.nutrientKnown.fiber)}
                  {row(t('fat'), nut?.fat, 'g', true, 'var(--f)')}
                  {row(`  ${t('satFat')}`, nut?.satFat, 'g', false, undefined, res.nutrientKnown.satFat)}
                  {row(t('sodium'), nut?.sodiumMg, 'mg', false, undefined, res.nutrientKnown.sodiumMg)}
                </tbody>
              </table>
              {basis === '100g' && <p className="small muted" style={{ margin: '8px 0 0' }}>{t('per100Note', { g: formatGrams(res.batchWeightG, 0) })}</p>}
              {at.warn && <p className="small muted" style={{ margin: '8px 0 0' }}>{t('atwaterNote', { pct: formatPct(at.diffPct) })}</p>}
            </section>
          </>
        )}
        {missing.length > 0 && (
          <div className="note-warn"><Icon name="warn" size={18} />
            <span>{t('missingList')}: {missing.map((l) => `${l.name} (${l.issues.map((i) => t(`issue_${i}` as never)).join(', ')})`).join(' · ')}</span>
          </div>
        )}
      </div>

      <div className="pad btn-row" style={{ paddingTop: 12 }}>
        <Link to={`/recipe/${id}/shop`} className="btn outline" data-testid="go-shopping">{t('shopShort')}</Link>
        <button className="btn" onClick={share}>{t('shareImage')}</button>
      </div>
    </div>
  );
}

function Donut({ split, kcal }: { split: { protein: number; carb: number; fat: number }; kcal: number }) {
  const r = 42, c = 2 * Math.PI * r;
  const segs = [
    { v: split.protein, color: 'var(--p)' },
    { v: split.carb, color: 'var(--c)' },
    { v: split.fat, color: 'var(--f)' },
  ];
  let off = 0;
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={`${formatKcal(kcal)} kcal`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="14" />
      {segs.map((s, i) => {
        const len = (s.v / 100) * c;
        const el = <circle key={i} cx="60" cy="60" r={r} fill="none" stroke={s.color} strokeWidth="14" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} transform="rotate(-90 60 60)" />;
        off += len;
        return el;
      })}
      <text x="60" y="58" textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--text)" fontFamily="Inter">{formatKcal(kcal)}</text>
      <text x="60" y="76" textAnchor="middle" fontSize="11" fill="var(--text-2)">kcal</text>
    </svg>
  );
}
