// Анализ средств и схемы ухода
import { ACTIVE_MAP, TYPE_MAP, ROUTINE_SLOTS, CATEGORIES } from './data.js';

export const ACTIVE_INFO = {
  aha: 'Отшелушивает поверхность, выравнивает тон. Сушит, повышает чувствительность к солнцу.',
  bha: 'Растворяет себум внутри пор — для чёрных точек и жирной кожи.',
  pha: 'Самая мягкая кислота, отшелушивает и увлажняет.',
  azelaic: 'Чистит закрытые комедоны, снимает покраснения, выравнивает тон. Почти не повышает чувствительность к солнцу.',
  retinoid: 'Обновляет кожу, чистит поры, со временем уплотняет. Только вечером и с SPF.',
  spicule: 'Микроиглы: механическое отшелушивание, усиливают проникновение других средств.',
  vitc: 'Антиоксидант, сияние и ровный тон. Лучше утром под SPF.',
  niacinamide: 'Успокаивает, сужает видимые поры, помогает барьеру. Хорошо с азелаиновой.',
  peptides: 'Поддерживают упругость, мягкий эффект без раздражения.',
  ceramides: 'Восстанавливают барьер, держат влагу — то, что нужно у батареи.',
  hyaluronic: 'Притягивает воду. Лучше на влажную кожу и под крем.',
  centella: 'Успокаивает и ускоряет восстановление после активов.',
  zinc: 'Регулирует себум, успокаивает, работает против грибка на коже.',
  hocl: 'Успокаивает покраснения и воспаления, антибактериальное действие.',
  collagen: 'Плёнка влаги на поверхности, ощущение гладкости.',
  rice: 'Мягко осветляет и увлажняет, даёт сияние.',
  panthenol: 'Успокаивает и смягчает.',
  spf: 'Защищает от UVA/UVB — главное средство против старения кожи.',
  alcohol: 'Быстро сохнет и матирует, но может пересушивать — лучше на жирные зоны.',
  fragrance: 'Может раздражать чувствительную кожу.',
  oil: 'Питает, но на Т-зоне может блестеть.',
  silica: 'Впитывает себум, даёт матовость.',
  bpo: 'Убивает бактерии акне. Сушит, обесцвечивает ткань.',
};

const EXF = ['aha', 'bha', 'pha', 'azelaic', 'spicule', 'retinoid'];
const ACTIVE_STATUS = ['use', 'low', 'order'];

export const iso = d => {
  const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
};
export const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
export const fmtDate = s => s ? new Date(s + 'T12:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : '';
export const addDays = (s, n) => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() + n); return iso(d); };
export const addMonths = (s, n) => { const d = new Date(s + 'T12:00'); d.setMonth(d.getMonth() + Number(n)); return iso(d); };

// Какой сегодня вечер: с активом или отдых
export function eveningFor(profile, date) {
  const start = profile.activeStart;
  const name = profile.activeName || 'актив';
  if (!start) return { slot: 'eveA', why: 'каждый вечер' };
  const d = daysBetween(start, date);
  const ramp = Number(profile.rampDays) || 0;
  if (d < 0) return { slot: 'eveB', why: `${name} начнётся ${fmtDate(start)}` };
  if (d < ramp) {
    const on = d % 2 === 0;
    return { slot: on ? 'eveA' : 'eveB', why: `привыкание: через вечер до ${fmtDate(addDays(start, ramp - 1))}`, ramp: true };
  }
  return { slot: 'eveA', why: `${name} каждый вечер` };
}

function routineProducts(state, slot) {
  const byId = Object.fromEntries(state.products.map(p => [p.id, p]));
  return (state.routines[slot] || []).map(s => byId[s.product]).filter(Boolean);
}

function hasAct(p, a) { return (p.actives || []).includes(a); }

export function expiryOf(p, today) {
  if (!p.opened || !p.pao) return null;
  const until = addMonths(p.opened, p.pao);
  return { until, left: daysBetween(today, until) };
}

