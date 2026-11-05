import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BottomNav, Field, Icon, Segmented } from '../components';
import { useCatalog } from '../hooks';
import { usePrefs, useT, type Theme } from '../i18n';
import { api, ApiError } from '../../data/api';
import { db } from '../../data/db';
import { getMeta, setKitchenSetting, setMeta } from '../../data/repo';
import { clearConfig, getConfig, saveConfig, syncNow, useSync } from '../../data/sync';
import { parseNumber } from '../../engine/format';

const GUIDE_URL = 'https://claude.ai/artifact/MxAWxvFi4K9EtFktqWFN1N';

export function Settings() {
  const { t } = useT();
  const { lang, theme, setLang, setTheme } = usePrefs();
  const { catalog } = useCatalog();
  const sync = useSync();
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [usdaKey, setUsdaKey] = useState('');
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  const [k, setK] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const kitchenLoaded = useRef(false);

  // D-01: render the inputs only after saved values are read, so a late read never overwrites what the user typed.
  useEffect(() => {
    void Promise.all([getConfig(), getMeta('usdaKey', '')]).then(([c, key]) => {
      setUrl(c?.url ?? ''); setToken(c?.token ?? ''); setUsdaKey(key); setLoaded(true);
    });
  }, []);
  useEffect(() => {
    if (!catalog || kitchenLoaded.current) return;
    kitchenLoaded.current = true;
    const s = catalog.settings;
    setK({ defaultFoodCostPct: String(s.defaultFoodCostPct), tspMl: String(s.tspMl), tbspMl: String(s.tbspMl), cupMl: String(s.cupMl) });
  }, [catalog]);
  useEffect(() => {
    if (!loaded) return;
    const el = document.getElementById(location.hash.split('#').pop() ?? '');
    el?.scrollIntoView({ block: 'start' });
  }, [loaded]);

  const errText = (code: string) => {
    const key = `err_${code}`;
    const s = t(key as never);
    return s === key ? `${t('err_unknown')} (${code})` : s;
  };

  const connect = async () => {
    setTest(null);
    try {
      const res = await api.ping({ url: url.trim(), token: token.trim() });
      await saveConfig(url, token);
      setTest({ ok: true, text: res.codeVersion ? t('connOk') : `${t('connOk')} — ${t('oldBackend')}` });
      void syncNow();
    } catch (e) {
      setTest({ ok: false, text: errText(e instanceof ApiError ? e.code : 'unknown') });
    }
  };

  const kitchen = (key: 'defaultFoodCostPct' | 'tspMl' | 'tbspMl' | 'cupMl', max: number) => ({
    value: k[key] ?? '',
    onChange: (v: string) => setK((x) => ({ ...x, [key]: v })),
    onBlur: () => { const n = parseNumber(k[key] ?? ''); if (n !== null && n > 0 && n <= max) void setKitchenSetting(key, n); },
  });

  const exportJson = async () => {
    const data = {
      exportedAt: new Date().toISOString(), app: 'recipe-cost-nutrition', version: 1,
      ingredients: await db.ingredients.toArray(), recipes: await db.recipes.toArray(), recipeItems: await db.recipeItems.toArray(),
      priceHistory: await db.priceHistory.toArray(), settings: await db.settings.toArray(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `recipe-cost-${data.exportedAt.slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString(lang === 'th' ? 'th-TH' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—');

  if (!loaded || !catalog) return <div className="screen with-nav"><header className="home-head"><h1>{t('settings')}</h1></header><BottomNav /></div>;

  return (
    <div className="screen with-nav">
      <header className="home-head"><h1>{t('settings')}</h1></header>
      <div className="pad stack" style={{ gap: 18 }}>
        <div className="settings-group">
          <span className="h">{t('language')}</span>
          <Segmented value={lang} onChange={setLang} options={[{ value: 'th', label: 'ไทย' }, { value: 'en', label: 'English' }]} />
          <span className="h">{t('theme')}</span>
          <Segmented<Theme> value={theme} onChange={setTheme} label={t('theme')}
            options={[{ value: 'system', label: t('themeSystem') }, { value: 'light', label: t('themeLight') }, { value: 'dark', label: t('themeDark') }]} />
        </div>

        <div className="settings-group">
          <span className="h">{t('recipes')}</span>
          <Field label={t('defaultFoodCost')} numeric suffix="%" {...kitchen('defaultFoodCostPct', 100)} testId="default-food-cost" />
          <span className="h">{t('kitchenUnits')}</span>
          <div className="grid2" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <Field inset label={t('tsp')} numeric {...kitchen('tspMl', 50)} />
            <Field inset label={t('tbsp')} numeric {...kitchen('tbspMl', 100)} />
            <Field inset label={t('cup')} numeric {...kitchen('cupMl', 1000)} />
          </div>
        </div>

        <div className="settings-group" id="sheet">
          <span className="h">{t('sheetConn')}</span>
          {import.meta.env.VITE_PREVIEW && <div className="note-warn">{t('previewNote')}</div>}
          <Field label={t('webAppUrl')} value={url} onChange={setUrl} placeholder="https://script.google.com/macros/s/…/exec" testId="sheet-url" />
          <Field label={t('token')} value={token} onChange={setToken} type="password" testId="sheet-token" />
          {test && <div className={`status-line ${test.ok ? 'ok' : 'err'}`} role="status">{test.text}</div>}
          <div className="btn-row">
            <button className="btn" onClick={connect} disabled={!url.trim() || !token.trim()} data-testid="sheet-test">{t('testConn')}</button>
            <button className="btn outline" onClick={() => void syncNow()} disabled={sync.state === 'not_configured' || sync.state === 'syncing'}><Icon name="sync" size={18} />{t('syncNow')}</button>
          </div>
          {sync.state !== 'not_configured' && (
            <div className="small muted between">
              <span>{t('lastSync', { t: fmtTime(sync.lastSyncAt) })} · {t('pendingN', { n: sync.pending })}</span>
              <button className="btn outline sm" onClick={async () => { await clearConfig(); setUrl(''); setToken(''); setTest(null); }}>{t('disconnect')}</button>
            </div>
          )}
          {sync.lastError && sync.state !== 'syncing' && <div className="status-line err" role="status" data-testid="sync-error">{t('lastAttemptFailed')}: {errText(sync.lastError)}</div>}
          <a href={GUIDE_URL} target="_blank" rel="noreferrer" className="small">{t('sheetGuide')}</a>
        </div>

        <div className="settings-group" id="usda">
          <span className="h">USDA FoodData Central</span>
          <Field label={t('usdaKey')} value={usdaKey} onChange={setUsdaKey} onBlur={() => void setMeta('usdaKey', usdaKey.trim())} type="password" testId="usda-key" />
          <a href="https://fdc.nal.usda.gov/api-key-signup/" target="_blank" rel="noreferrer" className="small">{t('usdaKeyHint')}</a>
          <Link to="/starter" className="btn outline">{t('importStarter')}</Link>
        </div>

        <div className="settings-group">
          <span className="h">{t('dataSection')}</span>
          <button className="btn outline" onClick={exportJson}>{t('exportJson')}</button>
        </div>

        <p className="small muted" style={{ textAlign: 'center' }}>
          {t('appName')} · {t('version')} {__APP_VERSION__}<br />{t('usdaAttribution')}
        </p>
      </div>
      <BottomNav />
    </div>
  );
}
