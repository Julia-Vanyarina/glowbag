// Напоминания для календаря iPhone (.ics)
import { addDays, addMonths, fmtDate } from './analysis.js';

const pad = n => String(n).padStart(2, '0');
const stamp = () => { const d = new Date(); return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`; };
const local = (date, time) => `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;
const escTxt = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

// разбивает длинные строки по правилам iCalendar (75 байт)
function fold(line) {
  const out = []; let cur = '';
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > 73) { out.push(cur); cur = ' ' + ch; } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n');
}

export function nextWeekday(fromIso, weekday /* 0=вс */) {
  const d = new Date(fromIso + 'T12:00');
  const diff = (weekday - d.getDay() + 7) % 7 || 7;
  return addDays(fromIso, diff);
}

const pname = p => (p.name || '').toLowerCase().startsWith((p.brand || '').toLowerCase()) ? p.name : `${p.brand} ${p.name}`.trim();

// список возможных напоминаний по данным приложения
export function buildReminders(state, today, s) {
  const out = [];
  const pr = state.profile;
  const name = pr.activeName || 'актив';
  if (pr.activeStart && Number(pr.rampDays) > 0) {
    const d = addDays(pr.activeStart, Number(pr.rampDays));
    if (d >= today) out.push({ id: 'ramp', date: d, time: s.evening, title: `${name} — теперь каждый вечер`, text: `Привыкание закончилось. Если кожа спокойна, наноси ${name} каждый вечер.`, kind: 'Схема' });
  }
  for (const p of state.products) {
    if (p.status === 'pause' && p.pauseUntil && p.pauseUntil >= today)
      out.push({ id: 'pause-' + p.id, date: p.pauseUntil, time: s.evening, title: `Вернуть: ${pname(p)}`, text: p.note || 'Пауза закончилась — возвращай постепенно, раз в неделю в вечер без активов.', kind: 'Пауза' });
    if (p.opened && p.pao && !['empty', 'wish'].includes(p.status)) {
      const until = addMonths(p.opened, p.pao);
      const warn = addDays(until, -14);
      const d = warn >= today ? warn : until >= today ? until : '';
      if (d) out.push({ id: 'exp-' + p.id, date: d, time: s.day, title: `Срок годности: ${pname(p)}`, text: `Годен после вскрытия до ${fmtDate(until)}.`, kind: 'Срок' });
    }
  }
  out.push({ id: 'backup', date: nextWeekday(today, 0), time: s.day, title: 'glowbag: сохранить копию', text: 'Профиль → Сохранить копию → Файлы или Яндекс Диск.', kind: 'Бэкап', rrule: 'FREQ=WEEKLY' });
  const y = Number(today.slice(0, 4));
  for (const [md, title, text] of [['03-15', 'Переключить уход на летнюю схему', 'В glowbag: Уход → ☀ лето. УФ-индекс растёт — SPF каждый день.'], ['10-15', 'Переключить уход на зимнюю схему', 'В glowbag: Уход → ❄ зима. Отопление сушит кожу — больше увлажнения.']]) {
    let d = `${y}-${md}`; if (d < today) d = `${y + 1}-${md}`;
    out.push({ id: 'season-' + md, date: d, time: s.day, title, text, kind: 'Сезон', rrule: 'FREQ=YEARLY' });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function toICS(events) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//glowbag//RU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:glowbag'];
  for (const e of events) {
    lines.push('BEGIN:VEVENT',
      `UID:glowbag-${e.id}@glowbag.app`,
      `DTSTAMP:${stamp()}`,
      `DTSTART:${local(e.date, e.time)}`,
      'DURATION:PT15M',
      fold(`SUMMARY:${escTxt(e.title)}`),
      fold(`DESCRIPTION:${escTxt(e.text || '')}`));
    if (e.rrule) lines.push(`RRULE:${e.rrule}`);
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', fold(`DESCRIPTION:${escTxt(e.title)}`), 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