export function analyze(state, today) {
  const out = { warn: [], good: [], info: [], expiry: [], shopping: [], back: [], dupes: [], stats: {} };
  const byId = Object.fromEntries(state.products.map(p => [p.id, p]));
  const prof = state.profile || {};

  for (const slot of ROUTINE_SLOTS) {
    const steps = state.routines[slot.id] || [];
    const prods = [...new Map(routineProducts(state, slot.id).map(p => [p.id, p])).values()];
    const exf = prods.filter(p => EXF.some(a => hasAct(p, a)));
    const ret = prods.filter(p => hasAct(p, 'retinoid'));
    const acids = prods.filter(p => ['aha', 'bha', 'pha', 'spicule'].some(a => hasAct(p, a)));

    if (ret.length && acids.length)
      out.warn.push({ slot: slot.name, title: 'Ретиноид и кислоты в один вечер', text: `${names(ret)} + ${names(acids)}. Разнесите по разным вечерам — так меньше риск раздражения.` });
    else if (exf.length >= 2)
      out.warn.push({ slot: slot.name, title: 'Несколько отшелушивающих средств подряд', text: `${names(exf)} в одной рутине. Особенно у батареи это может дать шелушение — оставьте одно.` });
    if (slot.id === 'morning' && ret.length)
      out.warn.push({ slot: slot.name, title: 'Ретиноид утром', text: `${names(ret)} лучше перенести на вечер.` });
    const vitc = prods.filter(p => hasAct(p, 'vitc'));
    if (vitc.length && (acids.length || ret.length))
      out.info.push({ slot: slot.name, title: 'Витамин C рядом с активами', text: 'Можно, если кожа не щиплет. При раздражении перенесите витамин C на утро.' });
    const bpo = prods.filter(p => hasAct(p, 'bpo'));
    if (bpo.length && ret.length)
      out.warn.push({ slot: slot.name, title: 'Бензоилпероксид + ретиноид', text: 'Наносите их в разное время дня.' });

    const az = prods.filter(p => hasAct(p, 'azelaic'));
    const nia = prods.filter(p => hasAct(p, 'niacinamide'));
    if (az.length && nia.length)
      out.good.push({ slot: slot.name, title: 'Азелаиновая + ниацинамид', text: `${names(az)} и ${names(nia)} — хорошая пара: вместе сильнее успокаивают и выравнивают тон.` });
    const cer = prods.filter(p => hasAct(p, 'ceramides') || hasAct(p, 'centella'));
    if (exf.length && cer.length)
      out.good.push({ slot: slot.name, title: 'Актив + восстановление', text: `${names(cer)} смягчает работу ${names(exf)}.` });

    for (const s of steps) {
      if (!s.product) continue;
      const p = byId[s.product];
      if (!p) out.info.push({ slot: slot.name, title: 'Средство удалено', text: `Шаг «${s.text}» ссылается на удалённое средство.` });
      else if (p.status === 'pause') out.info.push({ slot: slot.name, title: 'В схеме средство на паузе', text: `${p.name} сейчас на паузе — шаг можно пропускать.` });
      else if (p.status === 'empty') out.info.push({ slot: slot.name, title: 'Средство закончилось', text: `${p.brand} ${p.name} — замените в шаге «${s.text}».` });
    }
    if (slot.id === 'morning' && !prods.some(p => hasAct(p, 'spf') || p.type === 'spf'))
      out.info.push({ slot: slot.name, title: 'Нет SPF утром', text: 'Зимой при УФ 1–2 не критично, но с ретиноидами, кислотами и с весны SPF нужен каждый день.' });
  }

  const skin = (prof.skin || '').toLowerCase();
  state.products.filter(p => ACTIVE_STATUS.includes(p.status) && hasAct(p, 'alcohol')).forEach(p => {
    if (/сух|комб|чувств/.test(skin))
      out.info.push({ slot: 'Средство', title: `Спирт в составе: ${p.name}`, text: 'Наносите только на жирные зоны, щёки оставьте крему.' });
  });

  // Сроки годности
  for (const p of state.products) {
    if (p.status === 'empty' || p.status === 'wish') continue;
    const e = expiryOf(p, today);
    if (e) out.expiry.push({ p, ...e });
  }
  out.expiry.sort((a, b) => a.left - b.left);

  // Покупки
  for (const p of state.products) {
    if (p.status === 'low') out.shopping.push({ p, why: 'заканчивается' });
    if (p.status === 'wish') out.shopping.push({ p, why: 'хочу' });
    if (p.status === 'order') out.shopping.push({ p, why: 'ждём доставку' });
  }

  // Пауза закончилась
  for (const p of state.products)
    if (p.status === 'pause' && p.pauseUntil && p.pauseUntil <= today) out.back.push(p);

  // Дубли
  const groups = {};
  state.products.filter(p => ['use', 'low'].includes(p.status)).forEach(p => (groups[p.type] ||= []).push(p));
  for (const [t, arr] of Object.entries(groups)) {
    if (arr.length >= 2 && !['foundation', 'lipstick', 'eyeshadow', 'edp', 'edt', 'gloss'].includes(t))
      out.dupes.push({ type: TYPE_MAP[t]?.name || t, items: arr });
  }

  // Статистика
  const st = { byCat: {}, byStatus: {}, total: state.products.length, spent: 0, actives: {} };
  for (const c of CATEGORIES) st.byCat[c.id] = 0;
  for (const p of state.products) {
    st.byCat[p.cat] = (st.byCat[p.cat] || 0) + 1;
    st.byStatus[p.status] = (st.byStatus[p.status] || 0) + 1;
    if (p.price && p.status !== 'wish') st.spent += Number(p.price) || 0;
    if (ACTIVE_STATUS.includes(p.status)) for (const a of p.actives || []) st.actives[a] = (st.actives[a] || 0) + 1;
  }
  out.stats = st;

  // Совместимость: итоговая оценка
  out.score = Math.max(0, 100 - out.warn.length * 18 - out.info.length * 4 - out.expiry.filter(e => e.left < 0).length * 10);
  return out;
}

export function productInsights(p, state, today) {
  const res = { actives: [], routines: [], clashes: [], expiry: expiryOf(p, today) };
  res.actives = (p.actives || []).map(a => ({ name: ACTIVE_MAP[a]?.name || a, text: ACTIVE_INFO[a] || '' }));
  for (const slot of ROUTINE_SLOTS)
    if ((state.routines[slot.id] || []).some(s => s.product === p.id)) res.routines.push(slot.name);
  const mine = p.actives || [];
  const others = state.products.filter(o => o.id !== p.id && ACTIVE_STATUS.includes(o.status));
  for (const o of others) {
    const oa = o.actives || [];
    if (mine.includes('retinoid') && oa.some(a => ['aha', 'bha', 'pha', 'spicule'].includes(a)))
      res.clashes.push(`${o.brand} ${o.name} — в разные вечера`);
    else if (oa.includes('retinoid') && mine.some(a => ['aha', 'bha', 'pha', 'spicule'].includes(a)))
      res.clashes.push(`${o.brand} ${o.name} — в разные вечера`);
    else if (EXF.some(a => mine.includes(a)) && EXF.some(a => oa.includes(a)) && p.cat === 'face' && o.cat === 'face')
      res.clashes.push(`${o.brand} ${o.name} — тоже отшелушивает, лучше не в один вечер`);
  }
  return res;
}

function names(arr) { return arr.map(p => p.name).join(', '); }
