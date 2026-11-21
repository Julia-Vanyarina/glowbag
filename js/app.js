import {
  APP_VERSION, APP_BUILD, CHANGELOG, CATEGORIES, TYPES, STATUSES, ACTIVES, SKIN_TYPES, ROUTINE_SLOTS,
  ACTIVE_MAP, TYPE_MAP, CAT_MAP, STATUS_MAP, C, seedState, uid,
} from './data.js';
import { loadState, saveState, requestPersist } from './db.js';
import { analyze, productInsights, eveningFor, iso, fmtDate, daysBetween, expiryOf } from './analysis.js';
import {
  productArt, bagBack, bagFront, starSVG, sparkle, outlineStar, smiley, tornClip, tornBlob, scribble,
  arrowDoodle, dashes, burst, ICONS, SWATCHES, nearestSwatch,
} from './art.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => iso(new Date());
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

let state;
const ui = { tab: 'home', cat: 'all', filter: 'all', q: '', kitCat: 'all', slot: null, edit: false, search: false, enter: true };
let draft = null, stepDraft = null;

const STATUS_ORDER = ['use', 'low', 'order', 'pause', 'wish', 'empty'];
// места в косметичке: центр по x (%), низ (%), наклон
const SLOTS = [[20, 47, -14], [36, 51, -5], [52, 49, 5], [67, 52, -3], [82, 46, 12], [28, 40, 8], [60, 41, -9], [44, 42, 10], [75, 40, -12]];
const CARD_BGS = [C.pink, C.blue, C.orange2, C.cream2, C.pink2, C.blue2];

// ——— хранение ———
let saveTimer;
const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => saveState(state), 120); };

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2400);
}

const product = id => state.products.find(p => p.id === id);
const live = p => p.status !== 'empty';
const artOf = p => p.photo ? `<img class="photo" src="${p.photo}" alt="">` : productArt(TYPE_MAP[p.type]?.shape || 'bottle', p.color || CAT_MAP[p.cat]?.color, p.brand || p.name);
const blob = (seed, color, style) => `<div class="blob" style="${style}">${tornBlob(seed, color)}</div>`;
const inBag = () => state.products.filter(p => p.kit === 'bag' && live(p));
const onTable = () => state.products.filter(p => p.kit === 'table' && live(p) && p.pos);
const inKit = p => p.kit === 'bag' || p.kit === 'table';
const enterCls = () => ui.enter ? 'enter' : '';

function currentSlot() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'day';
  return eveningFor(state.profile, today()).slot;
}
function slotProgress(slot) {
  const steps = state.routines[slot] || [];
  const done = state.log[today()]?.[slot] || [];
  return { steps, done, n: steps.filter(s => done.includes(s.id)).length };
}

