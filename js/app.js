import {
  APP_VERSION, APP_BUILD, CHANGELOG, CATEGORIES, TYPES, STATUSES, ACTIVES, ACTIVES_MAIN, SKIN_TYPES, ROUTINE_SLOTS,
  ACTIVE_MAP, TYPE_MAP, CAT_MAP, STATUS_MAP, C, OLD_COLORS, PALETTE_22, PALETTE_23, PALETTE_24, seedState, seedSummer, seedDevice, DEVICE_DEFAULTS, uid, REMINDER_DEFAULTS, SPEND_CATS,
} from './data.js';
import { parseInci, ROLES } from './inci.js';
import { buildReminders, toICS } from './ics.js';
import { loadState, saveState, requestPersist } from './db.js';
import { analyze, productInsights, eveningFor, iso, fmtDate, daysBetween, expiryOf, addDays } from './analysis.js';
import {
  productArt, bagBack, bagFront, starSVG, sparkle, outlineStar, smiley, tornClip, tornBlob, scribble,
  arrowDoodle, dashes, burst, ICONS, SWATCHES, nearestSwatch, chromeStar, doilySVG, plateSVG, patOf,
} from './art.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DAY_END_HOUR = 5; // до 5 утра считаем, что ещё вчерашний вечер
const today = () => iso(new Date(Date.now() - DAY_END_HOUR * 3600e3));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

let state;
const ui = { tab: 'home', cat: 'all', filter: 'all', q: '', kitCat: 'all', slot: null, edit: false, search: false, enter: true, rview: 'today', calMonth: '', shopTab: 'list' };
let draft = null, stepDraft = null;

const STATUS_ORDER = ['use', 'low', 'order', 'pause', 'wish', 'empty'];
// места в косметичке: центр по x (%), низ (%), наклон
const SLOTS = [[20, 47, -14], [36, 51, -5], [52, 49, 5], [67, 52, -3], [82, 46, 12], [28, 40, 8], [60, 41, -9], [44, 42, 10], [75, 40, -12]];
const CARD_BGS = [C.ivory, C.blue2, C.cream, C.white, C.pink, C.cream, C.lav2, C.ivory];

// ——— хранение ———
let saveTimer;
const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => saveState(state), 120); };

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2400);
}

const product = id => state.products.find(p => p.id === id);
const live = p => p.status !== 'empty';
// стол растёт, когда на нём много средств, а сами средства чуть уменьшаются
const tableSize = n => n >= 8 ? 'tbl-l' : n >= 5 ? 'tbl-m' : '';
// раскладывает средства на столе ровными рядами, без наложений
function tidyTable() {
  const items = onTable(), n = items.length; if (!n) return;
  const rows = n <= 4 ? 1 : n <= 8 ? 2 : 3;
  const per = Math.ceil(n / rows);
  items.forEach((p, i) => {
    const row = Math.floor(i / per), inRow = Math.min(per, n - row * per), col = i % per;
    const x = inRow === 1 ? 50 : 14 + col * (72 / (inRow - 1));
    const y = rows === 1 ? 58 : 34 + row * (52 / (rows - 1));
    p.pos = { x: Math.round(x + (Math.random() - .5) * 4), y: Math.round(y + (Math.random() - .5) * 4), r: Math.round((Math.random() - .5) * 16) };
  });
  save(); render(); toast('Разложила на столе');
}
const artOf = p => p.photo ? `<span class="snap"><img class="photo" src="${p.photo}" alt=""></span>` : productArt(TYPE_MAP[p.type]?.shape || 'bottle', p.color || CAT_MAP[p.cat]?.color, p.brand || p.name);
const blob = (seed, color, style) => `<div class="blob ${patOf(color)}" style="${style}"></div>`;
const inBag = () => state.products.filter(p => p.kit === 'bag' && live(p));
const onTable = () => state.products.filter(p => p.kit === 'table' && live(p) && p.pos);
const inKit = p => p.kit === 'bag' || p.kit === 'table';
const enterCls = () => ui.enter ? 'enter' : '';

function currentSlot() {
  const h = new Date().getHours();
  if (h >= DAY_END_HOUR && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'day';
  return eveFor(today()).slot;
}

// ——— какой вечер: с активом (A) или отдых (B) ———
// план идёт от того, что было на самом деле: после вечера с активом — отдых, и наоборот
function actualMode(d) {
  const m = state.eveMode?.[d];
  if (m) return m;
  const l = state.log[d] || {};
  if ((l.eveA || []).length) return 'A';
  if ((l.eveB || []).length) return 'B';
  return null;
}
function plannedMode(d, depth = 0) {
  const pr = state.profile, start = pr.activeStart, ramp = Number(pr.rampDays) || 0;
  if (!start) return 'A';
  if (d < start) return 'B';
  if (daysBetween(start, d) >= ramp) return 'A';
  if (d === start || depth > 40) return 'A';
  const prev = addDays(d, -1);
  const pm = actualMode(prev) || plannedMode(prev, depth + 1);
  return pm === 'A' ? 'B' : 'A';
}
function eveFor(d) {
  const pr = state.profile, name = pr.activeName || 'актив';
  const planned = plannedMode(d);
  const manual = state.eveMode?.[d] || null;
  const mode = manual || ((state.log[d]?.eveA || []).length ? 'A' : (state.log[d]?.eveB || []).length ? 'B' : planned);
  const start = pr.activeStart, ramp = Number(pr.rampDays) || 0;
  let why;
  if (!start) why = `${name} каждый вечер`;
  else if (d < start) why = `${name} начнётся ${fmtDate(start)}`;
  else if (daysBetween(start, d) < ramp) {
    const prev = actualMode(addDays(d, -1));
    why = `привыкание до ${fmtDate(addDays(start, ramp - 1))}: ${prev === 'A' ? `вчера был ${name} — сегодня отдых` : prev === 'B' ? `вчера был отдых — сегодня ${name}` : 'через вечер'}`;
  } else why = `${name} каждый вечер`;
  return { slot: mode === 'A' ? 'eveA' : 'eveB', mode, planned, manual: !!manual && manual !== planned, why };
}
function setEveMode(d, m) {
  state.eveMode ||= {};
  if (m === plannedMode(d)) delete state.eveMode[d]; else state.eveMode[d] = m;
  // переносим отметки вечера в выбранный режим, чтобы не терялись
  const l = state.log[d];
  if (l) {
    const from = m === 'A' ? 'eveB' : 'eveA', to = m === 'A' ? 'eveA' : 'eveB';
    if ((l[from] || []).length && !(l[to] || []).length) { delete l[from]; }
  }
  save();
}
function eveSwitch(d, act = 'evemode') {
  const e = eveFor(d), name = state.profile.activeName || 'актив';
  return `<div class="evemode">
    <div class="em-switch" data-mode="${e.mode}" role="group" aria-label="Режим вечера">
      <i class="em-knob"></i>
      <button data-act="${act}" data-d="${d}" data-v="A" aria-pressed="${e.mode === 'A'}">${ICONS.moon} с ${esc(name)}ом</button>
      <button data-act="${act}" data-d="${d}" data-v="B" aria-pressed="${e.mode === 'B'}">${ICONS.leaf} отдых</button>
    </div>
    <p class="em-note">${e.manual ? `изменено вручную · по плану ${e.planned === 'A' ? `с ${esc(name)}ом` : 'отдых'} <button class="em-reset" data-act="${act}" data-d="${d}" data-v="${e.planned}">вернуть план</button>` : esc(e.why)}</p>
  </div>`;
}
// ═════════ АППАРАТ (Medicube AGE-R Booster Pro) ═════════
const DEV_MODES = {
  booster: { name: 'Booster X2', light: 'красный', what: 'электропорация — средство впитывается глубже, сияние', base: 'лёгкая сыворотка или ампула: желейный мист, Anua, гель-бустер Medicube', freq: '1–3 раза в неделю' },
  mc:      { name: 'MC X2', light: 'зелёный', what: 'микротоки — тонус, упругость, гладкость', base: 'крем или гель: желейный мист слоем, сверху можно тонко 345', freq: '2–4 раза в неделю' },
  derma:   { name: 'Derma Shot X2', light: 'оранжевый', what: 'EMS — мышцы, чёткий контур', base: 'желейный мист, кожа ощутимо влажная', freq: '1–2 раза в неделю' },
  air:     { name: 'Air Shot X2', light: 'синий', what: 'электронидлинг — поры и текстура; только лоб, нос, подбородок; всегда первым', base: 'сухая чистая кожа, без средств', freq: '1 раз в неделю (производитель: до 2–3)' },
  mask:    { name: 'Mask', light: 'фиолетовый', what: 'поверх тканевой маски — помогает ей впитаться', base: 'тканевая маска без кислот', freq: 'по желанию' },
};
const DOW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const dev = () => (state.device ||= { ...DEVICE_DEFAULTS });
// План на дату: wait — аппарат ещё не пришёл, off — не по плану, on — режимы.
// Неделя ровно как рутины в приложении AGE-R:
//   «to 17 dec»:   вс Mask · вт Booster + MC · чт Booster · сб Air Shot + MC
//   с 17 декабря:  вс Mask · вт Booster + MC · чт Derma Shot + MC · сб Air Shot
const WEEK_INTRO = { 0: ['mask'], 2: ['booster', 'mc'], 4: ['booster'], 6: ['air', 'mc'] };
const WEEK_MAIN  = { 0: ['mask'], 2: ['booster', 'mc'], 4: ['derma', 'mc'], 6: ['air'] };
// первый Air Shot — самая первая суббота с аппаратом
function firstAirDay() {
  const D = dev(); if (!D.arrived) return '';
  for (let d = D.arrived, i = 0; i < 8; d = addDays(d, 1), i++) if (new Date(d + 'T12:00').getDay() === 6) return d;
  return '';
}
function devicePlan(d = today(), o = {}) {
  const D = dev();
  if (!o.preview) {
    if (!D.arrived) return { st: 'wait', modes: [] };
    if (d < D.arrived) return { st: 'off', modes: [], why: 'аппарата ещё не было' };
  }
  const phase = d < D.mainFrom ? 'intro' : 'main';
  const mv = !o.raw && D.moves?.[d];
  if (mv) return mv.length
    ? { st: 'on', modes: mv, phase, moved: true }
    : { st: 'off', modes: [], why: 'процедура перенесена на другой день', moved: true };
  if (!isHome(d)) return { st: 'off', modes: [], why: 'день в офисе' };
  const w = new Date(d + 'T12:00').getDay();
  const modes = (phase === 'intro' ? WEEK_INTRO : WEEK_MAIN)[w];
  if (!modes) return { st: 'off', modes: [], why: 'по плану без аппарата' };
  return { st: 'on', modes, phase, optional: w === 0, maskOpt: w === 0, trial: modes.includes('air') && d === firstAirDay() };
}
const modesTxt = (m, pl) => m.map(k => DEV_MODES[k].name + (k === 'mask' && pl?.maskOpt ? ' (если есть маска)' : '')).join(' + ');
function nextDeviceDay(from = today()) {
  for (let i = 1; i <= 8; i++) { const d = addDays(from, i), p = devicePlan(d); if (p.st === 'on') return { d, p }; }
  return null;
}
function deviceCard() {
  const D = dev(), pl = devicePlan();
  if (pl.st === 'wait') return `<div class="dev-card wait"><div class="dev-ico">${ICONS.device}</div>
    <div><div class="kicker">аппарат · AGE-R</div><b>Едет к тебе</b><span class="muted">Когда придёт — отметь, и план режимов включится.</span></div>
    <div class="dev-btns"><button class="btn small" data-act="dev-arrived">Пришёл!</button><button class="btn small outline" data-act="dev-guide">инструкция</button></div></div>`;
  const nx = nextDeviceDay();
  if (pl.st === 'off') {
    if (!isHome(today())) return '';
    return `<div class="dev-card"><div class="dev-ico">${ICONS.device}</div>
      <div><div class="kicker">аппарат · сегодня</div><b>Без аппарата</b><span class="muted">${esc(pl.why || '')}${nx ? ` · дальше ${DOW[new Date(nx.d + 'T12:00').getDay()]}: ${modesTxt(nx.p.modes)}` : ''}</span></div>
      <div class="dev-btns"><button class="btn small outline" data-act="dev-guide">инструкция</button></div></div>`;
  }
  const { n, steps } = slotProgress('device');
  return `<div class="dev-card on"><div class="dev-ico">${ICONS.device}</div>
    <div><div class="kicker">аппарат · утро${pl.phase === 'intro' ? ' · знакомство' : ''}</div><b>${modesTxt(pl.modes, pl)}${pl.optional ? ' · по желанию' : ''}</b>
      <span class="muted">${n === steps.length && n ? 'сделано ✦' : `${n} из ${steps.length} шагов`} · ${pl.trial ? 'проба Air Shot · по сухой коже, уровень 1' : pl.modes.includes('air') ? 'Air Shot первым, по сухой коже' : pl.phase === 'intro' ? 'уровень 1, 5–7 минут' : 'около 1 минуты на зону'}</span></div>
    <div class="dev-btns"><button class="btn small" data-act="dev-open">к процедуре</button><button class="btn small outline" data-act="dev-guide">инструкция</button></div></div>`;
}
// разбор состава: найденные активы + каждый ингредиент по ролям
function inciHTML(r, { open = false } = {}) {
  if (!r || !r.count) return '';
  const counts = {};
  r.items.forEach(x => { if (x.role) counts[x.role] = (counts[x.role] || 0) + 1; });
  const order = Object.keys(ROLES).filter(k => counts[k]);
  const bar = `<div class="inci-bar">${order.map(k => `<i style="flex:${counts[k]};background:${ROLES[k].color}" title="${ROLES[k].name}"></i>`).join('')}${r.count - r.known ? `<i style="flex:${r.count - r.known};background:#F6F3EE"></i>` : ''}</div>
    <div class="inci-legend">${order.map(k => `<span><b style="background:${ROLES[k].color}"></b>${ROLES[k].name} ${counts[k]}</span>`).join('')}${r.count - r.known ? `<span><b style="background:#F6F3EE"></b>не знаю ${r.count - r.known}</span>` : ''}</div>`;
  const pores = r.pores?.length ? `<div class="inci-warn"><b>Может забивать поры:</b> ${r.pores.map(x => `${esc(x.name)} (№${x.pos})`).join(', ')}. ${r.pores.every(x => r.onePct && x.pos > r.onePct) ? 'Стоит после консервантов — концентрация маленькая, скорее не страшно.' : 'Стоит высоко в составе — на лоб с закрытыми комедонами лучше осторожно.'}</div>` : '';
  const rows = r.items.map(x => `${r.onePct && x.pos === r.onePct ? '<li class="inci-1pct"><span>дальше примерно 1% и меньше</span></li>' : ''}
    <li class="${x.comedo ? 'pore' : ''}"><em>${x.pos}</em><span class="nm">${esc(x.name)}${x.act ? `<small>${esc(ACTIVE_MAP[x.act]?.name || x.act)}</small>` : ''}</span>${x.role ? `<i class="rl" style="background:${ROLES[x.role].color}">${ROLES[x.role].name}</i>` : '<i class="rl unk">?</i>'}</li>`).join('');
  return `<div class="ingr-box">${bar}${pores}
    <details class="inci-det" ${open ? 'open' : ''}><summary>весь состав по ролям · узнала ${r.known} из ${r.count}</summary><ol class="inci-list">${rows}</ol></details></div>`;
}

function airToday() { const pl = devicePlan(); return pl.st === 'on' && pl.modes.includes('air') && (state.log[today()]?.device || []).length > 0; }
function deviceBanner() {
  const pl = devicePlan();
  const head = pl.st === 'on' ? `Сегодня: ${modesTxt(pl.modes, pl)}${pl.optional ? ' · по желанию' : ''}` : pl.st === 'wait' ? 'Аппарат ещё едет' : 'Сегодня без аппарата';
  const sub = pl.st === 'on' ? (pl.trial ? `первый Air Shot: по сухой коже, сначала 1 минута на подбородке, ждём 10 минут, потом лоб и нос 3 минуты на уровне 1; MC — по желанию${eveFor(today()).mode === 'A' ? ' · вечер переключи на «отдых»' : ' · вечер без Азелика ✓'}` : pl.modes.includes('air') ? 'Air Shot первым по сухой коже, потом мист и MC' : pl.phase === 'intro' ? 'знакомство · уровень 1 · 5–7 минут' : 'около 1 минуты на зону · медленно, без нажима') : pl.st === 'wait' ? 'шаги можно посмотреть заранее' : (pl.why || '');
  return `<div class="dev-banner ${pl.st}"><div><b>${head}</b><span>${esc(sub)}</span></div>
    ${pl.st === 'wait' ? `<button class="btn small" data-act="dev-arrived">Пришёл!</button>` : ''}<button class="btn small outline" data-act="dev-guide">инструкция</button></div>`;
}
function deviceModesNote() {
  const pl = devicePlan();
  if (pl.st === 'wait') return 'Аппарат ещё едет';
  if (pl.st === 'off') return `Сегодня не по плану: ${pl.why || ''}`;
  return pl.modes.map((k, i) => `${i + 1}) ${DEV_MODES[k].name} — ${DEV_MODES[k].what}`).join(' · ');
}
function openDeviceGuide() {
  const D = dev();
  const row = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;
  openSheet(`<div class="kicker">инструкция</div><h2 class="pd-name" style="margin:4px 0 6px">AGE-R Booster Pro</h2>
    <p class="muted" style="margin-bottom:14px"><b>Аппарат — утром в домашние дни (вт, чт, сб, вс), Азелик — вечером.</b> До ${fmtDate(addDays(D.mainFrom, -1))} (рутина «to 17 dec»): вт Booster + MC, чт Booster, сб Air Shot + MC, вс Mask (если есть тканевая маска), уровень 1. В первый раз Air Shot — в вечер без Азелика. С ${fmtDate(D.mainFrom)} — основная схема.</p>
    <div class="dev-sec"><h3>Неделя с ${fmtDate(D.mainFrom)}</h3><table class="dev-t">
      ${row('вт', 'Booster + MC — сияние, тонус')}${row('чт', 'Derma Shot + MC — контур')}${row('сб', 'Air Shot — лоб, нос, подбородок; вечером при покраснении — «отдых»')}${row('вс', 'Mask поверх тканевой маски или пропуск')}${row('пн, ср, пт', 'офис — без аппарата')}</table></div>
    <div class="dev-sec"><h3>Режимы</h3>${Object.values(DEV_MODES).map(m => `<div class="dev-mode"><b>${m.name}</b> <small>${m.light} свет · ${m.freq}</small><p>${m.what}. Основа: ${m.base}.</p></div>`).join('')}
      <p class="muted">Dual — две технологии сразу, с января. AI Mode не знает про Азелик — сверяй с этой схемой.</p></div>
    <div class="dev-sec"><h3>Можно</h3><p>Желейный мист Dr.Althea (до 05.01.2027) · Anua Rice 70 · тканевая маска без кислот · Round Lab — только протереть до · 345 / 147 — только после.</p>
      <h3>Нельзя</h3><p>Азелик · Циновит · спикулы (и не в тот же день) · мист с хлорноватистой кислотой · Effaclar MAT+ · SPF, BB, макияж — процедура только на чистую кожу.</p></div>
    <div class="dev-sec"><h3>Порядок и техника</h3><p><b>Порядок режимов: Air Shot (по сухой коже) → Booster → MC → Derma Shot.</b> Уровень 1 в первый раз и всегда на тонких зонах — вокруг глаз, носа и рта. Каждый режим сам выключается через 5 минут. Медленно, снизу вверх и от центра наружу, без нажима; вся головка касается кожи. Шея (без кадыка и щитовидки) → челюсть → щёки → под глазами только по кости, только MC на минимуме → лоб. Веки нельзя. Не на сухую кожу — подсохло, добавь мист.</p></div>
    <div class="dev-sec"><h3>Когда остановиться</h3><table class="dev-t">
      ${row('резко покалывает', 'добавить мист или снизить уровень')}${row('краснота дольше часа', 'вечером «отдых», аппарат пауза 3–5 дней')}${row('жжение, шелушение, воспаления', 'аппарат пауза на неделю — Азелик важнее')}${row('2 недели спокойно', '+1 уровень')}</table></div>
    <div class="dev-sec"><h3>Настройки</h3><p class="muted">${D.arrived ? `Пришёл ${fmtDate(D.arrived)}.` : 'Ещё не пришёл.'} Основная схема с ${fmtDate(D.mainFrom)}.</p>
      <div class="row" style="gap:8px;flex-wrap:wrap">${D.arrived ? `<button class="btn small outline" data-act="dev-reset">отметить «ещё едет»</button>` : `<button class="btn small" data-act="dev-arrived">пришёл сегодня</button>`}</div></div>
    <button class="btn" style="width:100%;margin-top:14px" data-act="close">Понятно</button>`);
}

// ═════════ ПЛАН: перенос процедур перетаскиванием ═════════
// дома или в офисе: обычная неделя + разовые замены по датам
function isHome(d) {
  const o = state.workDays?.[d];
  if (o) return o === 'home';
  return dev().days.includes(new Date(d + 'T12:00').getDay());
}
function toggleWorkDay(d) {
  state.workDays ||= {};
  const D = dev(); D.moves ||= {}; D.reloc ||= {};
  const wasHome = isHome(d), w = new Date(d + 'T12:00').getDay(), dflt = D.days.includes(w);
  const before = devicePlan(d, { preview: true }).modes;
  if (wasHome === !dflt) delete state.workDays[d]; else state.workDays[d] = wasHome ? 'office' : 'home';
  let msg = `${fmtDate(d)} — ${wasHome ? 'офис' : 'дома'}`;
  if (wasHome && before.length && d >= today()) {
    // процедура аппарата переезжает на ближайший свободный домашний день
    delete D.moves[d];
    const pr = state.profile, rampEnd = pr.activeStart ? addDays(pr.activeStart, pr.rampDays || 14) : '';
    const cand = [1, 2, 3, -1, 4, 5, -2].map(k => addDays(d, k)).find(x => x >= today() && isHome(x) && devicePlan(x, { preview: true }).st !== 'on' && x !== rampEnd);
    if (cand) { setDeviceDay(cand, before); D.reloc[d] = cand; msg += ` · ${modesTxt(before)} → ${DOW[new Date(cand + 'T12:00').getDay()]}, ${fmtDate(cand)}`; }
    else msg += ' · аппарат в этот раз пропускаем';
  } else if (!wasHome && D.reloc[d]) {
    // день снова домашний — возвращаем процедуру назад
    const back = D.reloc[d]; delete D.reloc[d];
    const m = devicePlan(back, { preview: true }).modes;
    setDeviceDay(back, devicePlan(back, { preview: true, raw: true }).modes);
    if (m.length) setDeviceDay(d, m);
    msg += ` · аппарат вернулся на этот день`;
  }
  save(); render(); toast(msg);
}
const sameModes = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
function setDeviceDay(d, modes) {
  const D = dev(); D.moves ||= {};
  const base = devicePlan(d, { preview: true, raw: true }).modes;
  if (sameModes(base, modes)) delete D.moves[d]; else D.moves[d] = [...modes];
}
function moveDevice(from, to) {
  if (from === to) return;
  const a = devicePlan(from, { preview: true }).modes, b = devicePlan(to, { preview: true }).modes;
  if (!a.length) return;
  setDeviceDay(from, b); setDeviceDay(to, a);
  save(); render();
  const w = new Date(to + 'T12:00').getDay();
  toast(`${modesTxt(a)} → ${DOW[w]}, ${fmtDate(to)}${isHome(to) ? '' : ' · это офисный день'}${b.length ? ` · ${modesTxt(b)} → ${fmtDate(from)}` : ''}`);
}
function moveEve(from, to) {
  if (from === to) return;
  const mf = eveFor(from).mode, mt = eveFor(to).mode;
  if (mf === mt) { toast('В этот день уже такой же вечер'); return; }
  const [a, b] = from < to ? [from, to] : [to, from];
  const ma = a === from ? mt : mf, mb = b === from ? mt : mf;
  setEveMode(a, ma); setEveMode(b, mb);
  save(); render();
  const name = state.profile.activeName || 'актив';
  toast(`${mf === 'A' ? name : 'Отдых'} → ${fmtDate(to)} · план обновлён`);
}
function planHTML() {
  const t = today(), name = state.profile.activeName || 'актив';
  const days = Array.from({ length: 17 }, (_, i) => addDays(t, i - 3));
  const D = dev();
  return `<div class="plan">
    <p class="plan-hint">${ICONS.spark} Держи плашку и перетащи на другой день — план пересчитается. Нажми на вечер — переключишь ${esc(name)} ↔ отдых, на аппарат — выберешь день, на дату — дома ↔ офис.</p>
    ${days.map(d => {
      const dt = new Date(d + 'T12:00'), w = dt.getDay(), past = d < t;
      const e = eveFor(d), pl = devicePlan(d, { preview: !D.arrived });
      const devDone = (state.log[d]?.device || []).length > 0;
      const home = isHome(d), wdMoved = state.workDays?.[d];
      const devChip = pl.st === 'on'
        ? `<button class="pl-chip dev ${devDone ? 'done' : ''} ${pl.moved ? 'moved' : ''}" ${past ? '' : `data-pdrag="dev"`} data-d="${d}" data-act="pl-dev" data-v="${d}">${ICONS.device}<span>${modesTxt(pl.modes)}</span>${devDone ? ICONS.check : ''}</button>`
        : `<span class="pl-empty ${home ? 'home' : ''}">${home ? 'без аппарата' : 'офис'}</span>`;
      const eveChip = `<button class="pl-chip eve ${e.mode} ${e.manual ? 'moved' : ''}" data-pdrag="eve" data-d="${d}" data-act="pl-eve" data-v="${d}">${e.mode === 'A' ? ICONS.moon : ICONS.leaf}<span>${e.mode === 'A' ? esc(name) : 'отдых'}</span></button>`;
      return `<div class="pl-day ${d === t ? 'is-today' : ''} ${past ? 'past' : ''} ${home ? '' : 'office'}" data-pday="${d}">
        <button class="pl-date ${wdMoved ? 'moved' : ''}" data-act="pl-wd" data-v="${d}" aria-label="${home ? 'дома — сделать офисным' : 'офис — сделать домашним'}"><b>${DOW[w]}</b><span>${dt.getDate()} ${MONTHS_GEN[dt.getMonth()]}</span><i class="pl-where ${home ? 'home' : ''}">${home ? 'дома' : 'офис'}</i>${d === t ? '<em>сегодня</em>' : ''}</button>
        <div class="pl-chips">${devChip}${eveChip}</div>
      </div>`;
    }).join('')}
    <p class="muted plan-foot">Прошлые дни тоже можно поправить — например, если ${esc(name)} был в другой вечер. ${Object.keys(D.moves || {}).length ? `<button class="em-reset" data-act="pl-reset">вернуть аппарат по плану</button>` : ''}</p>
  </div>`;
}
const MONTHS_GEN = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
function openDevMove(d) {
  const t = today(), pl = devicePlan(d, { preview: true });
  const opts = Array.from({ length: 10 }, (_, i) => addDays(t, i)).filter(x => x !== d);
  openSheet(`<div class="kicker">аппарат · ${fmtDate(d)}</div><h2 class="pd-name" style="margin:4px 0 6px">${modesTxt(pl.modes)}</h2>
    <p class="muted" style="margin-bottom:12px">Перенести на день — процедуры поменяются местами, если там уже что-то есть.</p>
    <div class="pl-pick">${opts.map(x => { const w = new Date(x + 'T12:00').getDay(), o = devicePlan(x, { preview: true });
      return `<button class="pl-opt ${isHome(x) ? '' : 'office'}" data-act="pl-move" data-d="${d}" data-v="${x}"><b>${DOW[w]}</b><span>${new Date(x + 'T12:00').getDate()} ${MONTHS_GEN[new Date(x + 'T12:00').getMonth()]}</span><small>${o.st === 'on' ? modesTxt(o.modes) : isHome(x) ? 'свободно' : 'офис'}</small></button>`; }).join('')}</div>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap">
      <button class="btn small outline" data-act="pl-skip" data-v="${d}">убрать в этот день</button>
      ${pl.moved ? `<button class="btn small outline" data-act="pl-undo" data-v="${d}">как было по плану</button>` : ''}
    </div>
    <button class="btn" style="width:100%;margin-top:14px" data-act="close">Готово</button>`);
}

// перетаскивание плашек плана
let pdrag = null, pdragEnded = false;
function pOnDown(e) {
  pdragEnded = false;
  const ch = e.target.closest('[data-pdrag]');
  if (!ch || (e.button !== undefined && e.button > 0)) return;
  pdrag = { el: ch, kind: ch.dataset.pdrag, from: ch.dataset.d, sx: e.clientX, sy: e.clientY, moved: false, pid: e.pointerId,
    timer: setTimeout(() => { if (pdrag && !pdrag.moved) pStart(); }, 260) };
}
function pStart() {
  const r = pdrag.el.getBoundingClientRect();
  const g = pdrag.el.cloneNode(true); g.classList.add('pl-ghost');
  Object.assign(g.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px' });
  document.body.appendChild(g);
  pdrag.g = g; pdrag.ox = pdrag.sx - r.left; pdrag.oy = pdrag.sy - r.top; pdrag.moved = true;
  pdrag.el.classList.add('pl-lift'); document.body.classList.add('pl-dragging');
  if (navigator.vibrate) navigator.vibrate(8);
}
function pOnMove(e) {
  if (!pdrag) return;
  if (!pdrag.moved) {
    const dx = e.clientX - pdrag.sx, dy = e.clientY - pdrag.sy;
    if (Math.hypot(dx, dy) > 8) pStart();
    else return;
  }
  e.preventDefault();
  pdrag.g.style.left = (e.clientX - pdrag.ox) + 'px'; pdrag.g.style.top = (e.clientY - pdrag.oy) + 'px';
  const row = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-pday]');
  $$('.pl-day.hot').forEach(x => x !== row && x.classList.remove('hot'));
  if (row && row.dataset.pday !== pdrag.from && !(pdrag.kind === 'dev' && row.classList.contains('past'))) row.classList.add('hot');
  // автопрокрутка у краёв
  if (e.clientY < 56) scrollBy(0, -8); else if (e.clientY > innerHeight - 56) scrollBy(0, 8);
}
function pOnUp(e) {
  if (!pdrag) return;
  const d = pdrag; pdrag = null; clearTimeout(d.timer);
  if (!d.moved) return; // обычное нажатие — обработает click
  pdragEnded = true;
  d.g.remove(); d.el.classList.remove('pl-lift'); document.body.classList.remove('pl-dragging');
  const row = $('.pl-day.hot'); $$('.pl-day.hot').forEach(x => x.classList.remove('hot'));
  if (!row) return;
  const to = row.dataset.pday;
  if (d.kind === 'dev') moveDevice(d.from, to); else moveEve(d.from, to);
}
document.addEventListener('pointerdown', pOnDown);
window.addEventListener('pointermove', pOnMove, { passive: false });
window.addEventListener('pointerup', pOnUp);
window.addEventListener('pointercancel', pOnUp);

// ═════════ УФ-ИНДЕКС ═════════
// Данные: Open-Meteo (бесплатно, без ключа). Храним последний прогноз, чтобы работало и без сети.
const UV_PLACE = { name: 'Москва', lat: 55.7558, lon: 37.6173 };
const uvPlace = () => state.uvPlace || UV_PLACE;
let uvLoading = false;
async function fetchUV(force = false) {
  const u = state.uv;
  if (!force && u && u.place === uvPlace().name && Date.now() - (u.at || 0) < 3 * 3600e3) return;
  if (uvLoading || !navigator.onLine) return;
  uvLoading = true;
  try {
    const pl = uvPlace();
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${pl.lat}&longitude=${pl.lon}&daily=uv_index_max,uv_index_clear_sky_max,sunshine_duration&hourly=uv_index,cloud_cover&timezone=auto&forecast_days=7`;
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    state.uv = {
      at: Date.now(), place: pl.name,
      days: j.daily.time.map((d, i) => ({ d, max: +(j.daily.uv_index_max[i] ?? 0), clear: +(j.daily.uv_index_clear_sky_max?.[i] ?? 0), sun: Math.round((j.daily.sunshine_duration?.[i] || 0) / 3600 * 10) / 10 })),
      hours: j.hourly.time.map((t, i) => ({ t, uv: +(j.hourly.uv_index[i] ?? 0), cloud: j.hourly.cloud_cover?.[i] ?? null })),
    };
    save(); if (['home', 'routine'].includes(ui.tab) && !sheetOpen()) render();
  } catch { if (force) toast('Не удалось получить УФ-индекс — проверь интернет'); }
  finally { uvLoading = false; }
}
const calDay = () => iso(new Date()); // УФ по календарной дате, не по «дню ухода»
function uvDay(d = calDay()) { return state.uv?.days?.find(x => x.d === d) || null; }
function uvLevel(v) {
  if (v < 3) return { id: 'low', word: 'низкий', color: '#9DB7DD' };
  if (v < 6) return { id: 'mid', word: 'умеренный', color: '#E8C36A' };
  if (v < 8) return { id: 'high', word: 'высокий', color: '#E59A5C' };
  if (v < 11) return { id: 'vhigh', word: 'очень высокий', color: '#C9455B' };
  return { id: 'ext', word: 'экстремальный', color: '#8E3B8A' };
}
// Есть ли в косметичке средство макияжа с SPF (например, BB)
const spfMakeup = () => state.products.find(p => live(p) && ['use', 'low'].includes(p.status) && p.cat === 'makeup' && Number(p.spf) >= 15);
// Совет по SPF на сегодня. Если прогноза нет — опираемся на сезон (ноябрь–январь в средней полосе — УФ почти всегда < 3)
function spfAdvice() {
  const u = uvDay();
  const m = new Date().getMonth();
  const max = u ? u.max : ([10, 11, 0].includes(m) ? 1 : null);
  if (max === null) return { skip: false, max: null, short: 'SPF по погоде', text: 'Нет прогноза УФ — нанеси SPF, если будешь на солнце.' };
  const bb = spfMakeup();
  const bbTxt = bb ? ` В ${bb.brand || bb.name} уже SPF ${bb.spf} — в дни с макияжем его хватит.` : '';
  const est = u ? '' : ' (по сезону, без свежего прогноза)';
  if (max < 3) return { skip: true, max, short: `УФ ${fmtUV(max)} · можно пропустить`, text: `УФ ${fmtUV(max)} — ${uvLevel(max).word}${est}. SPF можно не наносить, даже у окна. Исключение — долго на солнце на снегу.${bbTxt}` };
  if (max < 6) return { skip: false, max, short: `УФ ${fmtUV(max)} · SPF нужен`, text: `УФ ${fmtUV(max)} — умеренный. SPF нужен, если будешь на улице больше 20 минут или у окна на солнце.${bbTxt}` };
  return { skip: false, max, short: `УФ ${fmtUV(max)} · SPF обязателен`, text: `УФ ${fmtUV(max)} — ${uvLevel(max).word}. SPF обязателен, обновляй каждые 2–3 часа на улице.${bbTxt}` };
}
const fmtUV = v => (Math.round(v * 10) / 10).toString().replace('.', ',');
const isSpfStep = st => { const p = st.product && product(st.product); return !!p && p.type === 'spf'; };

function slotProgress(slot) {
  const all = state.routines[slot] || [];
  const done = state.log[today()]?.[slot] || [];
  // шаг SPF в дни с низким УФ не обязателен — не считаем его, если не отмечен
  const skipSpf = slot === 'morning' && spfAdvice().skip;
  const steps = all.filter(s => !(skipSpf && isSpfStep(s) && !done.includes(s.id)));
  return { steps, all, done, n: steps.filter(s => done.includes(s.id)).length };
}

function uvCard() {
  const u = uvDay(), a = spfAdvice();
  const days = state.uv?.days?.filter(x => x.d >= calDay()).slice(0, 7) || [];
  const top = Math.max(3, ...days.map(x => x.max));
  const now = state.uv?.hours?.find(h => h.t.slice(0, 13) === new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 13));
  const lvl = a.max !== null ? uvLevel(a.max) : null;
  return `<div class="uv-card" style="--uvc:${lvl ? lvl.color : '#ccc'}">
    <div class="uv-top">
      <div class="uv-num"><small>УФ</small><b>${a.max !== null ? fmtUV(a.max) : '—'}</b></div>
      <div class="uv-txt"><div class="kicker">солнце · ${esc(uvPlace().name)}</div>
        <b>${a.skip ? 'SPF сегодня можно пропустить' : a.max === null ? 'SPF по погоде' : a.max < 6 ? 'SPF — если на улице или у окна' : 'SPF обязателен'}</b>
        <span class="muted">${esc(a.text)}</span>
        ${now ? `<span class="uv-now">сейчас УФ ${fmtUV(now.uv)}${now.cloud !== null ? ` · облачность ${now.cloud}%` : ''}</span>` : ''}</div>
    </div>
    ${days.length ? `<div class="uv-week">${days.map(x => `<div class="uv-day ${x.d === calDay() ? 'on' : ''}"><span class="uv-bar"><i style="height:${Math.max(6, x.max / top * 100)}%;background:${uvLevel(x.max).color}"></i></span><b>${fmtUV(x.max)}</b><small>${['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][new Date(x.d + 'T12:00').getDay()]}</small></div>`).join('')}</div>
      <p class="uv-legend">до 3 — можно без SPF · 3–5 — на улице нужен · 6+ — обязателен</p>` : ''}
    <div class="row between uv-foot"><span class="muted">${state.uv ? `обновлено ${new Date(state.uv.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : 'прогноз ещё не загружен'}</span>
      <span class="row" style="gap:6px"><button class="btn small outline" data-act="uv-geo">${ICONS.pin || ''}моё место</button><button class="btn small outline" data-act="uv-refresh">обновить</button></span></div>
  </div>`;
}
function uvGeo() {
  if (!navigator.geolocation) { toast('Геолокация недоступна'); return; }
  toast('Определяю место…');
  navigator.geolocation.getCurrentPosition(pos => {
    state.uvPlace = { name: 'рядом со мной', lat: +pos.coords.latitude.toFixed(3), lon: +pos.coords.longitude.toFixed(3) };
    save(); fetchUV(true);
  }, () => { state.uvPlace = null; save(); toast('Не дала доступ — оставляю Москву'); fetchUV(true); }, { timeout: 10000, maximumAge: 3600e3 });
}

function ring(done, total, size = 74) {
  return `<div class="doily-ring" style="--s:${size}px">${doilySVG(size * 1.55)}${ringCore(done, total, size)}</div>`;
}
function ringCore(done, total, size) {
  const r = size / 2 - 7, c = 2 * Math.PI * r, k = total ? done / total : 0, m = size / 2;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-label="${done} из ${total}">
    <circle cx="${m}" cy="${m}" r="${r}" fill="${C.cream}" stroke="${C.pink}" stroke-width="9"/>
    <circle cx="${m}" cy="${m}" r="${r}" fill="none" stroke="${C.orange}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - k)).toFixed(1)}" transform="rotate(-90 ${m} ${m})" style="transition:stroke-dashoffset .6s cubic-bezier(.3,1.3,.5,1)"/>
    <text x="${m}" y="${m + 1}" text-anchor="middle" dominant-baseline="central" font-weight="800" font-size="${(size * .25).toFixed(0)}" fill="${C.wine}">${done}/${total}</text></svg>`;
}

function bagHTML(items, { mini = false, key = 'k' } = {}) {
  const shown = items.slice(0, 9);
  return `<div class="bagbox ${mini ? 'mini' : ''}" ${mini ? '' : 'id="bag" data-drop="bag"'}>
    ${bagBack()}
    <div class="bag-items">${shown.map((p, i) => {
      const [x, b, r] = SLOTS[i];
      return `<div class="item" ${mini ? '' : `data-drag="${p.id}"`} data-rot="${r}" style="left:${x}%;bottom:${b}%;--r:${r}deg;--i:${i}">${artOf(p)}${p.fav && !mini ? '<span class="fav-dot">♥</span>' : ''}</div>`;
    }).join('')}</div>
    <div ${mini ? '' : 'data-act="bag-shake"'}>${bagFront(key)}</div>
    ${!mini && items.length > 9 ? `<button class="more-badge" data-act="bag-more">+${items.length - 9}</button>` : ''}
    ${!mini && !items.length ? `<div class="kit-empty"><button class="btn orange small" data-act="new">${ICONS.plus} Положить средство</button></div>` : ''}
  </div>`;
}

// ═════════ ГЛАВНАЯ ═════════
function screenHome() {
  const slot = currentSlot();
  const meta = ROUTINE_SLOTS.find(s => s.id === slot);
  const { steps, done, n } = slotProgress(slot);
  const next = steps.find(s => !done.includes(s.id));
  const eve = eveFor(today());
  const favs = state.products.filter(p => p.fav && live(p));
  const peekSrc = [...favs.filter(inKit), ...inBag().filter(p => !p.fav), ...favs.filter(p => !inKit(p))];
  const peek = peekSrc.slice(0, 4);
  const a = analyze(state, today());
  const top = a.warn[0] || a.back[0] && { title: `Можно вернуть: ${a.back[0].name}` } || a.info[0] || a.good[0];
  const lb = state.lastBackup;
  const needBackup = (lb ? daysBetween(lb.slice(0, 10), today()) : 99) >= 7;

  return `<section class="screen home ${enterCls()}">
    ${chromeStar(54, 'right:14%;top:4px;transform:rotate(12deg)', 'abs')}${chromeStar(34, 'right:4%;top:150px;transform:rotate(-14deg)', 'abs')}
    <div class="home-head">
      <h1 class="logo">glow<br>bag</h1>
      <p class="slogan">уход<br>для настоящей жизни</p>
      ${scribble(C.wine, 130)}
      <p class="hi">Привет, ${esc(state.profile.name || 'красотка')} ✦</p>
    </div>

    <div class="hero" data-act="tab" data-v="kit" role="button" aria-label="Открыть косметичку">
      ${blob('hero-wine', C.lav2, 'left:-6%;top:6%;width:64%;height:70%;transform:rotate(-5deg)')}
      ${blob('hero-blue', C.blue2, 'right:-8%;top:0;width:58%;height:62%;transform:rotate(7deg)')}
      ${blob('hero-orange', C.pink2, 'left:-4%;bottom:2%;width:42%;height:36%;transform:rotate(-10deg)')}
      ${blob('hero-pink', C.matcha2, 'right:-2%;bottom:6%;width:46%;height:34%;transform:rotate(6deg)')}
      <span class="bubble hero-bubble">достань<br>любимое</span>
      ${arrowDoodle(C.wine, 'position:absolute;right:120px;top:52px;z-index:6;transform:rotate(30deg)')}
      ${chromeStar(42, 'position:absolute;left:30%;top:18px;z-index:6;transform:rotate(-16deg)')}
      ${bagHTML(peek, { mini: true, key: 'home' })}
      <span class="pill-btn">открыть косметичку ${ICONS.arrow}</span>
    </div>

    <div class="tcard today clipboard lace" style="--bg:${C.cream}">
      <div class="paper" style="clip-path:${tornClip('today', 2.6)}"></div>
      <div class="in">
        <div class="kicker">${esc(meta.name)} · сегодня</div>
        <div class="today-row">${ring(n, steps.length)}
          <div><b>${next ? esc(next.text || product(next.product)?.name || 'Следующий шаг') : steps.length ? 'всё сделано ✦' : 'шагов пока нет'}</b>
          <span class="muted">${slot.startsWith('eve') ? (eve.mode === 'A' ? `вечер с ${esc(state.profile.activeName || 'активом')}ом` : 'вечер отдыха') : next ? `шаг ${steps.indexOf(next) + 1} из ${steps.length}` : 'кожа говорит спасибо'}</span></div>
        </div>
        <button class="btn" data-act="tab" data-v="routine">к схеме ухода ${ICONS.arrow}</button>
      </div>
    </div>

    ${deviceCard()}
    ${uvCard()}

    ${needBackup ? `<div class="banner" style="--b:${C.blue};margin-top:24px">
      <div class="ico">${ICONS.spark}</div>
      <div><b>Пора сделать копию</b><span>${lb ? `последняя — ${fmtDate(lb.slice(0, 10))}` : 'копий ещё не было'}</span></div>
      <button class="btn small" data-act="backup">Сохранить</button></div>` : ''}

    ${shopTeaser()}
    <div class="section"><h2 class="h2">любимое</h2>${chromeStar(30)}<button class="btn small outline" style="margin-left:auto" data-act="tab" data-v="fav">все</button></div>
    ${favs.length ? `<div class="strip">${favs.map((p, i) => `<button class="strip-item" data-act="open" data-id="${p.id}">
        <div class="tile" style="--bg:${CARD_BGS[i % CARD_BGS.length]}">${artOf(p)}</div><span>${esc(p.name)}</span></button>`).join('')}</div>`
      : `<p class="muted">Нажми ♡ на средстве — и оно появится здесь.</p>`}

    <button class="ana-sticker" data-act="tab" data-v="profile">
      <div class="score-badge">${plateSVG()}<b>${a.score}</b><small>баланс</small></div>
      <div><div class="kicker">анализ схемы</div>
        <b class="h2" style="font-size:22px;display:block;margin:4px 0">${a.warn.length ? `${a.warn.length} предупр.` : 'всё в балансе'}</b>
        <span class="muted">${top ? esc(top.title) : 'конфликтов активов нет'}</span></div>
    </button>
  </section>`;
}

// ═════════ КОСМЕТИЧКА ═════════
function screenKit() {
  const bag = inBag().filter(p => ui.kitCat === 'all' || p.cat === ui.kitCat);
  const table = onTable();
  const counts = { all: inBag().length };
  CATEGORIES.forEach(c => counts[c.id] = inBag().filter(p => p.cat === c.id).length);
  return `<section class="screen kit ${enterCls()}">
    <div class="kit-head">
      <h1 class="mega">моя<br>косметичка</h1>
      <span class="bubble">pick<br>&amp; drag!</span>${chromeStar(38, 'right:120px;top:-10px;transform:rotate(-10deg)', 'abs')}
    </div>
    <div class="zones">
      <div class="zone-w" data-drop="routine"><div class="zone" style="--zc:${C.pink};clip-path:${tornClip('z1', 4)}">${ICONS.sun}<span>в уход</span></div></div>
      <div class="zone-w" data-drop="fav"><div class="zone" style="--zc:${C.blue};clip-path:${tornClip('z2', 4)}">${ICONS.heart}<span>любимое</span></div></div>
      <div class="zone-w" data-drop="shelf"><div class="zone" style="--zc:${C.orange2};clip-path:${tornClip('z3', 4)}">${ICONS.shelf}<span>на полку</span></div></div>
    </div>
    <div class="table ${tableSize(table.length)}" id="table" data-drop="table">
      <div class="table-pw"><div class="table-paper" style="clip-path:${tornClip('table', 3)}"></div></div>
      <span class="table-label">на столе</span>
      ${table.length > 1 ? `<button class="table-tidy" data-act="tidy">${ICONS.spark || ''}разложить</button>` : ''}
      ${table.map((p, i) => `<div class="titem" data-drag="${p.id}" data-rot="${p.pos.r}" style="left:${p.pos.x}%;top:${p.pos.y}%;--r:${p.pos.r}deg;--i:${i}">${artOf(p)}${p.fav ? '<span class="fav-dot">♥</span>' : ''}</div>`).join('')}
      ${!table.length ? `<p class="table-empty">вытащи сюда то, чем пользуешься сегодня ✦</p>` : ''}
    </div>
    ${bagHTML(bag)}
    <div class="chips" style="margin-top:6px">
      <button class="chip small ${ui.kitCat === 'all' ? 'on' : ''}" data-act="kitcat" data-v="all">Всё<span class="n">${counts.all}</span></button>
      ${CATEGORIES.map(c => `<button class="chip small ${ui.kitCat === c.id ? 'on' : ''}" data-act="kitcat" data-v="${c.id}">${c.name}<span class="n">${counts[c.id]}</span></button>`).join('')}
    </div>
    <p class="kit-hint">тап — карточка · тяни — на стол, в уход, в любимое или обратно</p>
  </section>`;
}

// ——— перетаскивание ———
let drag = null;

function onPointerDown(e) {
  const it = e.target.closest('[data-drag]');
  if (!it || (e.button !== undefined && e.button > 0)) return;
  e.preventDefault();
  drag = { id: it.dataset.drag, el: it, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, moved: false, from: it.classList.contains('titem') ? 'table' : 'bag', lastX: e.clientX };
}

function startGhost() {
  const it = drag.el, r = it.getBoundingClientRect();
  const g = document.createElement('div');
  g.className = 'ghost';
  g.innerHTML = it.innerHTML;
  Object.assign(g.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  document.body.appendChild(g);
  drag.ghost = g; drag.origin = r; drag.offX = drag.sx - r.left; drag.offY = drag.sy - r.top; drag.rot = Number(it.dataset.rot) || 0;
  g.style.transform = `rotate(${drag.rot}deg)`;
  it.style.visibility = 'hidden';
  document.body.classList.add('dragging');
  g.animate([{ transform: `rotate(${drag.rot}deg) scale(1)` }, { transform: `rotate(${drag.rot / 2}deg) scale(1.18)` }], { duration: 220, easing: 'cubic-bezier(.3,1.6,.5,1)', fill: 'forwards' });
  if (navigator.vibrate) navigator.vibrate(8);
}

function onPointerMove(e) {
  if (!drag) return;
  drag.x = e.clientX; drag.y = e.clientY;
  if (!drag.moved) {
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 7) return;
    drag.moved = true; startGhost();
  }
  e.preventDefault();
  const g = drag.ghost;
  const vx = e.clientX - drag.lastX; drag.lastX = e.clientX;
  const tilt = Math.max(-18, Math.min(18, vx * 1.6));
  g.style.left = (e.clientX - drag.offX) + 'px';
  g.style.top = (e.clientY - drag.offY) + 'px';
  g.getAnimations().forEach(a => a.cancel());
  g.style.transform = `rotate(${tilt}deg) scale(1.18)`;
  const t = dropTarget(e.clientX, e.clientY);
  $$('[data-drop]').forEach(z => z.classList.toggle('hot', z === t?.el));
}

function dropTarget(x, y) {
  const el = document.elementFromPoint(x, y)?.closest('[data-drop]');
  return el ? { el, kind: el.dataset.drop } : null;
}

async function onPointerUp(e) {
  if (!drag) return;
  const d = drag; drag = null;
  document.body.classList.remove('dragging');
  $$('[data-drop].hot').forEach(z => z.classList.remove('hot'));
  if (!d.moved) { openProduct(d.id); return; }
  const p = product(d.id);
  const t = dropTarget(d.x, d.y);
  const g = d.ghost;
  const kind = t?.kind;

  if (kind === 'table') {
    const tr = $('#table').getBoundingClientRect(), gr = g.getBoundingClientRect();
    const cx = (gr.left + gr.width / 2 - tr.left) / tr.width * 100;
    const cy = (gr.top + gr.height / 2 - tr.top) / tr.height * 100;
    p.kit = 'table';
    p.pos = { x: Math.round(Math.max(10, Math.min(90, cx))), y: Math.round(Math.max(tr.height > 260 ? 20 : 28, Math.min(tr.height > 260 ? 82 : 72, cy))), r: Math.round((Math.random() - .5) * 26) };
    save(); render(); await land(g, d.id);
    if (d.from === 'bag') toast(`${p.name} — на столе`);
  } else if (kind === 'bag') {
    const was = p.kit;
    p.kit = 'bag'; p.pos = null;
    if (ui.kitCat !== 'all' && ui.kitCat !== p.cat) ui.kitCat = 'all';
    save(); render(); await land(g, d.id);
    const bag = $('#bag'); bag?.classList.remove('shake'); void bag?.offsetWidth; bag?.classList.add('shake');
    if (was !== 'bag') toast('Вернулось в косметичку');
  } else if (kind === 'fav') {
    p.fav = !p.fav; save();
    hearts(d.x, d.y, p.fav);
    toast(p.fav ? `♥ ${p.name} — в любимом` : `${p.name} — больше не в любимом`);
    await back(g, d);
    render();
  } else if (kind === 'routine') {
    await back(g, d);
    openSlotPicker(d.id);
  } else if (kind === 'shelf') {
    p.kit = 'shelf'; p.pos = null; save();
    await vanish(g);
    render(); toast(`${p.name} — на полке, найдёшь в каталоге`);
  } else {
    await back(g, d);
  }
}

function anim(el, frames, opts) {
  if (reduced) return Promise.resolve();
  return el.animate(frames, opts).finished.catch(() => {});
}

async function land(g, id) {
  const el = $(`[data-drag="${id}"]`);
  if (!el) { g.remove(); return; }
  el.style.visibility = 'hidden';
  const to = el.getBoundingClientRect(), from = g.getBoundingClientRect();
  const rot = Number(el.dataset.rot) || 0;
  g.style.transform = 'none';
  Object.assign(g.style, { left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px' });
  const dx = from.left + from.width / 2 - (to.left + to.width / 2), dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const s = from.width / to.width;
  await anim(g, [{ transform: `translate(${dx}px,${dy}px) scale(${s})` }, { transform: `translate(0,0) rotate(${rot}deg) scale(1)` }], { duration: 420, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'forwards' });
  el.style.visibility = ''; g.remove();
}

async function back(g, d) {
  const from = g.getBoundingClientRect(), to = d.origin;
  const el = $(`[data-drag="${d.id}"]`);
  const dx = from.left - to.left, dy = from.top - to.top;
  g.getAnimations().forEach(a => a.cancel());
  g.style.transform = 'none';
  Object.assign(g.style, { left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px' });
  await anim(g, [{ transform: `translate(${dx}px,${dy}px) scale(1.18)` }, { transform: `translate(0,0) rotate(${d.rot}deg) scale(1)` }], { duration: 460, easing: 'cubic-bezier(.3,1.35,.5,1)', fill: 'forwards' });
  if (el) el.style.visibility = '';
  g.remove();
}

async function vanish(g) {
  const tab = $('#menuBtn').getBoundingClientRect(), r = g.getBoundingClientRect();
  const dx = tab.left + tab.width / 2 - (r.left + r.width / 2), dy = tab.top - (r.top + r.height / 2);
  g.getAnimations().forEach(a => a.cancel());
  await anim(g, [{ transform: 'scale(1.18)' }, { transform: `translate(${dx * .5}px,${dy * .5 - 60}px) scale(.8) rotate(20deg)`, offset: .5 }, { transform: `translate(${dx}px,${dy}px) scale(.1) rotate(60deg)`, opacity: .2 }], { duration: 620, easing: 'cubic-bezier(.5,0,.6,1)', fill: 'forwards' });
  g.remove();
  $('#menuBtn')?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3) rotate(-8deg)' }, { transform: 'scale(1)' }], { duration: 400 });
}

function hearts(x, y, on) {
  if (reduced) return;
  for (let i = 0; i < (on ? 9 : 4); i++) {
    const el = document.createElement('div');
    el.className = 'flyer';
    el.innerHTML = on ? `<span style="font-size:${18 + (i % 3) * 6}px;color:${[C.pink2, C.orange, C.wine][i % 3]}">♥</span>` : `<span style="font-size:18px;opacity:.5">♡</span>`;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    document.body.appendChild(el);
    const a = -Math.PI / 2 + (Math.random() - .5) * 2.2, dist = 60 + Math.random() * 90;
    el.animate([{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * dist}px), calc(-50% + ${Math.sin(a) * dist}px)) scale(1.1) rotate(${(Math.random() - .5) * 60}deg)`, opacity: 0 }],
      { duration: 900 + Math.random() * 400, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => el.remove();
  }
}

function shakeBag() {
  const bag = $('#bag'); if (!bag) return;
  bag.classList.remove('shake'); void bag.offsetWidth; bag.classList.add('shake');
  $$('.item', bag).forEach((it, i) => { it.classList.remove('jiggle'); void it.offsetWidth; setTimeout(() => it.classList.add('jiggle'), i * 45); });
}

// ═════════ КАТАЛОГ ═════════
const FILTERS = [['all', 'Все'], ['kit', 'В косметичке'], ['shelf', 'На полке'], ...STATUSES.filter(s => s.id !== 'use').map(s => [s.id, s.name])];

function catalogList() {
  const q = ui.q.trim().toLowerCase();
  return state.products
    .filter(p => ui.cat === 'all' || p.cat === ui.cat)
    .filter(p => {
      if (ui.filter === 'all') return live(p);
      if (ui.filter === 'kit') return inKit(p) && live(p);
      if (ui.filter === 'shelf') return p.kit === 'shelf' && live(p);
      return p.status === ui.filter;
    })
    .filter(p => !q || `${p.brand} ${p.name} ${TYPE_MAP[p.type]?.name || ''} ${(p.actives || []).map(a => ACTIVE_MAP[a]?.name).join(' ')}`.toLowerCase().includes(q))
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || CATEGORIES.findIndex(c => c.id === a.cat) - CATEGORIES.findIndex(c => c.id === b.cat));
}

function catCard(p, i, withKit = true) {
  const st = STATUS_MAP[p.status];
  const rot = ((i * 37) % 7 - 3) * .6;
  const e = expiryOf(p, today());
  return `<article class="ccard" style="--bg:${CARD_BGS[i % CARD_BGS.length]};--rot:${rot}deg">
    <div class="paper ${patOf(CARD_BGS[i % CARD_BGS.length])}"></div>
    ${p.status !== 'use' || (e && e.left < 31) ? `<span class="st-chip" style="--sc:${e && e.left < 31 ? C.orange2 : st.color}">${e && e.left < 31 ? (e.left < 0 ? 'срок вышел' : `ещё ${e.left} дн.`) : st.name}</span>` : ''}
    <button class="heart-btn ${p.fav ? 'on' : ''}" data-act="fav" data-id="${p.id}" aria-label="В любимое">${ICONS.heart}</button>
    <button class="ccard-art" data-act="open" data-id="${p.id}" aria-label="${esc(p.name)}">${artOf(p)}</button>
    <div class="ccard-label"><b>${esc(p.name)}</b><small>${esc(p.brand)}</small></div>
    ${withKit ? `<button class="kit-btn ${inKit(p) ? 'on' : ''}" data-act="kit" data-id="${p.id}">${inKit(p) ? '✓ в косметичке' : '+ в косметичку'}</button>` : ''}
  </article>`;
}

function screenCatalog() {
  const list = catalogList();
  const counts = { all: state.products.filter(live).length };
  CATEGORIES.forEach(c => counts[c.id] = state.products.filter(p => p.cat === c.id && live(p)).length);
  return `<section class="screen catalog ${enterCls()}">
    ${chromeStar(50, 'left:-10px;top:300px;transform:rotate(-12deg)', 'abs')}
    ${chromeStar(40, 'right:-8px;top:430px;transform:rotate(18deg)', 'abs')}
    <div class="cat-head">
      <div><h1 class="title-xl">каталог</h1>${scribble(C.wine, 170)}</div>
      <button class="round-btn" data-act="search" aria-label="Поиск">${ICONS.search}</button>
    </div>
    ${ui.search || ui.q ? `<div class="search">${ICONS.search}<input id="q" type="search" placeholder="Бренд, название, актив" value="${esc(ui.q)}" autocomplete="off"></div>` : ''}
    <div class="chips" style="margin-top:10px">
      <button class="chip ${ui.cat === 'all' ? 'on' : ''}" data-act="cat" data-v="all">всё<span class="n">${counts.all}</span></button>
      ${CATEGORIES.map(c => `<button class="chip ${ui.cat === c.id ? 'on' : ''}" data-act="cat" data-v="${c.id}">${c.name.toLowerCase()}<span class="n">${counts[c.id]}</span></button>`).join('')}
    </div>
    <div class="chips" style="padding-top:0">
      ${FILTERS.map(([id, n]) => `<button class="chip small ${ui.filter === id ? 'on' : ''}" data-act="filter" data-v="${id}">${n}</button>`).join('')}
    </div>
    <div class="cgrid" id="cgrid">${list.map((p, i) => catCard(p, i)).join('')}</div>
    ${!list.length ? `<div class="empty"><p class="serif">ничего не нашлось</p><button class="btn orange" data-act="new">${ICONS.plus} Добавить средство</button></div>` : ''}
    <div class="glow"><span class="bubble">good skin<br>good mood</span></div>
  </section>`;
}

// ═════════ УХОД ═════════
function screenRoutine() {
  const eve = eveFor(today());
  let slot = ui.slot || currentSlot();
  if (slot === 'eveA' || slot === 'eveB') slot = eve.slot;
  ui.slot = slot;
  const { steps, all, done, n } = slotProgress(slot);
  const isEve = slot === 'eveA' || slot === 'eveB';
  return `<section class="screen routine ${enterCls()}">
    <div class="rt-head">
      <h1 class="bubble">твой<br>уход</h1>
      ${ui.rview === 'today' ? ring(n, steps.length, 96) : streakBadge()}
    </div>
    <div class="row between" style="margin-top:14px">
      <div class="seg">
        <button class="${ui.rview === 'today' ? 'on' : ''}" data-act="rview" data-v="today">${ICONS.routine} сегодня</button>
        <button class="${ui.rview === 'cal' ? 'on' : ''}" data-act="rview" data-v="cal">${ICONS.calendar} календарь</button>
        <button class="${ui.rview === 'plan' ? 'on' : ''}" data-act="rview" data-v="plan">${ICONS.spark} план</button>
      </div>
      <div class="season" role="group" aria-label="Сезон">
        <button class="${state.season === 'winter' ? 'on' : ''}" data-act="season" data-v="winter" aria-label="Зимняя схема">${ICONS.snow}</button>
        <button class="${state.season === 'summer' ? 'on' : ''}" data-act="season" data-v="summer" aria-label="Летняя схема">${ICONS.sun}</button>
      </div>
    </div>
    ${ui.rview === 'cal' ? calendarHTML() : ui.rview === 'plan' ? planHTML() : `
    <p class="season-note">${state.season === 'winter' ? 'зимняя схема · отопление, больше увлажнения' : 'летняя схема · SPF и матирование'}</p>
    <div class="slots">
      ${[['morning', 'Утро', 'sun'], ['day', 'Днём', 'cloud'], ['eve', 'Вечер', 'moon'], ['device', 'Аппарат', 'device'], ['weekly', 'Раз в неделю', 'star']].map(([id, n, ic]) => {
        const on = id === 'eve' ? isEve : id === slot;
        return `<button class="slot ${on ? 'on' : ''}" data-act="slot" data-v="${id}">${ICONS[ic]}${n}${id === 'eve' ? `<span class="slot-mode">${eve.mode === 'A' ? esc(state.profile.activeName || 'актив') : 'отдых'}</span>` : ''}</button>`;
      }).join('')}
    </div>
    ${isEve ? eveSwitch(today()) : ''}
    ${slot === 'device' ? deviceBanner() : ''}
    ${isEve && airToday() ? `<div class="info dev-warn"><b>Сегодня был Air Shot</b><p>Если лоб розовый или чувствительный — переключи вечер на «отдых».</p></div>` : ''}
    <ol class="rsteps">${all.map((s, i) => stepHTML(s, i, done.includes(s.id), all.length, slot)).join('')}</ol>
    ${!all.length ? `<div class="empty"><p class="serif">в этой рутине пока нет шагов</p></div>` : ''}
    <div class="row" style="justify-content:center;margin-top:22px">
      ${ui.edit ? `<button class="btn orange" data-act="step-new">${ICONS.plus} Шаг</button><button class="btn outline" data-act="edit-toggle">Готово</button>
        <button class="btn small danger" data-act="season-copy">Скопировать из ${state.season === 'winter' ? 'летней' : 'зимней'} схемы</button>`
        : `<button class="btn outline" data-act="edit-toggle">Редактировать схему</button>`}
    </div>`}
    <div class="glow">${chromeStar(44, 'position:absolute;left:18%;top:-20px;transform:rotate(-14deg)')}<span class="bubble ${n && n === steps.length ? 'pop' : ''}">${n && n === steps.length ? 'всё сделано!' : 'glow up!'}</span></div>
  </section>`;
}

function stepHTML(s, i, isDone, total, slot = '') {
  const p = s.product ? product(s.product) : null;
  const flag = !p ? '' : p.status === 'order'
    ? `<button class="flag flag-btn" data-act="arrived" data-id="${p.id}">заказано · пришло?</button>`
    : ['pause', 'empty'].includes(p.status) ? `<span class="flag">${STATUS_MAP[p.status].name.toLowerCase()}</span>` : '';
  const uvA = slot === 'morning' && isSpfStep(s) ? spfAdvice() : null;
  const devNote = s.kind === 'modes' ? `<span class="uv-chip dev-chip">${esc(deviceModesNote())}</span>` : '';
  const uvNote = uvA ? `<span class="uv-chip ${uvA.skip ? 'skip' : ''}">☀ ${esc(uvA.short)}</span>` : '';
  return `<li class="rstep ${isDone && !ui.edit ? 'done' : ''}">
    <span class="rnum">${i + 1}</span>
    <button class="rthumb" ${p ? `data-act="open" data-id="${p.id}"` : ''}>${p ? artOf(p) : `<span class="noart">${ICONS.drop}</span>`}</button>
    <div class="rtext">
      <b>${esc(s.text || (p ? p.name : 'Шаг'))}</b>
      ${p ? `<small>${esc(p.brand)} · ${esc(p.name)}</small>` : ''}
      ${s.note ? `<div class="note">${esc(s.note)}</div>` : ''}${uvNote}${devNote}${flag}
    </div>
    ${ui.edit ? `<div class="edit-btns">
        ${i > 0 ? `<button data-act="step-up" data-id="${s.id}" aria-label="Выше">${ICONS.up}</button>` : ''}
        ${i < total - 1 ? `<button data-act="step-down" data-id="${s.id}" aria-label="Ниже">${ICONS.down}</button>` : ''}
        <button data-act="step-edit" data-id="${s.id}" aria-label="Изменить">✎</button></div>`
      : `<button class="rcheck" data-act="tick" data-id="${s.id}" aria-label="Отметить">${ICONS.check}</button>`}
  </li>`;
}

function moveStep(id, dir) {
  const arr = state.routines[ui.slot];
  const i = arr.findIndex(s => s.id === id), j = i + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]]; save(); render();
}

function tick(id) {
  const t = today();
  state.log[t] ||= {};
  const arr = state.log[t][ui.slot] ||= [];
  const k = arr.indexOf(id);
  if (k >= 0) arr.splice(k, 1); else arr.push(id);
  const keys = Object.keys(state.log).sort();
  while (keys.length > 400) delete state.log[keys.shift()];
  save(); render();
  const steps = state.routines[ui.slot];
  if (k < 0 && steps.every(s => state.log[t][ui.slot].includes(s.id))) confetti();
}

function confetti() {
  if (reduced) return;
  for (let i = 0; i < 18; i++) {
    const el = document.createElement('div');
    el.className = 'flyer';
    el.innerHTML = starSVG([C.orange, C.pink2, C.blue2, C.wine][i % 4], 9 + (i % 3) * 3);
    el.style.left = (innerWidth / 2) + 'px'; el.style.top = (innerHeight * .6) + 'px';
    document.body.appendChild(el);
    const a = Math.random() * Math.PI * 2, dd = 120 + Math.random() * 170;
    el.animate([{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * dd}px), calc(-50% + ${Math.sin(a) * dd - 120}px)) scale(1) rotate(${Math.random() * 360}deg)`, opacity: 0 }],
      { duration: 1100 + Math.random() * 500, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => el.remove();
  }
}

// ═════════ ЛЮБИМОЕ ═════════
function screenFav() {
  const list = state.products.filter(p => p.fav && live(p));
  return `<section class="screen fav ${enterCls()}">
    <div class="fav-head">
      <div><h1 class="title-xl">любимое</h1>${scribble(C.wine, 190)}</div>
      <div class="big-heart">${ICONS.heart}</div>
    </div>
    <p class="muted" style="margin-top:10px">${list.length ? `${list.length} ${plural(list.length, 'средство', 'средства', 'средств')}, без которых никак` : ''}</p>
    <div class="cgrid">${list.map((p, i) => catCard(p, i + 1, true)).join('')}</div>
    ${!list.length ? `<div class="empty"><p class="serif">пока пусто — нажми ♡ в каталоге или перетащи средство из косметички на «любимое»</p><button class="btn" data-act="tab" data-v="kit">к косметичке</button></div>` : ''}
    <div class="glow"><span class="bubble">keep it<br>close ♡</span></div>
  </section>`;
}
function plural(n, a, b, c) { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; }

// ═════════ ПРОФИЛЬ ═════════
function screenProfile() {
  const pr = state.profile;
  return `<section class="screen profile ${enterCls()}">
    <h1 class="title-xl">профиль</h1>${scribble(C.wine, 180)}

    <div class="tcard notebook" style="--bg:${C.cream};margin-top:22px">
      <div class="paper" style="clip-path:${tornClip('prof', 2.4)}"></div>
      <div class="in">
        <label class="field"><span>Имя</span><input class="input" data-pf="name" value="${esc(pr.name)}"></label>
        <div class="field"><span>Тип кожи</span><div class="opt-grid">${SKIN_TYPES.map(s => `<button class="opt ${pr.skin === s ? 'on' : ''}" data-act="pset" data-v="${s}">${s}</button>`).join('')}</div></div>
        <label class="field" style="margin:0"><span>О коже</span><textarea class="input" data-pf="notes">${esc(pr.notes)}</textarea></label>
      </div>
    </div>

    <div class="section"><h2 class="h2">оформление</h2></div>
    <div class="fx-pick">${[['script', 'курсив'], ['label', 'ярлыки'], ['puff', '3D'], ['flat', 'гротеск']].map(([v, n]) => `<button class="fx-opt ${state.fx === v ? 'on' : ''}" data-act="fx" data-v="${v}"><span class="fx-demo ${v === 'puff' ? 'd3' : v === 'label' ? 'dl' : v === 'script' ? 'ds' : ''}" data-text="Aa">${v === 'label' ? '<span class="lb">Aa</span>' : 'Aa'}</span><small>${n}</small></button>`).join('')}</div>

    <div class="section"><h2 class="h2">вечерний актив</h2></div>
    <div class="tcard" style="--bg:${C.pink}">
      <div class="paper" style="clip-path:${tornClip('act', 2.4)}"></div>
      <div class="in">
        <p class="muted" style="margin-bottom:12px">По этим настройкам схема сама подсказывает, какой сегодня вечер.</p>
        <label class="field"><span>Название</span><input class="input" data-pf="activeName" value="${esc(pr.activeName)}"></label>
        <div class="two">
          <label class="field" style="margin:0"><span>Начало</span><input class="input" type="date" data-pf="activeStart" value="${esc(pr.activeStart)}"></label>
          <label class="field" style="margin:0"><span>Через вечер, дней</span><input class="input" type="number" inputmode="numeric" min="0" max="60" data-pf="rampDays" value="${esc(pr.rampDays)}"></label>
        </div>
      </div>
    </div>

    ${analysisHTML()}

    <div class="section"><h2 class="h2">напоминания</h2>${ICONS.bell.replace('<svg', '<svg width="26"')}</div>
    <button class="banner" style="--b:${C.blue};width:100%;text-align:left" data-act="reminders">
      <div class="ico">${ICONS.calendar}</div>
      <div><b>Добавить в календарь iPhone</b><span>Азелик, конец паузы, сроки годности, бэкап, смена сезона</span></div></button>

    <div class="section"><h2 class="h2">резервная копия</h2>${chromeStar(30)}</div>
    <div class="tcard" style="--bg:${C.orange2}">
      <div class="paper" style="clip-path:${tornClip('bk', 2.4)}"></div>
      <div class="in">
        <p class="muted" style="color:var(--wine)">Данные хранятся только на этом телефоне. Сохрани файл в «Файлы» или на Яндекс Диск через «Поделиться».</p>
        <p class="serif" style="font-size:18px;margin:10px 0 14px">${state.lastBackup ? `последняя копия: ${fmtDate(state.lastBackup.slice(0, 10))}` : 'копий ещё не было'}</p>
        <div class="row">
          <button class="btn" data-act="backup">Сохранить копию</button>
          <label class="btn outline" style="position:relative;overflow:hidden">Восстановить<input type="file" accept=".json,application/json" id="restore" style="position:absolute;inset:0;opacity:0"></label>
        </div>
      </div>
    </div>

    <div class="section"><h2 class="h2">версия</h2></div>
    <div class="ver"><span class="ver-badge">v${APP_VERSION}</span><span class="muted">сборка ${APP_BUILD}</span>
      <button class="btn small outline" style="margin-left:auto" data-act="update">Проверить</button></div>
    ${CHANGELOG.map(c => `<div class="log-item"><b>${c.v}</b> <span class="muted">${c.d}</span><ul>${c.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}

    <div class="section"><h2 class="h2">данные</h2></div>
    <button class="btn danger" data-act="reset">Начать заново</button>
  </section>`;
}

function analysisHTML() {
  const a = analyze(state, today());
  const maxCat = Math.max(1, ...Object.values(a.stats.byCat));
  const acts = Object.entries(a.stats.actives).sort((x, y) => y[1] - x[1]);
  const colors = [C.pink, C.blue, C.butter, C.matcha2, C.caramel2, C.blue2];
  const verdict = a.score >= 85 ? 'схема в балансе' : a.score >= 65 ? 'есть что подправить' : 'кожу легко перегрузить';
  const alert = (w, c) => `<div class="alert" style="--c:${c}"><span class="s">${esc(w.slot)}</span><b>${esc(w.title)}</b><p>${esc(w.text)}</p></div>`;
  return `
    <div class="section"><h2 class="h2">анализ</h2>${chromeStar(30)}</div>
    <div class="score"><div class="score-badge">${plateSVG()}<b>${a.score}</b><small>баланс</small></div>
      <div><p class="serif" style="font-size:24px;line-height:1.05">${verdict}</p>
        <p class="muted" style="margin-top:6px">${a.warn.length} предупр. · ${a.info.length} заметок · ${a.good.length} удачных пар</p></div></div>
    <div style="margin-top:18px">
      ${a.back.map(p => `<div class="alert" style="--c:${C.blue2}"><span class="s">пауза закончилась</span><b>${esc(p.brand)} ${esc(p.name)}</b><p>Возвращай постепенно — раз в неделю в вечер без активов.</p><button class="btn small" style="margin-top:8px" data-act="qstatus" data-id="${p.id}" data-v="use">Вернуть в работу</button></div>`).join('')}
      ${a.warn.map(w => alert(w, C.orange)).join('')}
      ${a.info.map(w => alert(w, C.pink2)).join('')}
      ${a.good.map(w => alert(w, C.blue2)).join('')}
    </div>

    <div class="section"><h2 class="h2" style="font-size:24px">сроки годности</h2></div>
    ${a.expiry.length ? a.expiry.slice(0, 8).map(e => `<button class="exp" data-act="open" data-id="${e.p.id}">
      ${artOf(e.p)}<div><b style="font-size:14px">${esc(e.p.brand)} ${esc(e.p.name)}</b><div class="muted">до ${fmtDate(e.until)}</div></div>
      <span class="left ${e.left < 31 ? 'bad' : ''}">${e.left < 0 ? 'вышел' : e.left + ' дн.'}</span></button>`).join('')
      : `<p class="muted">Укажи дату вскрытия в карточке средства — и здесь появятся сроки.</p>`}

    <div class="section"><h2 class="h2" style="font-size:24px">список покупок</h2><button class="btn small outline" style="margin-left:auto" data-act="tab" data-v="shop">все покупки</button></div>
    <div class="tcard clipboard" style="--bg:#FFFFFF">
      <div class="paper" style="clip-path:${tornClip('shop', 2.4)}"></div>
      <div class="in">
      ${a.shopping.length ? a.shopping.map(s => `<div class="shop"><span class="box"></span><div><b>${esc(s.p.brand)}</b> ${esc(s.p.name)}</div><span class="why">${s.why}</span></div>`).join('')
        + `<button class="btn small" style="margin-top:14px" data-act="copy-shop">Скопировать список</button>`
        : `<p class="serif" style="font-size:18px">всё есть ✦</p>`}
      </div>
    </div>

    ${a.dupes.length ? `<div class="section"><h2 class="h2" style="font-size:24px">дубли</h2></div>${a.dupes.map(d => `<div class="alert" style="--c:${C.orange2}"><span class="s">${esc(d.type)}</span><b>${d.items.length} открыты одновременно</b><p>${d.items.map(p => esc(p.brand || p.name)).join(', ')}. Можно заканчивать по одному — ничего не успеет испортиться.</p></div>`).join('')}` : ''}

    <div class="section"><h2 class="h2" style="font-size:24px">что в коллекции</h2></div>
    ${CATEGORIES.map(c => `<div class="bar-row"><span>${c.name}</span><div class="bar">${a.stats.byCat[c.id] ? `<i style="width:${a.stats.byCat[c.id] / maxCat * 100}%;--c:${c.color}"></i>` : ''}</div><b>${a.stats.byCat[c.id]}</b></div>`).join('')}
    ${a.stats.spent ? `<p class="serif" style="font-size:18px;margin-top:10px">вложено ≈ ${a.stats.spent.toLocaleString('ru-RU')} ₽</p>` : ''}
    ${acts.length ? `<div class="section"><h2 class="h2" style="font-size:24px">активы в работе</h2></div><div class="act-cloud">${acts.map(([id, n], i) => `<span style="--c:${colors[i % colors.length]}">${esc(ACTIVE_MAP[id]?.name || id)} · ${n}</span>`).join('')}</div>` : ''}`;
}

// ═════════ ШТОРКИ ═════════
function openSheet(html) {
  const sh = $('#sheet'), sc = $('#scrim');
  sh.innerHTML = `<div class="grab"></div><button class="x" data-act="close" aria-label="Закрыть">${ICONS.close}</button>${html}`;
  if (!sh.classList.contains('show')) { sh.scrollTop = 0; sc.hidden = false; requestAnimationFrame(() => { sc.classList.add('show'); sh.classList.add('show'); }); }
  document.body.style.overflow = 'hidden';
}
function closeSheet() {
  const sh = $('#sheet'), sc = $('#scrim');
  sh.classList.remove('show'); sc.classList.remove('show');
  setTimeout(() => { if (!sh.classList.contains('show')) sc.hidden = true; }, 320);
  document.body.style.overflow = '';
  draft = null; stepDraft = null;
}
const sheetOpen = () => $('#sheet').classList.contains('show');

function openProduct(id) {
  const p = product(id); if (!p) return;
  const ins = productInsights(p, state, today());
  const st = STATUS_MAP[p.status];
  const feats = ins.actives.slice(0, 3);
  const featIcons = [ICONS.drop, ICONS.spark, ICONS.leaf];
  openSheet(`
    <div class="pd-hero">
      ${blob('pd-b' + id, C.blue, 'left:-6%;top:6%;width:78%;height:86%;transform:rotate(-4deg)')}
      ${blob('pd-o' + id, C.pink2, 'right:-8%;bottom:6%;width:40%;height:46%;transform:rotate(10deg)')}
      ${blob('pd-w' + id, C.lav2, 'right:-6%;top:-6%;width:30%;height:30%;transform:rotate(-12deg)')}
      <div class="pd-art">${artOf(p)}</div>
      ${burst(st.name.toLowerCase(), st.id === 'use' ? C.pink2 : st.color)}
      <button class="heart-btn big ${p.fav ? 'on' : ''}" data-act="fav" data-id="${p.id}" aria-label="В любимое">${ICONS.heart}</button>
    </div>
    <h2 class="pd-name">${esc(p.name)}</h2>
    <p class="pd-brand">${esc(p.brand)} · ${esc(TYPE_MAP[p.type]?.name || '')}</p>
    ${feats.length ? `<div class="pd-feats">${feats.map((a, i) => `<div>${featIcons[i]}${esc(a.name)}</div>`).join('')}</div>` : '<div style="height:16px"></div>'}
    <div class="pd-actions">
      <button class="btn" data-act="pick-slot" data-id="${p.id}">${ICONS.routine} в уход</button>
      <button class="btn outline" data-act="kit" data-id="${p.id}">${inKit(p) ? `${ICONS.shelf} на полку` : `${ICONS.bag} в косметичку`}</button>
    </div>
    <div class="kicker" style="margin-bottom:8px">статус</div>
    <div class="opt-grid">${STATUSES.map(s => `<button class="opt ${p.status === s.id ? 'on' : ''}" data-act="qstatus" data-id="${p.id}" data-v="${s.id}">${s.name}</button>`).join('')}</div>
    ${p.note ? `<div class="note-card">${esc(p.note)}</div>` : '<div style="height:16px"></div>'}
    ${p.inci ? `<div class="kicker">состав</div>${inciHTML(parseInci(p.inci))}` : ''}
    ${ins.actives.length ? `<div class="kicker">что внутри и зачем</div><div class="info-list">${ins.actives.map(a => `<div class="info"><b>${esc(a.name)}</b>${a.text ? `<p>${esc(a.text)}</p>` : ''}</div>`).join('')}</div>` : ''}
    ${ins.clashes.length ? `<div class="kicker">осторожно сочетать</div><div class="info-list">${ins.clashes.map(c => `<div class="info warn"><p style="color:var(--wine)">${esc(c)}</p></div>`).join('')}</div>` : ''}
    <div class="info-list">
      <div class="info"><b>В схеме</b><p>${ins.routines.length ? esc(ins.routines.join(', ')) : 'пока не используется'}</p></div>
      ${ins.expiry ? `<div class="info"><b>Годен после вскрытия до ${fmtDate(ins.expiry.until)}</b><p>${ins.expiry.left < 0 ? 'срок вышел' : `осталось ${ins.expiry.left} дн.`} · открыто ${fmtDate(p.opened)}</p></div>` : ''}
      ${p.status === 'pause' && p.pauseUntil ? `<div class="info"><b>Пауза до ${fmtDate(p.pauseUntil)}</b></div>` : ''}
      ${p.price || p.volume ? `<div class="info"><b>${p.price ? `${Number(p.price).toLocaleString('ru-RU')} ₽` : ''}${p.price && p.volume ? ' · ' : ''}${esc(p.volume)}</b></div>` : ''}
    </div>
    ${p.url ? `<a class="btn outline" style="width:100%;margin-bottom:12px" href="${esc(safeUrl(p.url))}" target="_blank" rel="noopener">${ICONS.link} Открыть ссылку</a>` : ''}
    ${p.status === 'order' ? `<button class="btn orange" style="width:100%;margin-bottom:12px" data-act="arrived" data-id="${p.id}">${ICONS.bag} Пришло — в косметичку</button>` : ''}
    ${['low', 'wish'].includes(p.status) || p.rebuy === 'yes' ? `<button class="btn orange" style="width:100%;margin-bottom:12px" data-act="bought" data-id="${p.id}">${ICONS.cart} Купила</button>` : ''}
    ${p.inci ? `<details class="inci-box"><summary>Состав — исходный текст</summary><p>${esc(p.inci)}</p></details>` : ''}
    <div class="row between">
      <button class="btn danger" data-act="del" data-id="${p.id}" aria-label="Удалить">${ICONS.trash}</button>
      <button class="btn orange" data-act="edit" data-id="${p.id}">Изменить</button>
    </div>`);
}

function openSlotPicker(id) {
  const p = product(id); if (!p) return;
  openSheet(`<div class="mini-p">${artOf(p)}<div><div class="kicker">в уход</div><h2 class="pd-name" style="font-size:24px">${esc(p.name)}</h2><p class="muted">Отметь рутины — шаг добавится в конец, его можно передвинуть.</p></div></div>
    <div class="slot-pick">${ROUTINE_SLOTS.map(s => {
      const on = (state.routines[s.id] || []).some(x => x.product === id);
      return `<button class="${on ? 'on' : ''}" style="--t:${s.tint}" data-act="slot-toggle" data-id="${id}" data-v="${s.id}">${ICONS[s.icon]}${s.name}<span class="box">${ICONS.check}</span></button>`;
    }).join('')}</div>
    <div class="row between"><button class="btn outline" data-act="open" data-id="${id}">Карточка</button><button class="btn" data-act="close">Готово</button></div>`);
}

function editProduct(id, preset = null) {
  const p = id ? product(id) : null;
  draft = p ? JSON.parse(JSON.stringify(p)) : {
    id: uid(), name: '', brand: '', cat: ui.tab === 'catalog' && ui.cat !== 'all' ? ui.cat : 'face', type: '', status: 'use', actives: [],
    opened: '', pao: 12, price: '', volume: '', rating: 0, note: '', color: '', photo: '', pauseUntil: '', created: today(),
    fav: ui.tab === 'fav', kit: ui.tab === 'catalog' ? 'shelf' : 'bag', pos: null,
  };
  if (preset && !p) Object.assign(draft, preset);
  draft.url ||= ''; draft.inci ||= '';
  if (!draft.type) draft.type = TYPES[draft.cat][0][0];
  if (!draft.color) draft.color = CAT_MAP[draft.cat].color;
  renderForm(!!p);
}

function renderForm(existing) {
  const d = draft;
  const scroll = $('#sheet')?.scrollTop || 0;
  openSheet(`<h2 class="pd-name" style="margin-top:4px">${existing ? 'изменить средство' : 'новое средство'}</h2>
    <div class="form-hero">
      <div>${d.photo ? `<img class="photo" src="${d.photo}" alt="">` : `<div class="tile" style="--bg:${CAT_MAP[d.cat].color}">${productArt(TYPE_MAP[d.type]?.shape, d.color, d.brand || d.name)}</div>`}</div>
      <div class="stack">
        <label class="btn outline small" style="position:relative;overflow:hidden">${ICONS.camera} ${d.photo ? 'Другое фото' : 'Фото'}<input type="file" accept="image/*" id="photo" style="position:absolute;inset:0;opacity:0"></label>
        ${d.photo ? `<button class="btn outline small" data-act="nophoto">Вернуть рисунок</button>` : ''}
      </div>
    </div>
    <label class="field"><span>Бренд</span><input class="input" data-f="brand" value="${esc(d.brand)}" placeholder="Dr.Althea"></label>
    <label class="field"><span>Название</span><input class="input" data-f="name" value="${esc(d.name)}" placeholder="345 Relief Cream"></label>
    <div class="field"><span>Раздел</span><div class="opt-grid">${CATEGORIES.map(c => `<button class="opt ${d.cat === c.id ? 'on' : ''}" data-act="fcat" data-v="${c.id}">${c.name}</button>`).join('')}</div></div>
    <div class="field"><span>Тип</span><div class="opt-grid">${TYPES[d.cat].map(([id, n]) => `<button class="opt ${d.type === id ? 'on' : ''}" data-act="fset" data-f="type" data-v="${id}">${n}</button>`).join('')}</div></div>
    <div class="field"><span>Где лежит</span><div class="opt-grid">${[['bag', 'В косметичке'], ['table', 'На столе'], ['shelf', 'На полке']].map(([v, n]) => `<button class="opt ${d.kit === v ? 'on' : ''}" data-act="fset" data-f="kit" data-v="${v}">${n}</button>`).join('')}</div></div>
    <div class="field"><span>Статус</span><div class="opt-grid">${STATUSES.map(s => `<button class="opt ${d.status === s.id ? 'on' : ''}" data-act="fset" data-f="status" data-v="${s.id}">${s.name}</button>`).join('')}</div></div>
    ${d.status === 'pause' ? `<label class="field"><span>Пауза до</span><input class="input" type="date" data-f="pauseUntil" value="${esc(d.pauseUntil)}"></label>` : ''}
    <div class="field"><span>Активы и состав</span><div class="opt-grid">${ACTIVES.filter(([id]) => ui.allActs || ACTIVES_MAIN.includes(id) || d.actives.includes(id)).map(([id, n]) => `<button class="opt ${d.actives.includes(id) ? 'on' : ''}" data-act="fact" data-v="${id}">${n}</button>`).join('')}
      <button class="opt more" data-act="allacts">${ui.allActs ? 'свернуть' : `ещё ${ACTIVES.filter(([id]) => !ACTIVES_MAIN.includes(id) && !d.actives.includes(id)).length}`}</button></div></div>
    <div class="field"><span>Цвет стикера</span><div class="swatches">${SWATCHES.map(c => `<button class="sw ${d.color === c ? 'on' : ''}" style="background:${c}" data-act="fset" data-f="color" data-v="${c}" aria-label="${c}"></button>`).join('')}</div></div>
    <div class="two">
      <label class="field"><span>Открыто</span><input class="input" type="date" data-f="opened" value="${esc(d.opened)}"></label>
      <label class="field"><span>Срок, мес</span><input class="input" type="number" inputmode="numeric" min="1" max="60" data-f="pao" value="${esc(d.pao)}"></label>
    </div>
    <div class="two">
      <label class="field"><span>Цена, ₽</span><input class="input" type="number" inputmode="numeric" data-f="price" value="${esc(d.price)}"></label>
      <label class="field"><span>Объём</span><input class="input" data-f="volume" value="${esc(d.volume)}" placeholder="50 мл"></label>
    </div>
    ${d.type === 'spf' || d.cat === 'makeup' || d.type === 'bodyspf' ? `<label class="field"><span>SPF</span><input class="input" type="number" inputmode="numeric" min="0" max="100" data-f="spf" value="${esc(d.spf || '')}" placeholder="например, 50"></label>` : ''}
    <label class="field"><span>Ссылка на магазин</span><input class="input" type="url" inputmode="url" data-f="url" value="${esc(d.url || '')}" placeholder="https://…"></label>
    <div class="field"><span>Состав (INCI)</span>
      <textarea class="input" data-f="inci" placeholder="Вставь состав с упаковки или сайта: Aqua, Glycerin, Niacinamide…">${esc(d.inci || '')}</textarea>
      <button class="btn small" style="justify-self:start;margin-top:4px" data-act="inci">${ICONS.spark} Разобрать состав</button>
      ${d._inci ? inciHTML(d._inci) : ''}
      ${d._inci ? (d._inci.found.length ? `<div class="inci-found">${d._inci.found.map(f => `<span>${esc(ACTIVE_MAP[f.active]?.name || f.active)} <small>${esc(f.ing)} · №${f.pos}</small></span>`).join('')}</div>
        <p class="muted">Нашла ${d._inci.found.length} из ${d._inci.count} ингредиентов — отмечены в «Активах» выше.</p>` : `<p class="muted">Активов из списка не нашла (${d._inci.count} ингредиентов).</p>`) : ''}
    </div>
    <div class="field"><span>Любимое</span><div class="opt-grid"><button class="opt ${d.fav ? 'on' : ''}" data-act="fset" data-f="fav" data-v="${d.fav ? '' : '1'}">♥ в любимом</button></div></div>
    <div class="field"><span>Оценка</span><div class="stars-input">${[1, 2, 3, 4, 5].map(n => `<button data-act="fset" data-f="rating" data-v="${n === d.rating ? 0 : n}" aria-label="${n}">${starSVG(n <= d.rating ? C.orange : C.cream2, 12)}</button>`).join('')}</div></div>
    <label class="field"><span>Заметка</span><textarea class="input" data-f="note" placeholder="Как и когда наносить, впечатления">${esc(d.note)}</textarea></label>
    <div class="row between">
      <button class="btn outline" data-act="${existing ? 'open' : 'close'}" data-id="${d.id}">Отмена</button>
      <button class="btn orange" data-act="fsave">Сохранить</button>
    </div>`);
  $('#sheet').scrollTop = scroll;
}

async function loadPhoto(file) {
  const img = new Image(), url = URL.createObjectURL(file);
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const max = 640, k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return c.toDataURL('image/jpeg', .8);
}

function stepSheet(id) {
  const s = id ? state.routines[ui.slot].find(x => x.id === id) : null;
  stepDraft = s ? { ...s } : { id: uid(), product: '', text: '', note: '' };
  renderStepSheet(!!s);
}
function renderStepSheet(existing) {
  const d = stepDraft;
  const avail = state.products.filter(live);
  const groups = CATEGORIES.map(c => ({ c, items: avail.filter(p => p.cat === c.id) })).filter(g => g.items.length);
  openSheet(`<h2 class="pd-name" style="margin-top:4px">${existing ? 'шаг' : 'новый шаг'}</h2>
    <p class="muted" style="margin:4px 0 16px">${ROUTINE_SLOTS.find(s => s.id === ui.slot).name}</p>
    <label class="field"><span>Что сделать</span><input class="input" data-sf="text" value="${esc(d.text)}" placeholder="Например: тонким слоем на лоб"></label>
    <label class="field"><span>Заметка</span><input class="input" data-sf="note" value="${esc(d.note)}" placeholder="Необязательно"></label>
    <div class="field"><span>Средство</span>
      <div class="opt-grid"><button class="opt ${!d.product ? 'on' : ''}" data-act="sp" data-v="">Без средства</button></div>
      ${groups.map(g => `<div class="kicker" style="margin-top:10px">${g.c.name}</div><div class="opt-grid">
        ${g.items.map(p => `<button class="opt ${d.product === p.id ? 'on' : ''}" data-act="sp" data-v="${p.id}">${esc(p.brand ? p.brand + ' · ' : '')}${esc(p.name)}</button>`).join('')}</div>`).join('')}
    </div>
    <div class="row between" style="margin-top:18px">
      ${existing ? `<button class="btn danger" data-act="step-del">${ICONS.trash} Удалить</button>` : '<span></span>'}
      <button class="btn orange" data-act="step-save">Сохранить</button>
    </div>`);
}

// ═════════ БЭКАП ═════════
async function doBackup() {
  const payload = { app: 'glowbag', version: APP_VERSION, exported: new Date().toISOString(), state };
  const name = `glowbag-backup-${today()}.json`;
  const blobF = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const file = new File([blobF], name, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'glowbag — копия' });
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blobF); a.download = name;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
    state.lastBackup = new Date().toISOString(); save(); render(); toast('Копия сохранена ✦');
  } catch (e) { if (e?.name !== 'AbortError') toast('Не получилось сохранить копию'); }
}

async function doRestore(file) {
  try {
    const data = JSON.parse(await file.text());
    const s = data.state || data;
    if (!Array.isArray(s.products) || !s.routines) throw new Error('bad');
    if (!confirm(`Восстановить копию от ${data.exported ? fmtDate(data.exported.slice(0, 10)) : '?'}? Текущие данные заменятся.`)) return;
    state = migrate(Object.assign(seedState(), s)); save(); render(); toast('Копия восстановлена');
  } catch { toast('Это не файл копии glowbag'); }
}

// переход со старой версии: косметичка, любимое, цвета палитры
function migrate(s) {
  const base = seedState();
  s.profile = Object.assign(base.profile, s.profile || {});
  s.routines = Object.assign({ morning: [], day: [], eveA: [], eveB: [], weekly: [], device: [] }, s.routines || {});
  s.log ||= {};
  if ((s.schema || 1) < 2) {
    for (const p of s.products) {
      p.fav = p.fav ?? (p.rating >= 4);
      p.kit = p.kit || (['use', 'low'].includes(p.status) ? 'bag' : 'shelf');
      p.pos = p.pos || null;
      p.color = nearestSwatch(p.color);
    }
    s.schema = 2;
  }
  if ((s.schema || 2) < 3) {
    const ids = new Set(s.products.map(p => p.id));
    const summer = seedSummer();
    for (const k of Object.keys(summer)) summer[k].forEach(st => { if (st.product && !ids.has(st.product)) st.product = ''; });
    s.season ||= 'winter';
    s.altRoutines ||= summer;
    s.schema = 3;
  }
  if ((s.schema || 3) < 4) {
    for (const p of s.products) { const k = (p.color || '').toUpperCase(); if (OLD_COLORS[k]) p.color = OLD_COLORS[k]; }
    s.schema = 4;
  }
  if ((s.schema || 4) < 5) {
    for (const p of s.products) { const k = (p.color || '').toUpperCase(); if (PALETTE_22[k]) p.color = PALETTE_22[k]; }
    s.schema = 5;
  }
  if ((s.schema || 5) < 6) {
    for (const p of s.products) { const k = (p.color || '').toUpperCase(); if (PALETTE_23[k]) p.color = PALETTE_23[k]; }
    s.schema = 6;
  }
  if ((s.schema || 6) < 7) {
    for (const p of s.products) { const k = (p.color || '').toUpperCase(); if (PALETTE_24[k]) p.color = PALETTE_24[k]; }
    s.fx = 'label';
    s.schema = 7;
  }
  if ((s.schema || 7) < 8) { s.fx = 'script'; s.schema = 8; }
  if ((s.schema || 8) < 9) {
    // BB Dr.Jart+ — SPF 50
    for (const p of s.products) if (/jart/i.test(`${p.brand} ${p.name}`) && (p.cat === 'makeup' || /bb|balm/i.test(p.name))) { p.spf = p.spf || 50; p.actives = [...new Set([...(p.actives || []), 'spf'])]; }
    // если заказанное средство уже добавлено заново как «использую» — шаги ухода переводим на него
    const norm = x => String(x || '').toLowerCase().replace(/[^a-zа-я0-9]/g, '');
    for (const o of s.products.filter(p => p.status === 'order')) {
      const twin = s.products.find(p => p !== o && p.status === 'use' && norm(p.brand) && norm(p.brand) === norm(o.brand) && p.type === o.type);
      if (!twin) continue;
      for (const set of [s.routines, s.altRoutines || {}]) for (const k of Object.keys(set)) (set[k] || []).forEach(st => { if (st.product === o.id) st.product = twin.id; });
    }
    // старая подсказка «пока нет SPF» больше не нужна
    for (const set of [s.routines, s.altRoutines || {}]) for (const k of Object.keys(set)) (set[k] || []).forEach(st => { if (/^Пока нет SPF/.test(st.note || '')) st.note = ''; });
    s.schema = 9;
  }
  if ((s.schema || 9) < 10) {
    s.device = Object.assign({ ...DEVICE_DEFAULTS }, s.device || {});
    if (!s.products.some(p => /jelly/i.test(p.name) && /althea/i.test(p.brand))) {
      const fresh = seedState().products.find(p => p.id === 'althea-jelly');
      if (fresh && !s.products.some(p => p.id === 'althea-jelly')) s.products.push(fresh);
    }
    const jelly = s.products.find(p => /jelly/i.test(p.name) && /althea/i.test(p.brand));
    const ids = new Set(s.products.map(p => p.id));
    if (!s.routines.device?.length) {
      s.routines.device = seedDevice().map(st => {
        if (st.product === 'althea-jelly' && jelly) st.product = jelly.id;
        if (st.product && !ids.has(st.product) && st.product !== jelly?.id) st.product = '';
        return st;
      });
    }
    if (s.altRoutines && !s.altRoutines.device) s.altRoutines.device = JSON.parse(JSON.stringify(s.routines.device));
    s.schema = 10;
  }
  if ((s.schema || 10) < 11) {
    if (!s.products.some(p => p.type === 'device')) {
      const fresh = seedState().products.find(p => p.id === 'age-r');
      if (fresh) { fresh.opened = s.device?.arrived || ''; s.products.unshift(fresh); }
    }
    const devP = s.products.find(p => p.type === 'device');
    for (const set of [s.routines, s.altRoutines || {}]) (set.device || []).forEach(st => { if (st.kind === 'modes' && !st.product && devP) st.product = devP.id; });
    s.schema = 11;
  }
  s.device = Object.assign({ ...DEVICE_DEFAULTS }, s.device || {});
  if (!s.fx || s.fx === 'fur') s.fx = 'script';
  s.spend ||= []; s.empties ||= []; s.eveMode ||= {};
  s.reminders = Object.assign({ ...REMINDER_DEFAULTS, off: [] }, s.reminders || {});
  for (const p of s.products) { if (!p.kit) p.kit = 'shelf'; if (p.kit === 'table' && !p.pos) p.kit = 'bag'; p.url ??= ''; p.inci ??= ''; p.rebuy ??= ''; p.spf ??= ''; }
  return s;
}

// ═════════ КАЛЕНДАРЬ УХОДА ═════════
const WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

function dayInfo(d) {
  const l = state.log[d] || {};
  const len = k => (l[k] || []).length;
  const m = len('morning') > 0, eve = len('eveA') + len('eveB') > 0;
  const any = Object.values(l).some(a => a.length);
  const active = len('eveA') > 0 || state.eveMode?.[d] === 'A';
  return { m, eve, active, any, level: m && eve ? 3 : (m || eve) ? 2 : any ? 1 : 0 };
}
const careDay = d => dayInfo(d).level >= 2 || !!state.eveMode?.[d];

function streaks() {
  const t = today();
  let cur = 0, d = careDay(t) ? t : addDays(t, -1);
  while (careDay(d)) { cur++; d = addDays(d, -1); }
  const days = Object.keys(state.log).filter(careDay).sort();
  let best = 0, run = 0, prev = '';
  for (const x of days) { run = prev && addDays(prev, 1) === x ? run + 1 : 1; best = Math.max(best, run); prev = x; }
  return { cur, best: Math.max(best, cur) };
}

function streakBadge() {
  const { cur } = streaks();
  return `<div class="streak-badge">${plateSVG()}<span>${ICONS.flame}</span><b>${cur}</b><small>${plural(cur, 'день', 'дня', 'дней')}<br>подряд</small></div>`;
}

function calendarHTML() {
  const t = today();
  const ym = ui.calMonth || t.slice(0, 7); ui.calMonth = ym;
  const [y, m] = ym.split('-').map(Number);
  const first = `${ym}-01`;
  const startWd = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const nDays = new Date(y, m, 0).getDate();
  const { cur, best } = streaks();
  let activeN = 0, careN = 0;
  const cells = [];
  for (let i = 0; i < startWd; i++) cells.push('<span class="cal-cell blank"></span>');
  for (let i = 1; i <= nDays; i++) {
    const d = `${ym}-${String(i).padStart(2, '0')}`;
    const info = dayInfo(d), future = d > t;
    if (info.active) activeN++;
    if (info.level >= 2) careN++;
    const planned = future && plannedMode(d) === 'A';
    cells.push(`<button class="cal-cell l${future ? 'f' : info.level} ${d === t ? 'is-today' : ''}" ${future ? 'disabled' : `data-act="day" data-v="${d}"`} aria-label="${fmtDate(d)}">
      <span>${i}</span>${info.active ? '<i class="dot"></i>' : planned ? '<i class="dot plan"></i>' : ''}</button>`);
  }
  return `
    <div class="cal-stats">
      <div class="stat" style="--bg:${C.orange}">${ICONS.flame}<b>${best}</b><small>лучшая серия</small></div>
      <div class="stat" style="--bg:${C.pink}"><b>${careN}</b><small>${plural(careN, 'день', 'дня', 'дней')} с уходом</small></div>
      <div class="stat" style="--bg:${C.blue}"><b>${activeN}</b><small>${esc(state.profile.activeName || 'актив')} · вечера</small></div>
    </div>
    <div class="tcard notebook" style="--bg:${C.cream};margin-top:22px">
      <div class="paper" style="clip-path:${tornClip('cal' + ym, 2)}"></div>
      <div class="in">
        <div class="cal-head">
          <button class="round-btn" data-act="cal-nav" data-v="-1" aria-label="Предыдущий месяц">${ICONS.back}</button>
          <b>${MONTHS[m - 1]} ${y}</b>
          <button class="round-btn" data-act="cal-nav" data-v="1" aria-label="Следующий месяц" ${ym >= t.slice(0, 7) ? 'disabled' : ''}>${ICONS.arrow}</button>
        </div>
        <div class="cal-grid">${WD.map(w => `<span class="cal-wd">${w}</span>`).join('')}${cells.join('')}</div>
        <p class="muted" style="margin-top:10px">Нажми на день, чтобы посмотреть или отметить забытое.</p>
      </div>
    </div>
    <div class="cal-legend">
      <span><i class="lg l0"></i>ничего</span><span><i class="lg l1"></i>чуть-чуть</span><span><i class="lg l2"></i>утро или вечер</span><span><i class="lg l3"></i>утро и вечер</span>
      <span><i class="lg dotlg"></i>${esc(state.profile.activeName || 'актив')}</span><span><i class="lg dotlg plan"></i>по плану</span>
    </div>`;
}

function openDay(d) {
  const l = state.log[d] || {};
  const eve = eveFor(d);
  openSheet(`<div class="kicker">${d === today() ? 'сегодня' : 'было'}</div>
    <h2 class="pd-name" style="margin:4px 0 10px">${new Date(d + 'T12:00').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
    <div class="kicker" style="margin-bottom:6px">какой был вечер</div>
    ${eveSwitch(d, 'dmode')}
    ${ROUTINE_SLOTS.filter(s => !s.id.startsWith('eve') || s.id === eve.slot).map(s => {
      const steps = state.routines[s.id] || [];
      if (!steps.length) return '';
      const done = l[s.id] || [];
      return `<div class="day-slot"><div class="day-slot-h" style="--t:${s.tint}">${ICONS[s.icon]}${s.name}<span>${steps.filter(x => done.includes(x.id)).length}/${steps.length}</span></div>
        ${steps.map(st => { const p = st.product ? product(st.product) : null; const on = done.includes(st.id);
          return `<button class="day-step ${on ? 'on' : ''}" data-act="dtick" data-d="${d}" data-slot="${s.id}" data-id="${st.id}"><span class="box">${ICONS.check}</span><span>${esc(st.text || p?.name || 'Шаг')}${p ? `<small>${esc(p.brand)}</small>` : ''}</span></button>`; }).join('')}
      </div>`;
    }).join('')}
    <button class="btn" style="width:100%;margin-top:10px" data-act="close">Готово</button>`);
}

function dayTick(d, slot, id) {
  state.log[d] ||= {};
  const arr = state.log[d][slot] ||= [];
  const k = arr.indexOf(id);
  if (k >= 0) arr.splice(k, 1); else arr.push(id);
  if (!Object.values(state.log[d]).some(a => a.length)) delete state.log[d];
  save();
  const keep = $('#sheet').scrollTop; openDay(d); $('#sheet').scrollTop = keep;
  render();
}

// ═════════ СЕЗОНЫ ═════════
function switchSeason(v) {
  if (state.season === v) return;
  [state.routines, state.altRoutines] = [state.altRoutines, state.routines];
  // аппарат не зависит от сезона — шаги переезжают вместе
  if (state.altRoutines.device) { state.routines.device = state.altRoutines.device; }
  state.season = v; ui.enter = true; save(); render();
  toast(v === 'winter' ? '❄ Зимняя схема' : '☀ Летняя схема');
}
function copySeason() {
  const from = state.season === 'winter' ? 'летней' : 'зимней';
  if (!confirm(`Заменить текущую схему копией ${from}? Текущие шаги удалятся.`)) return;
  const copy = JSON.parse(JSON.stringify(state.altRoutines));
  for (const k of Object.keys(copy)) copy[k].forEach(s => s.id = uid());
  state.routines = Object.assign({ morning: [], day: [], eveA: [], eveB: [], weekly: [] }, copy);
  save(); render(); toast('Схема скопирована');
}

// ═════════ НАПОМИНАНИЯ ═════════
function openReminders(keepScroll) {
  const s = state.reminders;
  const evs = buildReminders(state, today(), s);
  const scroll = keepScroll ? $('#sheet').scrollTop : 0;
  openSheet(`<div class="kicker">календарь iPhone</div>
    <h2 class="pd-name" style="margin:4px 0 8px">напоминания</h2>
    <p class="muted">Выбери события — они добавятся в обычный календарь с уведомлением. После изменений в схеме можно добавить заново.</p>
    <div class="two" style="margin-top:16px">
      <label class="field"><span>Вечерние</span><input class="input" type="time" data-rf="evening" value="${esc(s.evening)}"></label>
      <label class="field"><span>Дневные</span><input class="input" type="time" data-rf="day" value="${esc(s.day)}"></label>
    </div>
    <div class="rem-list">${evs.map(e => `<button class="rem ${s.off.includes(e.id) ? '' : 'on'}" data-act="rem-toggle" data-id="${e.id}">
      <span class="box">${ICONS.check}</span>
      <span class="rem-t"><b>${esc(e.title)}</b><small>${fmtDate(e.date)}${e.rrule === 'FREQ=WEEKLY' ? ', потом каждую неделю' : e.rrule === 'FREQ=YEARLY' ? ', каждый год' : ''} · ${e.kind === 'Схема' || e.kind === 'Пауза' ? esc(s.evening) : esc(s.day)}</small></span>
      <span class="rem-k">${esc(e.kind)}</span></button>`).join('')}</div>
    <button class="btn orange" style="width:100%" data-act="ics-open">${ICONS.calendar} Добавить в календарь</button>
    <button class="btn outline" style="width:100%;margin-top:10px" data-act="ics-share">Сохранить файл .ics</button>
    <p class="muted" style="margin-top:12px">iPhone покажет список событий — нажми «Добавить все». Если окно не открылось, сохрани файл в «Файлы» и открой его оттуда. При повторном добавлении старые события лучше удалить, чтобы не задвоились.</p>`);
  $('#sheet').scrollTop = scroll;
}

async function exportICS(share) {
  const s = state.reminders;
  const evs = buildReminders(state, today(), s).filter(e => !s.off.includes(e.id))
    .map(e => ({ ...e, time: e.kind === 'Схема' || e.kind === 'Пауза' ? s.evening : s.day }));
  if (!evs.length) { toast('Не выбрано ни одного события'); return; }
  const ics = toICS(evs);
  const file = new File([ics], 'glowbag-reminders.ics', { type: 'text/calendar' });
  if (share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'glowbag — напоминания' }); } catch {}
    return;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; if (share) a.download = 'glowbag-reminders.ics';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  toast(`${evs.length} ${plural(evs.length, 'событие', 'события', 'событий')} для календаря`);
}

// ═════════ ПОКУПКИ ═════════
const safeUrl = u => { const x = String(u || '').trim(); return /^https?:\/\//i.test(x) ? x : x ? 'https://' + x : ''; };
const money = n => `${Math.round(Number(n) || 0).toLocaleString('ru-RU')} ₽`;
let boughtDraft = null, spendDraft = null;

function shopLists() {
  const low = state.products.filter(p => p.status === 'low');
  const rebuy = state.products.filter(p => p.status === 'empty' && p.rebuy === 'yes');
  const wish = state.products.filter(p => p.status === 'wish');
  const order = state.products.filter(p => p.status === 'order');
  return { low, rebuy, wish, order };
}

function shopTeaser() {
  const { low, rebuy, wish } = shopLists();
  const n = low.length + rebuy.length + wish.length;
  if (!n) return '';
  return `<button class="banner" style="--b:${C.orange2};width:100%;text-align:left;margin-top:24px" data-act="tab" data-v="shop">
    <div class="ico">${ICONS.cart}</div>
    <div><b>${n} в списке покупок</b><span>${low.length ? `${low.length} заканчивается` : ''}${low.length && (rebuy.length || wish.length) ? ' · ' : ''}${rebuy.length ? `${rebuy.length} купить снова` : ''}${rebuy.length && wish.length ? ' · ' : ''}${wish.length ? `${wish.length} хочу` : ''}</span></div></button>`;
}

function shopRow(p, why) {
  return `<div class="shop-row">
    <button class="shop-art" data-act="open" data-id="${p.id}">${artOf(p)}</button>
    <div class="shop-txt"><small>${esc(p.brand)}</small><b>${esc(p.name)}</b>
      <span>${why}${p.price ? ` · <b class="price">${money(p.price)}</b>` : ''}</span></div>
    <div class="shop-btns">
      ${p.url ? `<a class="mini-btn" href="${esc(safeUrl(p.url))}" target="_blank" rel="noopener" aria-label="Ссылка">${ICONS.link}</a>` : ''}
      ${p.status !== 'order' ? `<button class="mini-btn wine" data-act="bought" data-id="${p.id}" aria-label="Купила">${ICONS.check}</button>` : `<button class="mini-btn" data-act="qstatus" data-id="${p.id}" data-v="use" aria-label="Пришло">${ICONS.bag}</button>`}
    </div></div>`;
}

function screenShop() {
  const tab = ui.shopTab;
  const segs = [['list', 'список', ICONS.cart], ['empty', 'пустые', ICONS.jar], ['spend', 'траты', ICONS.wallet]];
  let body = '';
  if (tab === 'list') {
    const { low, rebuy, wish, order } = shopLists();
    const total = [...low, ...rebuy, ...wish].reduce((s, p) => s + (Number(p.price) || 0), 0);
    const sec = (title, arr, why) => arr.length ? `<div class="section"><h2 class="h2" style="font-size:24px">${title}</h2><span class="count">${arr.length}</span></div>${arr.map(p => shopRow(p, why)).join('')}` : '';
    body = `
      ${total ? `<div class="sum-sticker"><small>всё из списка ≈</small><b>${money(total)}</b></div>` : ''}
      ${sec('заканчивается', low, 'заканчивается')}
      ${sec('купить снова', rebuy, 'закончилось, понравилось')}
      ${sec('хочу', wish, 'вишлист')}
      ${sec('заказано', order, 'ждём доставку')}
      ${!low.length && !rebuy.length && !wish.length && !order.length ? `<div class="empty"><p class="serif">список пуст — всё есть ✦</p></div>` : ''}
      <div class="row" style="margin-top:22px">
        <button class="btn orange" data-act="new-wish">${ICONS.plus} В вишлист</button>
        ${low.length + rebuy.length + wish.length ? `<button class="btn outline" data-act="copy-shoplist">Скопировать список</button>` : ''}
      </div>`;
  } else if (tab === 'empty') {
    const y = today().slice(0, 4);
    const list = [...state.empties].sort((a, b) => b.date.localeCompare(a.date));
    const yearL = list.filter(e => e.date.startsWith(y));
    const yes = yearL.filter(e => e.verdict === 'yes').length, no = yearL.filter(e => e.verdict === 'no').length;
    body = `
      <div class="cal-stats" style="margin-top:20px">
        <div class="stat" style="--bg:${C.orange}">${ICONS.jar}<b>${yearL.length}</b><small>пустых за ${y}</small></div>
        <div class="stat" style="--bg:${C.pink}"><b>${yes}</b><small>куплю снова</small></div>
        <div class="stat" style="--bg:${C.blue}"><b>${no}</b><small>не куплю</small></div>
      </div>
      <p class="muted" style="margin:18px 0 6px">Баночка попадает сюда, когда у средства ставишь статус «Закончилось».</p>
      ${list.map(e => { const p = product(e.pid);
        return `<div class="empty-row">
          ${p ? `<button class="shop-art" data-act="open" data-id="${p.id}">${artOf(p)}</button>` : `<span class="shop-art">${ICONS.jar}</span>`}
          <div class="shop-txt"><small>${esc(e.brand)} · ${fmtDate(e.date)}</small><b>${esc(e.name)}</b>
            <div class="verdicts">${[['yes', 'куплю снова'], ['no', 'не куплю'], ['maybe', 'не знаю']].map(([v, n]) => `<button class="vchip ${e.verdict === v ? 'on ' + v : ''}" data-act="empty-verdict" data-id="${e.id}" data-v="${v}">${n}</button>`).join('')}</div>
          </div></div>`; }).join('')}
      ${!list.length ? `<div class="empty"><p class="serif">пустых баночек пока нет</p></div>` : ''}`;
  } else {
    const t = today(), ym = t.slice(0, 7);
    const months = []; for (let i = 5; i >= 0; i--) months.push(shiftMonth(ym, -i));
    const sums = months.map(mm => state.spend.filter(x => x.date.startsWith(mm)).reduce((s, x) => s + Number(x.amount || 0), 0));
    const max = Math.max(1, ...sums);
    const cur = state.spend.filter(x => x.date.startsWith(ym)).sort((a, b) => b.date.localeCompare(a.date));
    const byCat = SPEND_CATS.map(([id, n]) => [n, cur.filter(x => x.cat === id).reduce((s, x) => s + Number(x.amount || 0), 0), id]).filter(x => x[1] > 0);
    const filled = sums.filter(x => x > 0);
    const avg = filled.length ? filled.reduce((a, b) => a + b, 0) / filled.length : 0;
    const catColor = { face: C.pink, makeup: C.orange2, perfume: C.blue, body: C.cream2, hair: C.blue2, other: C.pink2 };
    body = `
      <div class="spend-top">
        <div class="sum-sticker big"><small>${MONTHS[Number(ym.slice(5)) - 1]}</small><b>${money(sums[5])}</b></div>
        <div class="muted">в среднем ${money(avg)} в месяц<br>за полгода ${money(sums.reduce((a, b) => a + b, 0))}</div>
      </div>
      <div class="tcard clipboard" style="--bg:#FFFFFF">
        <div class="paper" style="clip-path:${tornClip('chart', 2)}"></div>
        <div class="in"><div class="chart">${months.map((mm, i) => `<div class="col ${mm === ym ? 'cur' : ''}">
          <span class="v">${sums[i] ? (sums[i] >= 1000 ? (sums[i] / 1000).toFixed(sums[i] >= 10000 ? 0 : 1).replace('.', ',') + 'k' : Math.round(sums[i])) : ''}</span>
          <i style="height:${Math.max(sums[i] ? 6 : 2, sums[i] / max * 100)}%"></i>
          <span class="m">${MONTHS[Number(mm.slice(5)) - 1].slice(0, 3)}</span></div>`).join('')}</div></div>
      </div>
      ${byCat.length ? `<div class="section"><h2 class="h2" style="font-size:22px">в этом месяце</h2></div>
        ${byCat.map(([n, v, id]) => `<div class="bar-row money"><span>${n}</span><div class="bar"><i style="width:${v / Math.max(...byCat.map(x => x[1])) * 100}%;--c:${catColor[id]}"></i></div><b style="font-size:13px;white-space:nowrap">${money(v)}</b></div>`).join('')}` : ''}
      <div class="section"><h2 class="h2" style="font-size:22px">записи</h2><button class="btn small orange" style="margin-left:auto" data-act="spend-new">${ICONS.plus} трата</button></div>
      ${cur.map(x => `<div class="spend-row"><div><b>${esc(x.name || 'Покупка')}</b><small>${fmtDate(x.date)} · ${esc(SPEND_CATS.find(c => c[0] === x.cat)?.[1] || '')}</small></div>
        <b class="price">${money(x.amount)}</b><button class="mini-btn" data-act="spend-del" data-id="${x.id}" aria-label="Удалить">${ICONS.trash}</button></div>`).join('')
        || `<p class="muted">В этом месяце трат ещё нет. Нажми «Купила» у средства в списке или добавь трату вручную.</p>`}`;
  }
  return `<section class="screen shopscr ${enterCls()}">
    <h1 class="title-xl">покупки</h1>${scribble(C.wine, 180)}
    <div class="seg wide" style="margin-top:18px">${segs.map(([id, n, ic]) => `<button class="${tab === id ? 'on' : ''}" data-act="shoptab" data-v="${id}">${ic} ${n}</button>`).join('')}</div>
    ${body}
  </section>`;
}

function openBought(id) {
  const p = product(id); if (!p) return;
  boughtDraft = { price: p.price || '', date: today() };
  openSheet(`<div class="mini-p">${artOf(p)}<div><div class="kicker">купила</div><h2 class="pd-name" style="font-size:24px">${esc(p.name)}</h2><p class="muted">${esc(p.brand)}</p></div></div>
    <div class="two" style="margin-top:18px">
      <label class="field"><span>Цена, ₽</span><input class="input" type="number" inputmode="numeric" data-bf="price" value="${esc(boughtDraft.price)}"></label>
      <label class="field"><span>Дата</span><input class="input" type="date" data-bf="date" value="${boughtDraft.date}"></label>
    </div>
    <p class="muted" style="margin-bottom:14px">Цена попадёт в траты за месяц.</p>
    <div class="stack">
      <button class="btn orange" data-act="bought-save" data-id="${id}" data-v="have">Уже у меня — в косметичку</button>
      <button class="btn outline" data-act="bought-save" data-id="${id}" data-v="order">Заказала, жду доставку</button>
    </div>`);
}

function markArrived(id) {
  const p = product(id); if (!p) return;
  p.status = 'use'; p.opened = p.opened || today(); if (!inKit(p)) p.kit = 'bag';
  save();
  if (sheetOpen()) openProduct(id); 
  render(); toast(`${p.name} — пришло, лежит в косметичке ✦`);
}

function saveBought(id, how) {
  const p = product(id); if (!p || !boughtDraft) return;
  const amount = Number(boughtDraft.price) || 0;
  if (amount > 0) state.spend.push({ id: uid(), date: boughtDraft.date || today(), amount, name: `${p.brand} ${p.name}`.trim(), cat: p.cat, pid: p.id });
  p.price = amount || p.price;
  p.rebuy = '';
  if (how === 'have') { p.status = 'use'; p.opened = boughtDraft.date || today(); if (!inKit(p)) p.kit = 'bag'; }
  else p.status = 'order';
  boughtDraft = null; save(); closeSheet(); render();
  toast(amount ? `Записала ${money(amount)} в траты` : 'Отмечено');
}

function openEmpty(id) {
  const p = product(id); if (!p) return;
  const y = today().slice(0, 4);
  let e = state.empties.find(x => x.pid === id && x.date === today());
  if (!e) { e = { id: uid(), pid: id, name: p.name, brand: p.brand, date: today(), verdict: '' }; state.empties.push(e); }
  p.kit = 'shelf'; p.pos = null; save(); render();
  const n = state.empties.filter(x => x.date.startsWith(y)).length;
  openSheet(`<div class="pd-hero small" style="height:230px">
      ${blob('em-b' + id, C.pink, 'left:6%;top:8%;width:70%;height:80%;transform:rotate(-5deg)')}
      <div class="pd-art" style="height:180px;opacity:.85">${artOf(p)}</div>
      ${burst(`№${n}`, C.orange2)}
    </div>
    <h2 class="pd-name">баночка закончилась!</h2>
    <p class="pd-brand">${esc(p.brand)} · ${esc(p.name)} — ${n}-я пустая в ${y}</p>
    <p class="muted" style="margin:14px 0">Купишь снова? «Куплю снова» добавит средство в список покупок.</p>
    <div class="stack">
      <button class="btn orange" data-act="empty-verdict" data-id="${e.id}" data-v="yes">${ICONS.heart} Куплю снова</button>
      <button class="btn outline" data-act="empty-verdict" data-id="${e.id}" data-v="no">Не куплю</button>
      <button class="btn danger" data-act="empty-verdict" data-id="${e.id}" data-v="maybe">Пока не знаю</button>
    </div>`);
}

function setVerdict(eid, v) {
  const e = state.empties.find(x => x.id === eid); if (!e) return;
  e.verdict = e.verdict === v && !sheetOpen() ? '' : v;
  const p = product(e.pid);
  if (p && p.status === 'empty') p.rebuy = e.verdict;
  save();
  if (sheetOpen()) { closeSheet(); toast(v === 'yes' ? 'Добавила в список покупок ✦' : v === 'no' ? 'Запомнила: не покупать' : 'Решишь потом'); }
  render();
}

function openSpend(keep) {
  if (!keep) spendDraft = { name: '', amount: '', date: today(), cat: 'face' };
  const d = spendDraft;
  openSheet(`<div class="kicker">траты</div><h2 class="pd-name" style="margin:4px 0 16px">новая трата</h2>
    <label class="field"><span>Что купила</span><input class="input" data-xf="name" value="${esc(d.name)}" placeholder="Например: ватные диски"></label>
    <div class="two">
      <label class="field"><span>Сумма, ₽</span><input class="input" type="number" inputmode="numeric" data-xf="amount" value="${esc(d.amount)}"></label>
      <label class="field"><span>Дата</span><input class="input" type="date" data-xf="date" value="${esc(d.date)}"></label>
    </div>
    <div class="field"><span>Раздел</span><div class="opt-grid">${SPEND_CATS.map(([id, n]) => `<button class="opt ${d.cat === id ? 'on' : ''}" data-act="spend-cat" data-v="${id}">${n}</button>`).join('')}</div></div>
    <button class="btn orange" style="width:100%" data-act="spend-save">Сохранить</button>`);
}
function saveSpend() {
  const d = spendDraft; const amount = Number(d.amount);
  if (!amount) { toast('Укажи сумму'); return; }
  state.spend.push({ id: uid(), date: d.date || today(), amount, name: d.name.trim(), cat: d.cat, pid: '' });
  spendDraft = null; save(); closeSheet(); render(); toast(`Записала ${money(amount)}`);
}

async function copyShopList() {
  const { low, rebuy, wish } = shopLists();
  const line = p => `— ${p.brand} ${p.name}${p.price ? ` · ${money(p.price)}` : ''}${p.url ? `\n  ${safeUrl(p.url)}` : ''}`;
  const text = [low.length && 'Заканчивается:\n' + low.map(line).join('\n'), rebuy.length && 'Купить снова:\n' + rebuy.map(line).join('\n'), wish.length && 'Хочу:\n' + wish.map(line).join('\n')].filter(Boolean).join('\n\n');
  try { await navigator.clipboard.writeText(text); toast('Список скопирован'); } catch { toast('Не удалось скопировать'); }
}

// ═════════ ВЫПАДАЮЩЕЕ МЕНЮ ═════════
const MENU = [
  ['home', 'главная', 'сегодня и любимое'], ['kit', 'косметичка', 'достать и разложить'], ['catalog', 'каталог', 'вся коллекция'],
  ['routine', 'уход', 'утро, вечер, календарь'], ['fav', 'любимое', 'без чего никак'], ['shop', 'покупки', 'вишлист и траты'], ['profile', 'профиль', 'анализ, копия, версия'],
];
const menuOpen = () => !$('#menu').hidden;
function openMenu() {
  const { low, rebuy, wish } = shopLists();
  const badge = { shop: low.length + rebuy.length + wish.length, fav: state.products.filter(p => p.fav && live(p)).length, kit: inBag().length + onTable().length };
  $('#menuList').innerHTML = MENU.map(([id, n, sub], i) => `<button class="menu-item ${ui.tab === id ? 'on' : ''}" data-act="tab" data-v="${id}" style="--i:${i}">
      <span class="mi-n">${String(i + 1).padStart(2, '0')}</span><span class="mi-t">${n}</span><span class="mi-s">${sub}${badge[id] ? ` · ${badge[id]}` : ''}</span></button>`).join('');
  $('#menuFoot').innerHTML = `${chromeStar(28)}<span>v${APP_VERSION}</span>${chromeStar(22)}`;
  const m = $('#menu'); m.hidden = false;
  requestAnimationFrame(() => m.classList.add('show'));
  $('#menuBtn').setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
}
function closeMenu() {
  const m = $('#menu'); m.classList.remove('show');
  $('#menuBtn').setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
  setTimeout(() => { if (!m.classList.contains('show')) m.hidden = true; }, 380);
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && menuOpen()) closeMenu(); });

// ═════════ РЕНДЕР ═════════
const SCREENS = { home: screenHome, kit: screenKit, catalog: screenCatalog, routine: screenRoutine, fav: screenFav, profile: screenProfile, shop: screenShop };

function applyFx() {
  document.body.classList.remove('fx-fur', 'fx-puff', 'fx-flat', 'fx-label', 'fx-script');
  document.body.classList.add('fx-' + (state.fx || 'script'));
}

function render() {
  $('#main').innerHTML = SCREENS[ui.tab]();
  $$('#main :is(.logo, .title-xl, .mega, .h2)').forEach(e => {
    e.dataset.text = e.innerText;
    e.innerHTML = e.innerHTML.split(/<br\s*\/?>/i).map(s => `<span class="lb">${s}</span>`).join('<br>');
  });
  ui.enter = false;
  $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.v === ui.tab));
  $('#fab').hidden = !['kit', 'catalog', 'fav'].includes(ui.tab);
  $('.mini-logo').classList.toggle('hide', ui.tab === 'home');
}

function go(tab) {
  if (ui.tab === tab) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  ui.tab = tab; ui.edit = false; ui.enter = true;
  if (tab === 'routine') ui.slot = null;
  window.scrollTo({ top: 0 });
  render();
}

// ═════════ СОБЫТИЯ ═════════
document.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove, { passive: false });
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);
document.addEventListener('touchmove', e => { if (drag?.moved) e.preventDefault(); }, { passive: false });

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  if (pdragEnded && el.closest('.plan')) { pdragEnded = false; return; }
  const act = el.dataset.act, v = el.dataset.v, id = el.dataset.id;
  switch (act) {
    case 'tab': if (sheetOpen()) closeSheet(); if (menuOpen()) closeMenu(); go(v); break;
    case 'menu': menuOpen() ? closeMenu() : openMenu(); break;
    case 'menu-close': closeMenu(); break;
    case 'bag-shake': shakeBag(); break;
    case 'bag-more': ui.cat = 'all'; ui.filter = 'kit'; go('catalog'); break;
    case 'kitcat': ui.kitCat = v; ui.enter = true; render(); break;
    case 'cat': ui.cat = v; render(); break;
    case 'filter': ui.filter = v; render(); break;
    case 'search': ui.search = !ui.search; if (!ui.search) ui.q = ''; render(); setTimeout(() => $('#q')?.focus(), 50); break;
    case 'open': openProduct(id); break;
    case 'new': editProduct(null); break;
    case 'edit': editProduct(id); break;
    case 'close': closeSheet(); break;
    case 'fav': {
      const p = product(id); p.fav = !p.fav; save();
      const r = el.getBoundingClientRect(); hearts(r.left + r.width / 2, r.top + r.height / 2, p.fav);
      if (sheetOpen() && $('.pd-hero')) { const keep = $('#sheet').scrollTop; openProduct(id); $('#sheet').scrollTop = keep; }
      setTimeout(render, ui.tab === 'fav' && !p.fav ? 350 : 0);
      break;
    }
    case 'kit': {
      const p = product(id);
      p.kit = inKit(p) ? 'shelf' : 'bag'; p.pos = null; save();
      toast(p.kit === 'bag' ? `${p.name} — в косметичке` : `${p.name} — на полке`);
      if (sheetOpen()) { const keep = $('#sheet').scrollTop; openProduct(id); $('#sheet').scrollTop = keep; }
      render(); break;
    }
    case 'pick-slot': openSlotPicker(id); break;
    case 'slot-toggle': {
      const arr = state.routines[v];
      const p = product(id);
      if (arr.some(s => s.product === id)) { state.routines[v] = arr.filter(s => s.product !== id); toast(`Убрано из «${ROUTINE_SLOTS.find(s => s.id === v).name}»`); }
      else { arr.push({ id: uid(), product: id, text: TYPE_MAP[p.type]?.name || p.name, note: '' }); toast(`Добавлено в «${ROUTINE_SLOTS.find(s => s.id === v).name}» ✦`); }
      save(); openSlotPicker(id); if (ui.tab === 'routine' || ui.tab === 'home') render();
      break;
    }
    case 'del': {
      const p = product(id);
      if (!confirm(`Удалить «${p.name}» совсем? Шаги схемы с ним останутся без средства.`)) return;
      state.products = state.products.filter(x => x.id !== id);
      for (const k of Object.keys(state.routines)) state.routines[k].forEach(s => { if (s.product === id) s.product = ''; });
      save(); closeSheet(); render(); toast('Удалено');
      break;
    }
    case 'qstatus': {
      const p = product(id); const was = p.status; p.status = v; if (v !== 'pause') p.pauseUntil = '';
      if (v === 'empty' && was !== 'empty') { save(); render(); openEmpty(id); break; }
      if (v === 'use' && !p.opened) p.opened = today();
      if (v === 'use' && p.kit === 'shelf') p.kit = 'bag';
      save(); render();
      if (sheetOpen()) { const keep = $('#sheet').scrollTop; openProduct(id); $('#sheet').scrollTop = keep; } else toast(`${p.name}: ${STATUS_MAP[v].name.toLowerCase()}`);
      break;
    }
    case 'fcat': draft.cat = v; draft.type = TYPES[v][0][0]; if (CATEGORIES.some(c => c.color === draft.color)) draft.color = CAT_MAP[v].color; renderForm(!!product(draft.id)); break;
    case 'fset': {
      const f = el.dataset.f;
      draft[f] = f === 'rating' ? Number(v) : f === 'fav' ? !!v : v;
      if (f === 'kit' && v === 'table' && !draft.pos) draft.pos = { x: 50, y: 50, r: -6 };
      renderForm(!!product(draft.id)); break;
    }
    case 'fact': draft.actives = draft.actives.includes(v) ? draft.actives.filter(a => a !== v) : [...draft.actives, v]; renderForm(!!product(draft.id)); break;
    case 'tidy': tidyTable(); break;
    case 'allacts': ui.allActs = !ui.allActs; renderForm(!!product(draft.id)); break;
    case 'pl-wd': toggleWorkDay(v); break;
    case 'pl-eve': { const e2 = eveFor(v); setEveMode(v, e2.mode === 'A' ? 'B' : 'A'); render(); toast(`${fmtDate(v)}: ${eveFor(v).mode === 'A' ? (state.profile.activeName || 'актив') : 'отдых'} · план обновлён`); break; }
    case 'pl-dev': openDevMove(v); break;
    case 'pl-move': closeSheet(); moveDevice(el.dataset.d, v); break;
    case 'pl-skip': setDeviceDay(v, []); save(); closeSheet(); render(); toast(`${fmtDate(v)} — без аппарата`); break;
    case 'pl-undo': delete dev().moves?.[v]; save(); closeSheet(); render(); toast('Вернула как по плану'); break;
    case 'pl-reset': dev().moves = {}; save(); render(); toast('Аппарат — снова по плану'); break;
    case 'dev-guide': openDeviceGuide(); break;
    case 'dev-open': ui.tab = 'routine'; ui.rview = 'today'; ui.slot = 'device'; closeSheet(); render(); scrollTo(0, 0); requestAnimationFrame(() => $('.slot.on')?.scrollIntoView({ inline: 'center', block: 'nearest' })); break;
    case 'dev-arrived': dev().arrived = today(); state.products.filter(p => p.type === 'device' && !p.opened).forEach(p => p.opened = today()); save(); if (sheetOpen()) openDeviceGuide(); render(); { const pl = devicePlan(); toast(pl.st === 'on' ? `Ура! Сегодня: ${modesTxt(pl.modes)}` : 'Ура! План режимов включён ✦'); } break;
    case 'dev-reset': dev().arrived = ''; save(); openDeviceGuide(); render(); break;
    case 'arrived': markArrived(id); break;
    case 'uv-refresh': fetchUV(true); toast('Обновляю прогноз…'); break;
    case 'uv-geo': uvGeo(); break;
    case 'nophoto': draft.photo = ''; renderForm(!!product(draft.id)); break;
    case 'fsave': {
      if (!draft.name.trim() && !draft.brand.trim()) { toast('Напиши название или бренд'); return; }
      draft.pao = Number(draft.pao) || ''; draft.price = draft.price === '' ? '' : Number(draft.price);
      if (draft.kit !== 'table') draft.pos = null;
      delete draft._inci;
      const before = product(draft.id)?.status;
      const i = state.products.findIndex(p => p.id === draft.id), isNew = i < 0;
      if (isNew) state.products.push(draft); else state.products[i] = draft;
      const pid = draft.id, where = draft.kit;
      save(); closeSheet();
      if (isNew && ui.tab === 'kit') ui.enter = true;
      render();
      toast(isNew ? (where === 'shelf' ? 'Добавлено в каталог ✦' : 'Положила в косметичку ✦') : 'Сохранено');
      if (draft === null && state.products.find(x => x.id === pid)?.status === 'empty' && before !== 'empty') openEmpty(pid);
      if (isNew) $(`[data-id="${pid}"], [data-drag="${pid}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      break;
    }
    case 'slot': ui.slot = v === 'eve' ? eveFor(today()).slot : v; render(); break;
    case 'evemode': {
      const d = el.dataset.d || today();
      setEveMode(d, v); ui.slot = eveFor(today()).slot; render();
      toast(v === 'A' ? `Вечер с ${state.profile.activeName || 'активом'}ом` : 'Вечер отдыха');
      break;
    }
    case 'dmode': { const d = el.dataset.d; setEveMode(d, v); const keep = $('#sheet').scrollTop; openDay(d); $('#sheet').scrollTop = keep; render(); break; }
    case 'rview': ui.rview = v; ui.enter = true; render(); break;
    case 'cal-nav': ui.calMonth = shiftMonth(ui.calMonth || today().slice(0, 7), Number(v)); render(); break;
    case 'day': openDay(v); break;
    case 'dtick': dayTick(el.dataset.d, el.dataset.slot, id); break;
    case 'season': switchSeason(v); break;
    case 'season-copy': copySeason(); break;
    case 'reminders': openReminders(); break;
    case 'rem-toggle': { const off = state.reminders.off; const i = off.indexOf(id); if (i >= 0) off.splice(i, 1); else off.push(id); save(); openReminders(true); break; }
    case 'ics-open': exportICS(false); break;
    case 'ics-share': exportICS(true); break;
    case 'inci': { const res = parseInci(draft.inci); draft._inci = res; res.found.forEach(f => { if (!draft.actives.includes(f.active)) draft.actives.push(f.active); }); renderForm(!!product(draft.id)); break; }
    case 'shoptab': ui.shopTab = v; ui.enter = true; render(); break;
    case 'new-wish': editProduct(null, { status: 'wish', kit: 'shelf' }); break;
    case 'bought': openBought(id); break;
    case 'bought-save': saveBought(id, v); break;
    case 'empty-verdict': setVerdict(id, v); break;
    case 'spend-new': openSpend(); break;
    case 'spend-save': saveSpend(); break;
    case 'spend-del': state.spend = state.spend.filter(x => x.id !== id); save(); render(); toast('Трата удалена'); break;
    case 'spend-cat': spendDraft.cat = v; openSpend(true); break;
    case 'copy-shoplist': copyShopList(); break;
    case 'tick': tick(id); break;
    case 'edit-toggle': ui.edit = !ui.edit; render(); break;
    case 'step-up': moveStep(id, -1); break;
    case 'step-down': moveStep(id, 1); break;
    case 'step-edit': stepSheet(id); break;
    case 'step-new': stepSheet(null); break;
    case 'sp': stepDraft.product = v; if (v && !stepDraft.text) { const p = product(v); stepDraft.text = TYPE_MAP[p.type]?.name || ''; } renderStepSheet(state.routines[ui.slot].some(s => s.id === stepDraft.id)); break;
    case 'step-save': {
      if (!stepDraft.text.trim() && !stepDraft.product) { toast('Напиши шаг или выбери средство'); return; }
      const arr = state.routines[ui.slot], i = arr.findIndex(s => s.id === stepDraft.id);
      if (i < 0) arr.push(stepDraft); else arr[i] = stepDraft;
      save(); closeSheet(); render(); break;
    }
    case 'step-del':
      state.routines[ui.slot] = state.routines[ui.slot].filter(s => s.id !== stepDraft.id);
      save(); closeSheet(); render(); break;
    case 'pset': state.profile.skin = v; save(); render(); break;
    case 'fx': state.fx = v; save(); applyFx(); render(); break;
    case 'backup': doBackup(); break;
    case 'copy-shop': {
      const a = analyze(state, today());
      const text = 'Купить:\n' + a.shopping.map(s => `— ${s.p.brand} ${s.p.name} (${s.why})`).join('\n');
      try { await navigator.clipboard.writeText(text); toast('Список скопирован'); } catch { toast('Не удалось скопировать'); }
      break;
    }
    case 'update': checkUpdate(true); break;
    case 'apply-update': applyUpdate(); break;
    case 'reset':
      if (!confirm('Удалить все данные и начать со стартовой косметички? Сначала лучше сохранить копию.')) return;
      state = seedState(); save(); ui.enter = true; render(); toast('Начинаем заново'); break;
  }
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'q') { ui.q = t.value; const g = $('#cgrid'); if (g) g.innerHTML = catalogList().map((p, i) => catCard(p, i)).join(''); return; }
  if (t.dataset.f && draft) { draft[t.dataset.f] = t.value; return; }
  if (t.dataset.sf && stepDraft) { stepDraft[t.dataset.sf] = t.value; return; }
  if (t.dataset.pf) { state.profile[t.dataset.pf] = t.dataset.pf === 'rampDays' ? Number(t.value) || 0 : t.value; save(); }
  if (t.dataset.rf) { state.reminders[t.dataset.rf] = t.value; save(); }
  if (t.dataset.bf) { boughtDraft[t.dataset.bf] = t.value; }
  if (t.dataset.xf && spendDraft) { spendDraft[t.dataset.xf] = t.value; }
});

document.addEventListener('change', async e => {
  const t = e.target;
  if (t.id === 'photo' && t.files[0] && draft) {
    try { draft.photo = await loadPhoto(t.files[0]); renderForm(!!product(draft.id)); } catch { toast('Не удалось загрузить фото'); }
  }
  if (t.id === 'restore' && t.files[0]) doRestore(t.files[0]);
});

$('#scrim').addEventListener('click', closeSheet);

// ═════════ ОБНОВЛЕНИЯ ═════════
let reg = null;
function showUpdateBanner() {
  if ($('#updBanner')) return;
  const b = document.createElement('div');
  b.id = 'updBanner'; b.className = 'banner pop';
  b.style.cssText = `--b:${C.pink};position:fixed;left:50%;transform:translateX(-50%);top:calc(var(--safe-t) + 12px);width:min(520px,calc(100% - 24px));z-index:270`;
  b.innerHTML = `<div class="ico">${ICONS.spark}</div><div><b>Есть новая версия</b><span>Данные сохранятся</span></div><button class="btn small" data-act="apply-update">Обновить</button>`;
  document.body.appendChild(b);
}
let pendingRemote = null;
function applyUpdate() { if (reg?.waiting) reg.waiting.postMessage('skipWaiting'); else if (pendingRemote) forceRefresh(pendingRemote); else location.reload(); }
const verNum = v => String(v).split('.').map(n => parseInt(n, 10) || 0);
function isNewer(a, b) { const x = verNum(a), y = verNum(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; }
async function siteVersion() {
  try { const r = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' }); if (!r.ok) return null; return (await r.json()).version || null; } catch { return null; }
}
// Запасной путь: на сайте версия новее, а sw.js не поменялся — чистим кеш и перезагружаем
async function forceRefresh(v) {
  toast(`Нашла версию ${v} — обновляю…`);
  try { const keys = await caches.keys(); await Promise.all(keys.filter(k => k !== 'fonts').map(k => caches.delete(k))); } catch {}
  try { await reg?.update(); } catch {}
  setTimeout(() => location.reload(), 700);
}
async function checkUpdate(manual) {
  if (!reg) { if (manual) toast('Обновления работают в установленном приложении'); return; }
  try {
    await reg.update();
    if (reg.waiting) { showUpdateBanner(); return; }
    const remote = await siteVersion();
    if (remote && isNewer(remote, APP_VERSION) && !reg.installing) {
      if (manual) return forceRefresh(remote);
      pendingRemote = remote; showUpdateBanner(); return;
    }
    if (manual) setTimeout(() => { if (reg.installing) toast('Загружаю обновление…'); else if (!reg.waiting) toast(remote === null && !navigator.onLine ? 'Нет интернета — попробуй позже' : `У тебя последняя версия ${APP_VERSION}`); }, 900);
  } catch { if (manual) toast('Нет интернета — попробуй позже'); }
}
function setupSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('./sw.js').then(r => {
    reg = r;
    if (r.waiting && navigator.serviceWorker.controller) showUpdateBanner();
    r.addEventListener('updatefound', () => {
      const w = r.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(); });
    });
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { checkUpdate(false); fetchUV(); } });
}

// ═════════ СТАРТ ═════════
(async function init() {
  const loaded = await loadState();
  state = loaded && Array.isArray(loaded.products) ? migrate(loaded) : seedState();
  save();
  requestPersist();
  applyFx();
  $('#ver').textContent = `glowbag v${APP_VERSION}`;
  const start = new URLSearchParams(location.search).get('tab');
  if (start && SCREENS[start]) ui.tab = start;
  render();
  setupSW();
  fetchUV();
})();