function ring(done, total, size = 74) {
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
  const eve = eveningFor(state.profile, today());
  const favs = state.products.filter(p => p.fav && live(p));
  const peekSrc = [...favs.filter(inKit), ...inBag().filter(p => !p.fav), ...favs.filter(p => !inKit(p))];
  const peek = peekSrc.slice(0, 4);
  const a = analyze(state, today());
  const top = a.warn[0] || a.back[0] && { title: `Можно вернуть: ${a.back[0].name}` } || a.info[0] || a.good[0];
  const lb = state.lastBackup;
  const needBackup = (lb ? daysBetween(lb.slice(0, 10), today()) : 99) >= 7;

  return `<section class="screen home ${enterCls()}">
    ${sparkle(C.orange, 38, 'abs', 'right:30%;top:-4px')}
    <div class="home-head">
      <h1 class="logo">glow<br>bag</h1>
      <p class="slogan">уход<br>для настоящей жизни</p>
      ${scribble(C.wine, 130)}
      <p class="hi">Привет, ${esc(state.profile.name || 'красотка')} ✦</p>
    </div>

    <div class="hero" data-act="tab" data-v="kit" role="button" aria-label="Открыть косметичку">
      ${blob('hero-wine', C.wine, 'left:-6%;top:6%;width:64%;height:70%;transform:rotate(-5deg)')}
      ${blob('hero-blue', C.blue, 'right:-8%;top:0;width:58%;height:62%;transform:rotate(7deg)')}
      ${blob('hero-orange', C.orange, 'left:-4%;bottom:2%;width:42%;height:36%;transform:rotate(-10deg)')}
      ${blob('hero-pink', C.pink, 'right:-2%;bottom:6%;width:46%;height:34%;transform:rotate(6deg)')}
      <span class="bubble hero-bubble">достань<br>любимое</span>
      ${arrowDoodle(C.wine, 'position:absolute;right:120px;top:52px;z-index:6;transform:rotate(30deg)')}
      ${dashes(C.pink2, 'position:absolute;left:30%;top:28px;z-index:6')}
      ${bagHTML(peek, { mini: true, key: 'home' })}
      <span class="pill-btn">открыть косметичку ${ICONS.arrow}</span>
    </div>

    <div class="tcard today" style="--bg:${C.pink}">
      <div class="paper" style="clip-path:${tornClip('today', 2.6)}"></div>
      <div class="in">
        <div class="kicker">${esc(meta.name)} · сегодня</div>
        <div class="today-row">${ring(n, steps.length)}
          <div><b>${next ? esc(next.text || product(next.product)?.name || 'Следующий шаг') : steps.length ? 'всё сделано ✦' : 'шагов пока нет'}</b>
          <span class="muted">${slot.startsWith('eve') ? esc(eve.why) : next ? `шаг ${steps.indexOf(next) + 1} из ${steps.length}` : 'кожа говорит спасибо'}</span></div>
        </div>
        <button class="btn" data-act="tab" data-v="routine">к схеме ухода ${ICONS.arrow}</button>
      </div>
    </div>

    ${needBackup ? `<div class="banner" style="--b:${C.blue};margin-top:24px">
      <div class="ico">${ICONS.spark}</div>
      <div><b>Пора сделать копию</b><span>${lb ? `последняя — ${fmtDate(lb.slice(0, 10))}` : 'копий ещё не было'}</span></div>
      <button class="btn small" data-act="backup">Сохранить</button></div>` : ''}

    <div class="section"><h2 class="h2">любимое</h2>${starSVG(C.pink2, 12)}<button class="btn small outline" style="margin-left:auto" data-act="tab" data-v="fav">все</button></div>
    ${favs.length ? `<div class="strip">${favs.map((p, i) => `<button class="strip-item" data-act="open" data-id="${p.id}">
        <div class="tile" style="--bg:${CARD_BGS[i % CARD_BGS.length]}">${artOf(p)}</div><span>${esc(p.name)}</span></button>`).join('')}</div>`
      : `<p class="muted">Нажми ♡ на средстве — и оно появится здесь.</p>`}

    <button class="ana-sticker" data-act="tab" data-v="profile">
      <div class="score-badge"><b>${a.score}</b><small>баланс</small></div>
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
    ${blob('kit-wine', C.wine, 'right:-40px;top:150px;width:30%;height:90px;transform:rotate(8deg)')}
    ${blob('kit-orange', C.orange, 'left:-40px;bottom:120px;width:34%;height:150px;transform:rotate(-12deg)')}
    ${blob('kit-pink', C.pink, 'right:-30px;bottom:60px;width:40%;height:170px;transform:rotate(10deg)')}
    <div class="kit-head">
      <h1 class="mega">моя<br>косметичка</h1>
      <span class="bubble">pick<br>&amp; drag!</span>
    </div>
    <div class="zones">
      <div class="zone-w" data-drop="routine"><div class="zone" style="--zc:${C.pink};clip-path:${tornClip('z1', 4)}">${ICONS.sun}<span>в уход</span></div></div>
      <div class="zone-w" data-drop="fav"><div class="zone" style="--zc:${C.blue};clip-path:${tornClip('z2', 4)}">${ICONS.heart}<span>любимое</span></div></div>
      <div class="zone-w" data-drop="shelf"><div class="zone" style="--zc:${C.orange2};clip-path:${tornClip('z3', 4)}">${ICONS.shelf}<span>на полку</span></div></div>
    </div>
    <div class="table" id="table" data-drop="table">
      <div class="table-pw"><div class="table-paper" style="clip-path:${tornClip('table', 3)}"></div></div>
      <span class="table-label">на столе</span>
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
    p.pos = { x: Math.round(Math.max(10, Math.min(90, cx))), y: Math.round(Math.max(28, Math.min(72, cy))), r: Math.round((Math.random() - .5) * 26) };
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
  const tab = $('.tab[data-v="catalog"]').getBoundingClientRect(), r = g.getBoundingClientRect();
  const dx = tab.left + tab.width / 2 - (r.left + r.width / 2), dy = tab.top - (r.top + r.height / 2);
  g.getAnimations().forEach(a => a.cancel());
  await anim(g, [{ transform: 'scale(1.18)' }, { transform: `translate(${dx * .5}px,${dy * .5 - 60}px) scale(.8) rotate(20deg)`, offset: .5 }, { transform: `translate(${dx}px,${dy}px) scale(.1) rotate(60deg)`, opacity: .2 }], { duration: 620, easing: 'cubic-bezier(.5,0,.6,1)', fill: 'forwards' });
  g.remove();
  $('.tab[data-v="catalog"]')?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3) rotate(-8deg)' }, { transform: 'scale(1)' }], { duration: 400 });
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
    <div class="paper" style="clip-path:${tornClip(p.id, 3.4)}"></div>
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
    ${blob('cat-wine', C.wine, 'right:-60px;top:-50px;width:46%;height:140px;transform:rotate(-8deg)')}
    ${outlineStar(C.orange, 50, 'abs', 'left:-6px;top:300px;transform:rotate(-12deg)')}
    ${smiley(C.orange, 44, 'position:absolute;right:-6px;top:420px;z-index:3;transform:rotate(14deg)')}
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
  const eve = eveningFor(state.profile, today());
  const slot = ui.slot || currentSlot(); ui.slot = slot;
  const { steps, done, n } = slotProgress(slot);
  const isEve = slot === 'eveA' || slot === 'eveB';
  return `<section class="screen routine ${enterCls()}">
    ${blob('rt-wine', C.wine, 'left:-80px;top:70px;width:40%;height:130px;transform:rotate(-8deg)')}
    ${blob('rt-blue', C.blue, 'right:-50px;top:40px;width:36%;height:120px;transform:rotate(12deg)')}
    <div class="rt-head">
      <h1 class="bubble">твой<br>уход</h1>
      ${ring(n, steps.length, 96)}
    </div>
    <div class="slots">
      ${ROUTINE_SLOTS.map(s => `<button class="slot ${s.id === slot ? 'on' : ''}" data-act="slot" data-v="${s.id}">${ICONS[s.icon]}${s.name}${s.id === eve.slot ? '<span class="today">сегодня</span>' : ''}</button>`).join('')}
    </div>
    ${isEve ? `<div class="banner" style="--b:${eve.slot === 'eveA' ? C.pink2 : C.pink}">
      <div class="ico">${ICONS.moon}</div>
      <div><b>Сегодня вечер ${eve.slot === 'eveA' ? `с ${esc(state.profile.activeName || 'активом')}` : 'без активов'}</b><span>${esc(eve.why)}</span></div></div>` : ''}
    <ol class="rsteps">${steps.map((s, i) => stepHTML(s, i, done.includes(s.id), steps.length)).join('')}</ol>
    ${!steps.length ? `<div class="empty"><p class="serif">в этой рутине пока нет шагов</p></div>` : ''}
    <div class="row" style="justify-content:center;margin-top:22px">
      ${ui.edit ? `<button class="btn orange" data-act="step-new">${ICONS.plus} Шаг</button><button class="btn outline" data-act="edit-toggle">Готово</button>`
        : `<button class="btn outline" data-act="edit-toggle">Редактировать схему</button>`}
    </div>
    <div class="glow">${dashes(C.orange, 'position:absolute;left:22%;top:-14px')}<span class="bubble ${n && n === steps.length ? 'pop' : ''}">${n && n === steps.length ? 'всё сделано!' : 'glow up!'}</span></div>
  </section>`;
}

function stepHTML(s, i, isDone, total) {
  const p = s.product ? product(s.product) : null;
  const flag = p && ['pause', 'empty', 'order'].includes(p.status) ? `<span class="flag">${STATUS_MAP[p.status].name.toLowerCase()}</span>` : '';
  return `<li class="rstep ${isDone && !ui.edit ? 'done' : ''}">
    <span class="rnum">${i + 1}</span>
    <button class="rthumb" ${p ? `data-act="open" data-id="${p.id}"` : ''}>${p ? artOf(p) : `<span class="noart">${ICONS.drop}</span>`}</button>
    <div class="rtext">
      <b>${esc(s.text || (p ? p.name : 'Шаг'))}</b>
      ${p ? `<small>${esc(p.brand)} · ${esc(p.name)}</small>` : ''}
      ${s.note ? `<div class="note">${esc(s.note)}</div>` : ''}${flag}
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
  while (keys.length > 120) delete state.log[keys.shift()];
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
    ${blob('fav-wine', C.wine, 'right:-60px;top:-40px;width:52%;height:150px;transform:rotate(6deg)')}
    ${blob('fav-blue', C.blue, 'left:-60px;top:240px;width:30%;height:200px;transform:rotate(-6deg)')}
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
    ${blob('pr-pink', C.pink, 'right:-50px;top:-30px;width:46%;height:150px;transform:rotate(8deg)')}
    <h1 class="title-xl">профиль</h1>${scribble(C.wine, 180)}

    <div class="tcard" style="--bg:${C.blue};margin-top:22px">
      <div class="paper" style="clip-path:${tornClip('prof', 2.4)}"></div>
      <div class="in">
        <label class="field"><span>Имя</span><input class="input" data-pf="name" value="${esc(pr.name)}"></label>
        <div class="field"><span>Тип кожи</span><div class="opt-grid">${SKIN_TYPES.map(s => `<button class="opt ${pr.skin === s ? 'on' : ''}" data-act="pset" data-v="${s}">${s}</button>`).join('')}</div></div>
        <label class="field" style="margin:0"><span>О коже</span><textarea class="input" data-pf="notes">${esc(pr.notes)}</textarea></label>
      </div>
    </div>

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

    <div class="section"><h2 class="h2">резервная копия</h2>${sparkle(C.orange, 26)}</div>
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
  const colors = [C.pink, C.blue, C.orange2, C.cream2, C.pink2, C.blue2];
  const verdict = a.score >= 85 ? 'схема в балансе' : a.score >= 65 ? 'есть что подправить' : 'кожу легко перегрузить';
  const alert = (w, c) => `<div class="alert" style="--c:${c}"><span class="s">${esc(w.slot)}</span><b>${esc(w.title)}</b><p>${esc(w.text)}</p></div>`;
  return `
    <div class="section"><h2 class="h2">анализ</h2>${starSVG(C.orange, 12)}</div>
    <div class="score"><div class="score-badge"><b>${a.score}</b><small>баланс</small></div>
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

    <div class="section"><h2 class="h2" style="font-size:24px">список покупок</h2></div>
    <div class="tcard" style="--bg:${C.cream2}">
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
      ${blob('pd-o' + id, C.orange, 'right:-8%;bottom:6%;width:40%;height:46%;transform:rotate(10deg)')}
      ${blob('pd-w' + id, C.wine, 'right:-6%;top:-6%;width:30%;height:30%;transform:rotate(-12deg)')}
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
    ${ins.actives.length ? `<div class="kicker">что внутри и зачем</div><div class="info-list">${ins.actives.map(a => `<div class="info"><b>${esc(a.name)}</b>${a.text ? `<p>${esc(a.text)}</p>` : ''}</div>`).join('')}</div>` : ''}
    ${ins.clashes.length ? `<div class="kicker">осторожно сочетать</div><div class="info-list">${ins.clashes.map(c => `<div class="info warn"><p style="color:var(--wine)">${esc(c)}</p></div>`).join('')}</div>` : ''}
    <div class="info-list">
      <div class="info"><b>В схеме</b><p>${ins.routines.length ? esc(ins.routines.join(', ')) : 'пока не используется'}</p></div>
      ${ins.expiry ? `<div class="info"><b>Годен после вскрытия до ${fmtDate(ins.expiry.until)}</b><p>${ins.expiry.left < 0 ? 'срок вышел' : `осталось ${ins.expiry.left} дн.`} · открыто ${fmtDate(p.opened)}</p></div>` : ''}
      ${p.status === 'pause' && p.pauseUntil ? `<div class="info"><b>Пауза до ${fmtDate(p.pauseUntil)}</b></div>` : ''}
      ${p.price || p.volume ? `<div class="info"><b>${p.price ? `${Number(p.price).toLocaleString('ru-RU')} ₽` : ''}${p.price && p.volume ? ' · ' : ''}${esc(p.volume)}</b></div>` : ''}
    </div>
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

function editProduct(id) {
  const p = id ? product(id) : null;
  draft = p ? JSON.parse(JSON.stringify(p)) : {
    id: uid(), name: '', brand: '', cat: ui.tab === 'catalog' && ui.cat !== 'all' ? ui.cat : 'face', type: '', status: 'use', actives: [],
    opened: '', pao: 12, price: '', volume: '', rating: 0, note: '', color: '', photo: '', pauseUntil: '', created: today(),
    fav: ui.tab === 'fav', kit: ui.tab === 'catalog' ? 'shelf' : 'bag', pos: null,
  };
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
    <div class="field"><span>Активы и состав</span><div class="opt-grid">${ACTIVES.map(([id, n]) => `<button class="opt ${d.actives.includes(id) ? 'on' : ''}" data-act="fact" data-v="${id}">${n}</button>`).join('')}</div></div>
    <div class="field"><span>Цвет стикера</span><div class="swatches">${SWATCHES.map(c => `<button class="sw ${d.color === c ? 'on' : ''}" style="background:${c}" data-act="fset" data-f="color" data-v="${c}" aria-label="${c}"></button>`).join('')}</div></div>
    <div class="two">
      <label class="field"><span>Открыто</span><input class="input" type="date" data-f="opened" value="${esc(d.opened)}"></label>
      <label class="field"><span>Срок, мес</span><input class="input" type="number" inputmode="numeric" min="1" max="60" data-f="pao" value="${esc(d.pao)}"></label>
    </div>
    <div class="two">
      <label class="field"><span>Цена, ₽</span><input class="input" type="number" inputmode="numeric" data-f="price" value="${esc(d.price)}"></label>
      <label class="field"><span>Объём</span><input class="input" data-f="volume" value="${esc(d.volume)}" placeholder="50 мл"></label>
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
  s.routines = Object.assign({ morning: [], day: [], eveA: [], eveB: [], weekly: [] }, s.routines || {});
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
  for (const p of s.products) { if (!p.kit) p.kit = 'shelf'; if (p.kit === 'table' && !p.pos) p.kit = 'bag'; }
  return s;
}

// ═════════ РЕНДЕР ═════════
const SCREENS = { home: screenHome, kit: screenKit, catalog: screenCatalog, routine: screenRoutine, fav: screenFav, profile: screenProfile };

function render() {
  $('#main').innerHTML = SCREENS[ui.tab]();
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
  const act = el.dataset.act, v = el.dataset.v, id = el.dataset.id;
  switch (act) {
    case 'tab': if (sheetOpen()) closeSheet(); go(v); break;
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
      const p = product(id); p.status = v; if (v !== 'pause') p.pauseUntil = '';
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
    case 'nophoto': draft.photo = ''; renderForm(!!product(draft.id)); break;
    case 'fsave': {
      if (!draft.name.trim() && !draft.brand.trim()) { toast('Напиши название или бренд'); return; }
      draft.pao = Number(draft.pao) || ''; draft.price = draft.price === '' ? '' : Number(draft.price);
      if (draft.kit !== 'table') draft.pos = null;
      const i = state.products.findIndex(p => p.id === draft.id), isNew = i < 0;
      if (isNew) state.products.push(draft); else state.products[i] = draft;
      const pid = draft.id, where = draft.kit;
      save(); closeSheet();
      if (isNew && ui.tab === 'kit') ui.enter = true;
      render();
      toast(isNew ? (where === 'shelf' ? 'Добавлено в каталог ✦' : 'Положила в косметичку ✦') : 'Сохранено');
      if (isNew) $(`[data-id="${pid}"], [data-drag="${pid}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      break;
    }
    case 'slot': ui.slot = v; render(); break;
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
function applyUpdate() { if (reg?.waiting) reg.waiting.postMessage('skipWaiting'); else location.reload(); }
async function checkUpdate(manual) {
  if (!reg) { if (manual) toast('Обновления работают в установленном приложении'); return; }
  try {
    await reg.update();
    if (reg.waiting) showUpdateBanner();
    else if (manual) setTimeout(() => { if (reg.installing) toast('Загружаю обновление…'); else if (!reg.waiting) toast(`У тебя последняя версия ${APP_VERSION}`); }, 900);
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
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(false); });
}

// ═════════ СТАРТ ═════════
(async function init() {
  const loaded = await loadState();
  state = loaded && Array.isArray(loaded.products) ? migrate(loaded) : seedState();
  save();
  requestPersist();
  $('#ver').textContent = `glowbag v${APP_VERSION}`;
  const start = new URLSearchParams(location.search).get('tab');
  if (start && SCREENS[start]) ui.tab = start;
  render();
  setupSW();
})();
