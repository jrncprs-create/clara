import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECTBRAIN_PROJECTS = {
  clara: 'projectbrain/projects/clara.md',
  lalampe: 'projectbrain/projects/lalampe.md',
  begeister: 'projectbrain/projects/begeister.md',
  'afk-landjuweel-amarte': 'projectbrain/projects/afk-landjuweel-amarte.md',
  'clara-core-lab': 'projectbrain/projects/clara-core-lab.md'
};

function getAmsterdamDateInfo(nowOverride = null) {
  const now = nowOverride ? new Date(nowOverride) : new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short'
  }).formatToParts(now);
  const part = (type) => parts.find((item) => item.type === type)?.value || '';
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);

  const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrow = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(tomorrowDate);

  const hour = Number(part('hour') || 0);
  const minute = Number(part('minute') || 0);
  const weekdayName = part('weekday').toLowerCase();
  const weekday = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].findIndex((name) => weekdayName.startsWith(name));

  return {
    today,
    tomorrow,
    now: {
      iso: now.toISOString(),
      date: today,
      hour,
      minute,
      minutes: hour * 60 + minute,
      weekday: weekday < 0 ? now.getDay() : weekday,
      label: `${today} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    }
  };
}

function addDaysIso(isoDate, days) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function detectRequestedPlanningDays(text, today) {
  const normalized = String(text || '').toLowerCase();
  let match = normalized.match(/(?:de\s+)?(?:komende|volgende|aanstaande|next)\s+(\d{1,2})\s+dagen/);
  if (!match) {
    match = normalized.match(/\b(?:komende|volgende|aanstaande)\s+(\d{1,2})\s+dag(?:en)?\b/);
  }
  if (!match) {
    const m2 = normalized.match(/\b(\d{1,2})\s+dagen\b/);
    if (m2 && /planning|plannen|\bplan\b|agenda|indelen|realistische/.test(normalized)) {
      match = m2;
    }
  }
  let count = match ? Math.max(1, Math.min(14, Number(match[1]))) : 1;
  if (
    count === 1 &&
    /\bvandaag\b/.test(normalized) &&
    /\bmorgen\b/.test(normalized) &&
    /planning|plannen|\bplan\b|agenda|projectbrain|realistisch/i.test(normalized)
  ) {
    count = 2;
  }
  return Array.from({ length: count }, (_, index) => addDaysIso(today, index));
}

function timeToMin(value) {
  if (!value || !/^\d{1,2}:[0-5]\d$/.test(String(value))) return null;
  const [hours, minutes] = String(value).split(':').map(Number);
  if (hours < 0 || hours > 24) return null;
  return hours * 60 + minutes;
}

function minToTime(value) {
  const safe = Math.max(0, Math.min(24 * 60, Math.round(value)));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function roundToQuarter(value) {
  return Math.round(value / 15) * 15;
}

function nextQuarterAtOrAfter(value) {
  return Math.ceil(value / 15) * 15;
}

function dayOfWeekIso(isoDate) {
  return new Date(`${isoDate}T12:00:00Z`).getUTCDay();
}

function isWeekendIso(isoDate) {
  const dow = dayOfWeekIso(isoDate);
  return dow === 0 || dow === 6;
}

function easterSundayIso(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isDutchHoliday(isoDate) {
  const [year, month, day] = String(isoDate || '').split('-').map(Number);
  if (!year || !month || !day) return false;
  const md = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (['01-01', '04-27', '12-25', '12-26'].includes(md)) return true;
  const easter = easterSundayIso(year);
  return isoDate === addDaysIso(easter, 1) || isoDate === addDaysIso(easter, 39) || isoDate === addDaysIso(easter, 50);
}

function workWindowForDate(isoDate) {
  if (isWeekendIso(isoDate) || isDutchHoliday(isoDate)) return null;
  const dow = dayOfWeekIso(isoDate);
  return { start: dow === 1 ? 11 * 60 : 10 * 60, end: 18 * 60 };
}

function nextWorkdayFrom(dateIso) {
  let date = dateIso;
  while (!workWindowForDate(date)) {
    date = addDaysIso(date, 1);
  }
  return date;
}

function nextDateForWeekday(fromIso, targetDow) {
  const current = dayOfWeekIso(fromIso);
  let delta = (targetDow - current + 7) % 7;
  if (delta === 0) delta = 7;
  return addDaysIso(fromIso, delta);
}

function workdayStartMinutes(dateIso) {
  return workWindowForDate(dateIso)?.start ?? 10 * 60;
}

function explicitEveningIntent(text) {
  return /\b(vanavond|vandaag\s+nog|nu\s+nog|nu|straks)\b/i.test(String(text || ''));
}

function explicitWeekendIntent(text) {
  return /\b(zaterdag|zondag|dit\s+weekend|weekend|harde\s+klus|harde\s+deadline|deadline|om\s+\d{1,2}[:.]\d{2})\b/i.test(String(text || ''));
}

function explicitHolidayIntent(text) {
  return /\b(feestdag|kerst|koningsdag|nieuwjaarsdag|paas|pinkster|hemelvaart)\b/i.test(String(text || ''));
}

function allowsOutOfPolicyPlanning(text) {
  return explicitEveningIntent(text) || explicitWeekendIntent(text) || explicitHolidayIntent(text);
}

function itemIsHardAndExplicit(item) {
  if (!isHardAgendaItem(item)) return false;
  return item.status === 'confirmed' || item.status === 'external_busy' || item.source === 'explicit_user_weekend_time';
}

function occupiedForDate(agenda, date, excludeIndex = -1) {
  return (Array.isArray(agenda) ? agenda : [])
    .map((item, index) => ({ item, index }))
    .filter(({ item, index }) => index !== excludeIndex && item?.date === date && item.start_time && item.status !== 'needs_time' && item.status !== 'cancelled')
    .map(({ item }) => {
      const start = timeToMin(item.start_time);
      const end = timeToMin(item.end_time);
      if (start == null) return null;
      const duration = Math.max(15, Number(item.estimated_duration_minutes || (end != null ? end - start : 30) || 30));
      return { start, end: end ?? start + duration };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);
}

function getNextPlanningStart(nowInfo, text = '', duration = 60) {
  const now = nowInfo || {};
  const today = now.date;
  const dow = Number.isInteger(now.weekday) ? now.weekday : dayOfWeekIso(today);
  const mins = Number.isFinite(now.minutes) ? now.minutes : 10 * 60;
  const wantsTonight = explicitEveningIntent(text);
  const wantsWeekend = explicitWeekendIntent(text);

  if (dow === 6 && !wantsWeekend && !wantsTonight) {
    const date = nextWorkdayFrom(addDaysIso(today, 2));
    return { date, start: workdayStartMinutes(date), reason: 'Weekend standaard vrij; eerstvolgende geschikte werkdag.' };
  }
  if (dow === 0 && !wantsWeekend && !wantsTonight) {
    const date = nextWorkdayFrom(addDaysIso(today, 1));
    return { date, start: workdayStartMinutes(date), reason: 'Zondagavond niet meer als werkplanning; eerstvolgende geschikte werkdag.' };
  }
  if (mins >= 20 * 60 && !wantsTonight) {
    const date = nextWorkdayFrom(addDaysIso(today, 1));
    return { date, start: workdayStartMinutes(date), reason: 'Na 20:00 behandel ik vandaag als praktisch voorbij.' };
  }
  if (mins >= 17 * 60 + 30 && !wantsTonight) {
    const date = nextWorkdayFrom(addDaysIso(today, dow === 5 ? 3 : 1));
    return { date, start: workdayStartMinutes(date), reason: 'Na 17:30 plan ik nieuw werk liever naar de eerstvolgende geschikte werkdag.' };
  }

  let start = Math.max(workdayStartMinutes(today), nextQuarterAtOrAfter(mins + 10));
  if (wantsTonight && mins >= 20 * 60) {
    start = nextQuarterAtOrAfter(mins + 5);
    const latestEnd = 24 * 60 - 1;
    if (start + duration > latestEnd) return { date: today, start: Math.max(mins, latestEnd - Math.max(15, Math.min(duration, 45))), end: latestEnd, reason: 'Expliciet vanavond gevraagd; licht potloodblok vandaag toegestaan.' };
  }
  if (start + duration > 23 * 60 && !wantsTonight) {
    const date = nextWorkdayFrom(addDaysIso(today, 1));
    return { date, start: workdayStartMinutes(date), reason: 'Vandaag past dit niet meer eerlijk in de resterende werkruimte.' };
  }
  return { date: today, start, reason: wantsTonight ? 'Expliciet vanavond gevraagd; licht potloodblok vandaag toegestaan.' : 'Eerstvolgende vrije werkplek volgens tijdbeleid.' };
}

function getNextValidWorkStart(nowInfo, options = {}) {
  const duration = Math.max(15, Number(options.duration || 60));
  const agenda = Array.isArray(options.agenda) ? options.agenda : [];
  let date = options.fromDate || nowInfo?.date;
  const today = nowInfo?.date;
  const afterNow = options.afterNow !== false;

  for (let guard = 0; guard < 21; guard += 1) {
    const win = workWindowForDate(date);
    if (!win) {
      date = addDaysIso(date, 1);
      continue;
    }
    let earliest = win.start;
    if (afterNow && date === today) {
      if ((nowInfo?.minutes ?? 0) >= win.end || (nowInfo?.minutes ?? 0) >= 18 * 60) {
        date = addDaysIso(date, 1);
        continue;
      }
      earliest = Math.max(earliest, nextQuarterAtOrAfter((nowInfo?.minutes ?? win.start) + 10));
    }
    const slot = findFreeSlot(occupiedForDate(agenda, date, options.excludeIndex ?? -1), duration, earliest, win.end);
    if (slot) return { date, start: slot.start, end: slot.end };
    date = addDaysIso(date, 1);
  }

  const fallback = nextWorkdayFrom(addDaysIso(today, 1));
  const start = workdayStartMinutes(fallback);
  return { date: fallback, start, end: start + duration };
}

function isHardAgendaItem(item) {
  return item?.status === 'confirmed' || item?.status === 'external_busy' || item?.kind === 'appointment' || item?.kind === 'deadline';
}

function buildDayOccupancy(items) {
  const occupied = [];
  for (const item of items) {
    const start = timeToMin(item.start_time);
    const end = timeToMin(item.end_time);
    if (start == null) continue;
    const duration = Math.max(15, Number(item.estimated_duration_minutes || (end != null ? end - start : 30) || 30));
    occupied.push({ start, end: end ?? start + duration });
  }
  return occupied.sort((a, b) => a.start - b.start);
}

function findFreeSlot(occupied, duration, earliest, dayEnd) {
  let start = earliest;
  while (start + duration <= dayEnd) {
    const end = start + duration;
    const blocking = occupied.find((busy) => start < busy.end && busy.start < end);
    if (!blocking) return { start, end };
    start = roundToQuarter(blocking.end + 1);
  }
  return null;
}

function spreadSoftAgendaAcrossRequestedDays(result, requestedDays) {
  if (!Array.isArray(result?.clara_agenda) || requestedDays.length <= 1) return result;

  const DAY_START = 10 * 60;
  const DAY_END = 23 * 60;
  const agenda = result.clara_agenda;
  const movable = agenda.filter((item) => item?.date && requestedDays.includes(item.date) && !isHardAgendaItem(item));
  if (movable.length <= 1) return result;

  const dayLoad = new Map(requestedDays.map((date) => [date, 0]));
  const dayItems = new Map(requestedDays.map((date) => [date, agenda.filter((item) => item.date === date && isHardAgendaItem(item))]));

  for (const item of agenda) {
    if (!item?.date || !requestedDays.includes(item.date) || isHardAgendaItem(item)) continue;
    const duration = Math.max(15, Number(item.estimated_duration_minutes || 60));
    dayLoad.set(item.date, (dayLoad.get(item.date) || 0) + duration);
  }

  movable.sort((a, b) => {
    const ad = Math.max(15, Number(a.estimated_duration_minutes || 60));
    const bd = Math.max(15, Number(b.estimated_duration_minutes || 60));
    return bd - ad;
  });

  for (const item of movable) {
    const duration = Math.max(15, Number(item.estimated_duration_minutes || 60));
    const currentDate = item.date;
    const bestDate = [...requestedDays].sort((a, b) => (dayLoad.get(a) || 0) - (dayLoad.get(b) || 0))[0];

    if (bestDate && bestDate !== currentDate) {
      dayLoad.set(currentDate, Math.max(0, (dayLoad.get(currentDate) || 0) - duration));
      dayLoad.set(bestDate, (dayLoad.get(bestDate) || 0) + duration);
      item.date = bestDate;
    }
  }

  for (const date of requestedDays) {
    const dateItems = agenda.filter((item) => item.date === date);
    const occupied = buildDayOccupancy(dateItems.filter(isHardAgendaItem));
    const soft = dateItems.filter((item) => !isHardAgendaItem(item));

    let earliest = DAY_START;
    for (const item of soft) {
      const duration = Math.max(15, Number(item.estimated_duration_minutes || 60));
      const slot = findFreeSlot(occupied, duration, earliest, DAY_END);

      if (!slot) {
        item.status = 'needs_time';
        item.start_time = null;
        item.end_time = null;
        item.reason = `${item.reason || 'Niet automatisch ingepland.'} Geen vrije plek gevonden op ${date}.`;
        if (Array.isArray(result.scheduling_needs)) {
          result.scheduling_needs.push({
            title: item.title || 'Ongeplande taak',
            preferred_date: date,
            estimated_duration_minutes: duration,
            priority: 'high',
            reason: 'Clara kon deze taak niet zonder overlap in de meerdaagse planning plaatsen.'
          });
        }
        continue;
      }

      item.start_time = minToTime(slot.start);
      item.end_time = minToTime(slot.end);
      item.estimated_duration_minutes = duration;
      item.status = item.status === 'conflict' ? 'pencil' : item.status;
      item.confirmation_required = true;
      occupied.push(slot);
      occupied.sort((a, b) => a.start - b.start);
      earliest = roundToQuarter(slot.end + 1);
    }
  }

  result.clara_agenda = agenda;
  return result;
}

function sanitizeClaraAgenda(result, options = {}) {
  if (!result || !Array.isArray(result.clara_agenda)) return result;

  const DAY_START = 10 * 60;
  const DAY_END = 23 * 60;
  const requestedDays = Array.isArray(options.requestedDays) ? options.requestedDays : [];

  if (requestedDays.length > 1) {
    spreadSoftAgendaAcrossRequestedDays(result, requestedDays);
  }

  const grouped = new Map();
  const agenda = result.clara_agenda.map((item) => ({ ...item }));

  for (const item of agenda) {
    if (!item.date) continue;
    if (!grouped.has(item.date)) grouped.set(item.date, []);
    grouped.get(item.date).push(item);
  }

  for (const [, items] of grouped.entries()) {
    const hard = [];
    const soft = [];

    for (const item of items) {
      const start = timeToMin(item.start_time);
      const end = timeToMin(item.end_time);
      if (start == null) continue;

      const duration = Math.max(15, Number(item.estimated_duration_minutes || (end != null ? end - start : 30) || 30));
      const normalized = { item, start, end: end ?? start + duration, duration };

      if (isHardAgendaItem(item)) hard.push(normalized);
      else soft.push(normalized);
    }

    hard.sort((a, b) => a.start - b.start);
    soft.sort((a, b) => a.start - b.start);

    const occupied = hard.map((slot) => ({ start: slot.start, end: Math.max(slot.end, slot.start + 15) }));

    for (let i = 1; i < hard.length; i += 1) {
      const previous = hard[i - 1];
      const current = hard[i];
      if (current.start < previous.end) {
        previous.item.status = 'conflict';
        current.item.status = 'conflict';
      }
    }

    for (const slot of soft) {
      let start = Math.max(DAY_START, roundToQuarter(slot.start));
      let placed = false;

      while (start + slot.duration <= DAY_END) {
        const end = start + slot.duration;
        const overlapsHard = occupied.some((busy) => start < busy.end && busy.start < end);
        if (!overlapsHard) {
          slot.item.start_time = minToTime(start);
          slot.item.end_time = minToTime(end);
          slot.item.estimated_duration_minutes = slot.duration;
          slot.item.status = slot.item.status === 'conflict' ? 'pencil' : slot.item.status;
          slot.item.confirmation_required = true;
          occupied.push({ start, end });
          occupied.sort((a, b) => a.start - b.start);
          placed = true;
          break;
        }

        const blocking = occupied.find((busy) => start < busy.end && busy.start < end);
        start = roundToQuarter((blocking?.end ?? end) + 1);
      }

      if (!placed) {
        slot.item.status = 'needs_time';
        slot.item.start_time = null;
        slot.item.end_time = null;
        slot.item.reason = `${slot.item.reason || 'Niet automatisch ingepland.'} Geen vrije plek gevonden zonder overlap.`;
        if (Array.isArray(result.scheduling_needs)) {
          result.scheduling_needs.push({
            title: slot.item.title || 'Ongeplande taak',
            preferred_date: slot.item.date || null,
            estimated_duration_minutes: slot.duration,
            priority: 'high',
            reason: 'Clara kon deze taak niet zonder overlap in de dagplanning plaatsen.'
          });
        }
      }
    }
  }

  result.clara_agenda = agenda;
  return result;
}

function sanitizeDayReview(parsed, today) {
  if (!parsed?.day_review) return parsed;
  const agenda = Array.isArray(parsed.clara_agenda) ? parsed.clara_agenda : [];
  const titlesToday = new Set(
    agenda
      .filter((i) => i && (i.date || today) === today)
      .map((i) => String(i.title || '').trim().toLowerCase())
      .filter(Boolean)
  );
  let items = (Array.isArray(parsed.day_review.items_to_check) ? parsed.day_review.items_to_check : [])
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  items = items
    .filter((s) => {
      if (isGenericAttentionText(s)) return false;
      const sl = s.toLowerCase();
      for (const tt of titlesToday) {
        if (!tt || sl.length < 6) continue;
        if (tt === sl) return false;
        if (Math.min(tt.length, sl.length) >= 10 && (tt.includes(sl) || sl.includes(tt))) return false;
      }
      return true;
    })
    .slice(0, 2);
  const hasPencil = agenda.some((i) => i && (i.date || today) === today && i.status === 'pencil');
  if (!items.length && hasPencil) {
    items.push('Controleer lokaal én mobiel vóór je pusht of een review-link deelt.');
    items.push('Zet pas daarna externe uitnodigingen klaar als de staat klopt.');
  } else if (items.length === 1 && hasPencil) {
    items.push('Zet pas daarna externe uitnodigingen klaar als de staat klopt.');
  }
  items = items.slice(0, 2);

  let rp = String(parsed.day_review.review_prompt || '').trim();
  const weakReview = !rp || rp.length < 18 || /^wil je de potlood/i.test(rp) || /^kloppen de/i.test(rp);
  if (weakReview) rp = 'Wat is af genoeg om online te tonen, en wat schuift bewust door?';

  let nm = String(parsed.day_review.now_first_move || '').trim();
  const nml = nm.toLowerCase();
  if (nm && titlesToday.has(nml)) {
    nm = '';
  }
  if (!nm) {
    const first = agenda.find(
      (i) => i && (i.date || today) === today && i.start_time && String(i.title || '').trim() && i.status !== 'needs_time'
    );
    if (first) {
      const title = String(first.title || '').trim();
      const blob = `${title} ${first.project || ''}`.toLowerCase();
      const why = /core|lab|mobiel|marlon|push|vercel/.test(blob)
        ? 'dat bepaalt of Marlon straks redelijk mee kan kijken.'
        : /lalampe|lampe/.test(blob)
          ? 'daarna kun je gerichter workshop/materiaal oppakken.'
          : 'dat zet volgorde en tempo voor de rest van de dag.';
      nm = `Start met ${title}; ${why}`;
    } else {
      nm = 'Begin met het blok dat de meeste onzekerheid wegneemt voordat je verder indeelt.';
    }
  }

  parsed.day_review = {
    ...parsed.day_review,
    now_first_move: nm.slice(0, 320),
    items_to_check: items,
    review_prompt: rp.slice(0, 280),
    rollover_candidates: Array.isArray(parsed.day_review.rollover_candidates)
      ? parsed.day_review.rollover_candidates.map((s) => String(s || '').trim()).filter(Boolean).slice(0, 3)
      : []
  };
  return parsed;
}

function enforceStartupAgendaMetadata(parsed, today, tomorrow) {
  if (!parsed?.clara_agenda) return parsed;
  const allowedDates = new Set([today, tomorrow]);
  const agenda = parsed.clara_agenda.map((item) => {
    const base = { ...item };
    if (base.status !== 'external_busy' && base.status !== 'confirmed') {
      if (base.status !== 'needs_time') {
        base.status = 'pencil';
        base.confirmation_required = true;
      }
      base.source = 'projectbrain_startup';
    }
    return base;
  });
  const timed = agenda.filter(
    (i) =>
      i.start_time &&
      /^\d{1,2}:[0-5]\d$/.test(String(i.start_time)) &&
      i.date &&
      allowedDates.has(String(i.date)) &&
      i.status !== 'needs_time'
  );
  const picked = [];
  const seenProjDay = new Set();
  for (const it of timed) {
    const key = `${it.date}|${String(it.project || '').toLowerCase()}`;
    if (seenProjDay.has(key)) continue;
    seenProjDay.add(key);
    picked.push(it);
    if (picked.length >= 5) break;
  }
  const rest = agenda.filter((i) => {
    if (picked.includes(i)) return false;
    if (i.start_time && i.date && allowedDates.has(String(i.date)) && i.status !== 'needs_time') {
      const key = `${i.date}|${String(i.project || '').toLowerCase()}`;
      if (seenProjDay.has(key)) return false;
    }
    return true;
  });
  parsed.clara_agenda = [...picked, ...rest];
  return parsed;
}

async function githubRequest({ token, url }) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'clara-core-lab'
    }
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(`GitHub request failed: ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function formatProjectbrainContext(stableParts, rawParts) {
  return [
    `STABIELE PROJECTCONTEXT\n\n${stableParts.join('\n\n---\n\n')}`,
    `RECENTE PROJECTSIGNALEN\n\n${rawParts.join('\n\n---\n\n')}`
  ].join('\n\n====================\n\n');
}

async function findLocalProjectbrainRoot() {
  const apiDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(apiDir, '../../projectbrain'),
    path.resolve(process.cwd(), '../projectbrain'),
    path.resolve(process.cwd(), 'projectbrain')
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch (_) {
      // Try next likely workspace location.
    }
  }

  return null;
}

async function loadLocalProjectbrainContext() {
  const root = await findLocalProjectbrainRoot();
  if (!root) return null;

  let localReads = 0;
  const stableParts = await Promise.all(Object.entries(PROJECTBRAIN_PROJECTS).map(async ([project, projectPath]) => {
    const rel = projectPath.replace(/^projectbrain\//, '');
    const filePath = path.join(root, rel);
    try {
      const content = await readFile(filePath, 'utf8');
      localReads += 1;
      return `## ${project}\nBestand: ${projectPath}\nBron: lokaal\n\n${content}`;
    } catch (error) {
      return `## ${project}\nBestand: ${projectPath}\nBron: lokaal\n\nKon lokaal niet laden: ${error.message || String(error)}`;
    }
  }));

  const rawParts = await Promise.all(Object.entries(PROJECTBRAIN_PROJECTS).map(async ([project, projectPath]) => {
    const rawPath = projectPath.replace('/projects/', '/raw/');
    const rel = rawPath.replace(/^projectbrain\//, '');
    const filePath = path.join(root, rel);
    try {
      const content = await readFile(filePath, 'utf8');
      localReads += 1;
      const status = hasMeaningfulRawContent(content) ? 'meaningful' : 'empty';
      return `## ${project}\nBestand: ${rawPath}\nBron: lokaal\nRaw-status: ${status}\n\n${content}`;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return `## ${project}\nBestand: ${rawPath}\nBron: lokaal\nRaw-status: missing\n\nGeen recent raw-bestand gevonden.`;
      }
      return `## ${project}\nBestand: ${rawPath}\nBron: lokaal\nRaw-status: error\n\nKon raw niet laden: ${error.message || String(error)}`;
    }
  }));

  return localReads > 0 ? formatProjectbrainContext(stableParts, rawParts) : null;
}

async function loadProjectbrainContext() {
  const localContext = await loadLocalProjectbrainContext();
  if (localContext) return localContext;

  const token = process.env.PROJECTBRAIN_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  const targetRepo = process.env.PROJECTBRAIN_REPO || 'jrncprs-create/clara';
  const branch = process.env.PROJECTBRAIN_BASE_BRANCH || 'main';

  if (!token) return 'Projectbrain-context niet geladen: GitHub token ontbreekt.';

  const [owner, repo] = targetRepo.split('/');
  if (!owner || !repo) return 'Projectbrain-context niet geladen: PROJECTBRAIN_REPO is ongeldig.';

  const stableParts = await Promise.all(Object.entries(PROJECTBRAIN_PROJECTS).map(async ([project, path]) => {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${encodeURIComponent(branch)}`;
      const file = await githubRequest({ token, url });
      const content = Buffer.from(file.content || '', 'base64').toString('utf8');
      return `## ${project}\nBestand: ${path}\n\n${content}`;
    } catch (error) {
      return `## ${project}\nBestand: ${path}\n\nKon niet laden: ${error.message || String(error)}`;
    }
  }));

  const rawParts = await Promise.all(Object.entries(PROJECTBRAIN_PROJECTS).map(async ([project, path]) => {
    const rawPath = path.replace('/projects/', '/raw/');
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(rawPath).replace(/%2F/g, '/')}?ref=${encodeURIComponent(branch)}`;
      const file = await githubRequest({ token, url });
      const content = Buffer.from(file.content || '', 'base64').toString('utf8');
      const status = hasMeaningfulRawContent(content) ? 'meaningful' : 'empty';
      return `## ${project}\nBestand: ${rawPath}\nRaw-status: ${status}\n\n${content}`;
    } catch (error) {
      if (error.status === 404) {
        return `## ${project}\nBestand: ${rawPath}\nRaw-status: missing\n\nGeen recent raw-bestand gevonden.`;
      }
      return `## ${project}\nBestand: ${rawPath}\nRaw-status: error\n\nKon raw niet laden: ${error.message || String(error)}`;
    }
  }));

  return formatProjectbrainContext(stableParts, rawParts);
}

function getOutputText(data) {
  return data.output_text || data.output?.flatMap(item => item.content || []).find(part => part.type === 'output_text')?.text;
}

function hasMeaningfulRawContent(content) {
  const ignored = new Set([
    'recente signalen',
    'open eindjes',
    'mogelijke vervolgacties',
    'aandacht / twijfel',
    'laatst bijgewerkt'
  ]);
  const lines = String(content || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, '').replace(/^#+\s*/, '').trim())
    .filter(Boolean)
    .filter((line) => !ignored.has(line.toLowerCase()))
    .filter((line) => !/^\d{4}-\d{2}-\d{2}$/.test(line))
    .filter((line) => !/^[\w\s/-]+—\s*raw$/i.test(line))
    .filter((line) => !/^geen recent raw-bestand gevonden/i.test(line))
    .filter((line) => !/^kon raw niet laden/i.test(line));
  return lines.some((line) => line.length >= 18);
}

function getMeaningfulRawProjects(projectbrainContext) {
  const context = String(projectbrainContext || '');
  const hits = [];
  for (const project of Object.keys(PROJECTBRAIN_PROJECTS)) {
    const re = new RegExp(`##\\s+${project.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\nBestand:\\s+projectbrain/raw/[^\\n]+\\n(?:Bron:\\s+[^\\n]+\\n)?Raw-status:\\s+meaningful`, 'i');
    if (re.test(context)) hits.push(project);
  }
  return hits;
}

function getRawBlockForProject(projectbrainContext, project) {
  const context = String(projectbrainContext || '');
  const re = new RegExp(
    `##\\s+${project.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\nBestand:\\s+projectbrain/raw/[^\\n]+\\n(?:Bron:\\s+[^\\n]+\\n)?Raw-status:\\s+meaningful\\n\\n([\\s\\S]*?)(?=\\n---\\n\\n##\\s+|$)`,
    'i'
  );
  return context.match(re)?.[1] || '';
}

function extractSectionLines(markdown, names) {
  const lines = String(markdown || '').split(/\r?\n/);
  const out = [];
  let active = false;
  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      active = names.some((name) => heading[1].toLowerCase().includes(name));
      continue;
    }
    if (!active) continue;
    const bullet = line.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (bullet) out.push(bullet[1].trim());
  }
  return out;
}

function cleanRawThreadLine(line) {
  return String(line || '')
    .replace(/^(Open vraag|Aandacht|Mogelijke actie|Niet hard plannen):\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildRawFallbackOpenThreads(projectbrainContext, projects, today) {
  const active = Array.isArray(projects) ? projects : [];
  const out = [];
  for (const project of active) {
    const block = getRawBlockForProject(projectbrainContext, project);
    if (!block) continue;
    const preferred = extractSectionLines(block, ['open items', 'chat-reminders', 'open eindjes']);
    const questionLike = String(block).split(/\r?\n/)
      .map((line) => line.match(/^\s*[-*]\s+(.+?)\s*$/)?.[1] || '')
      .filter((line) => /^open vraag:/i.test(line));
    const candidates = [...preferred, ...questionLike]
      .map(cleanRawThreadLine)
      .filter((line) => line.length >= 16)
      .sort((a, b) => {
        const score = (line) => {
          const s = line.toLowerCase();
          let n = 0;
          if (/marketing/.test(s)) n += 6;
          if (/testavond/.test(s)) n += 4;
          if (/technisch/.test(s)) n += 3;
          if (/foto|video|promot/.test(s)) n += 2;
          return -n;
        };
        return score(a) - score(b);
      });
    const seen = new Set();
    for (const line of candidates) {
      const key = line.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const title = line.replace(/[?!.]+$/, '').slice(0, 90);
      out.push(normalizeOpenThread({
        id: `raw-${project}-${out.length + 1}`,
        project,
        title,
        question: /\?$/.test(line) ? line : `${line}?`,
        context: `Recent raw-signaal uit ${PROJECT_LABELS[project] || project}.`,
        status: 'open',
        source: 'projectbrain_raw',
        last_seen: today,
        importance: 'normal',
        suggested_next_step: 'Bespreken, laten hangen, sluiten of later plannen.'
      }, out.length));
      if (out.length >= 3) return out.filter(Boolean);
    }
  }
  return out.filter(Boolean);
}

const PROJECT_ALIASES = {
  clara: [/\bclara\b/i],
  lalampe: [/lalampe/i, /la\s*lampe/i, /lampenkap/i, /\bfitting/i, /\bsnoer/i, /schakelaar/i, /stekker/i, /workshopflow/i, /testavond/i, /elektriciteit/i, /persoonlijke\s+lamp/i],
  begeister: [/begeister/i],
  'afk-landjuweel-amarte': [/\bafk\b/i, /landjuweel/i, /amarte/i],
  'clara-core-lab': [/clara\s*core\s*lab/i, /clara[-\s]?4[-\s]?core/i, /core\s*lab/i, /\bmarlon\b/i, /\bvercel\b/i, /\bpush\b/i, /\bmobiel\b/i]
};

const PROJECT_LABELS = {
  clara: 'Clara',
  lalampe: 'LaLampe',
  begeister: 'Begeister',
  'afk-landjuweel-amarte': 'AFK / Landjuweel / Amarte',
  'clara-core-lab': 'Clara Core Lab'
};

const PROJECT_PENCIL_DEFAULTS = {
  lalampe: {
    title: 'LaLampe — workshopflow uitschrijven',
    reason: 'Potloodvoorstel op basis van recente LaLampe-signalen; geen harde afspraak.',
    duration: 60,
    earliest: 14 * 60
  },
  clara: {
    title: 'Clara — eerstvolgende stap verhelderen',
    reason: 'Potloodvoorstel op basis van projectcontext; geen harde afspraak.',
    duration: 60,
    earliest: 10 * 60
  },
  begeister: {
    title: 'Begeister — open lijn scherp zetten',
    reason: 'Potloodvoorstel op basis van projectcontext; geen harde afspraak.',
    duration: 60,
    earliest: 10 * 60
  },
  'afk-landjuweel-amarte': {
    title: 'AFK / Landjuweel / Amarte — eerstvolgende stap',
    reason: 'Potloodvoorstel op basis van projectcontext; geen harde afspraak.',
    duration: 75,
    earliest: 10 * 60
  },
  'clara-core-lab': {
    title: 'Clara Core Lab — eerstvolgende stap',
    reason: 'Potloodvoorstel op basis van projectcontext; geen harde afspraak.',
    duration: 60,
    earliest: 10 * 60
  }
};

function openThreadKey(thread) {
  return [
    String(thread?.project || '').trim().toLowerCase(),
    String(thread?.title || '').trim().toLowerCase(),
    String(thread?.context || '').trim().toLowerCase()
  ].join('|');
}

function normalizeOpenThread(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null;
  const title = String(raw.title || raw.question || '').trim();
  const question = String(raw.question || raw.title || '').trim();
  const context = String(raw.context || '').trim();
  if (!title && !question && !context) return null;
  const status = String(raw.status || 'open').trim().toLowerCase();
  const project = raw.project == null ? null : String(raw.project || '').trim() || null;
  return {
    id: String(raw.id || `ot-${Date.now()}-${index}`),
    project,
    title: (title || question || context).slice(0, 160),
    question: (question || title || 'Wil je dit open houden, plannen of sluiten?').slice(0, 220),
    context: context.slice(0, 360),
    status: ['open', 'hanging', 'closed'].includes(status) ? status : 'open',
    source: String(raw.source || 'analysis').slice(0, 80),
    last_seen: String(raw.last_seen || new Date().toISOString()),
    importance: ['low', 'normal', 'high'].includes(String(raw.importance || '').toLowerCase()) ? String(raw.importance).toLowerCase() : 'normal',
    suggested_next_step: String(raw.suggested_next_step || '').trim().slice(0, 220)
  };
}

function mergeOpenThreads(existingRaw, incomingRaw) {
  const existing = (Array.isArray(existingRaw) ? existingRaw : [])
    .map((thread, index) => normalizeOpenThread(thread, index))
    .filter(Boolean);
  const incoming = (Array.isArray(incomingRaw) ? incomingRaw : [])
    .map((thread, index) => normalizeOpenThread(thread, index + existing.length))
    .filter(Boolean);
  const byKey = new Map();
  for (const thread of existing) {
    byKey.set(openThreadKey(thread), thread);
  }
  for (const thread of incoming) {
    const key = openThreadKey(thread);
    const prev = byKey.get(key);
    if (prev?.status === 'closed' && !thread.context) continue;
    byKey.set(key, {
      ...(prev || {}),
      ...thread,
      id: prev?.id || thread.id,
      status: prev?.status === 'closed' && thread.context ? 'open' : (thread.status || prev?.status || 'open'),
      last_seen: thread.last_seen || prev?.last_seen || new Date().toISOString()
    });
  }
  return [...byKey.values()].slice(0, 12);
}

function detectExplicitProjectMentions(text) {
  const s = String(text || '');
  const hits = [];
  for (const [project, patterns] of Object.entries(PROJECT_ALIASES)) {
    if (patterns.some((re) => re.test(s))) hits.push(project);
  }
  if (hits.includes('clara-core-lab')) {
    return hits.filter((project) => project !== 'clara');
  }
  return hits;
}

function isAllProjectsRequest(text) {
  const n = String(text || '').toLowerCase();
  return /alle\s+projecten|elk\s+project|per\s+project|lopende\s+projecten|projectbrain\s+breed|alles\s+uit\s+projectbrain/.test(n);
}

function getSingleExplicitProject(text) {
  if (isAllProjectsRequest(text)) return null;
  const hits = detectExplicitProjectMentions(text);
  return hits.length === 1 ? hits[0] : null;
}

function textMentionsProject(value, project) {
  const s = String(value || '');
  return (PROJECT_ALIASES[project] || []).some((re) => re.test(s));
}

function textMentionsOtherProject(value, project) {
  const s = String(value || '');
  return Object.keys(PROJECT_ALIASES)
    .filter((candidate) => candidate !== project)
    .some((candidate) => textMentionsProject(s, candidate));
}

function itemBelongsToProject(item, project) {
  if (!item || !project) return true;
  const declared = String(item.project || '').trim().toLowerCase();
  if (declared) return declared === project;
  const blob = [
    item.title,
    item.description,
    item.reason,
    item.source,
    item.text
  ].filter(Boolean).join(' ');
  if (textMentionsProject(blob, project)) return true;
  if (textMentionsOtherProject(blob, project)) return false;
  return true;
}

function itemBelongsStrictToAnyProject(item, projects) {
  const active = Array.isArray(projects) ? projects : [];
  if (!item || !active.length) return false;
  const declared = String(item.project || '').trim().toLowerCase();
  if (declared) return active.includes(declared);
  const blob = [
    item.title,
    item.description,
    item.reason,
    item.source,
    item.text
  ].filter(Boolean).join(' ');
  return active.some((project) => textMentionsProject(blob, project));
}

function filterTextListForProject(items, project) {
  if (!Array.isArray(items) || !project) return Array.isArray(items) ? items : [];
  return items.filter((item) => {
    if (textMentionsProject(item, project)) return true;
    return !textMentionsOtherProject(item, project);
  });
}

function filterTextListForProjectsStrict(items, projects) {
  const active = Array.isArray(projects) ? projects : [];
  if (!Array.isArray(items) || !active.length) return [];
  return items.filter((item) => active.some((project) => textMentionsProject(item, project)));
}

function filterDashboardAttentionForProjectsStrict(items, projects) {
  const active = Array.isArray(projects) ? projects : [];
  if (!Array.isArray(items) || !active.length) return [];
  return items.filter((item) => {
    const blob = typeof item === 'object'
      ? [item.text, item.title, item.project].filter(Boolean).join(' ')
      : String(item || '');
    return active.some((project) => textMentionsProject(blob, project));
  });
}

function filterTextForProject(value, project) {
  const s = String(value || '').replace(/\s+/g, ' ').trim();
  if (!s || !project) return s;
  if (!textMentionsOtherProject(s, project)) return s;
  const sentences = s
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => textMentionsProject(part, project) || !textMentionsOtherProject(part, project));
  return sentences.join(' ').trim();
}

function filterTextForProjects(value, projects) {
  const active = Array.isArray(projects) ? projects : [];
  const s = String(value || '').replace(/\s+/g, ' ').trim();
  if (!s || !active.length) return s;
  if (!active.some((project) => textMentionsProject(s, project))) return '';
  const otherMentioned = Object.keys(PROJECT_ALIASES)
    .filter((project) => !active.includes(project))
    .some((project) => textMentionsProject(s, project));
  if (!otherMentioned) return s;
  return s
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => active.some((project) => textMentionsProject(part, project)) ||
      !Object.keys(PROJECT_ALIASES).some((project) => !active.includes(project) && textMentionsProject(part, project)))
    .join(' ')
    .trim();
}

function claimsPencilPlanning(parsed) {
  const blob = [
    parsed?.summary,
    ...(parsed?.dashboard_output?.agenda || []),
    ...(parsed?.dashboard_output?.suggestions || [])
  ].filter(Boolean).join(' ');
  return /\b(potlood|potloodblok|ingepland|gepland|planning|agenda|werksessie|blok)\b/i.test(blob);
}

function wantsSingleProjectPencil(text) {
  return /\b(potlood|potloodblok|plan|planning|agenda|inplannen|werksessie)\b/i.test(String(text || ''));
}

function stripPlanningClaimsWithoutAgenda(parsed) {
  const hasAgenda = Array.isArray(parsed?.clara_agenda) && parsed.clara_agenda.length > 0;
  if (hasAgenda) return parsed;
  if (
    parsed?.summary &&
    /\b(conceptdag|potlood|potloodblok|ingepland|gepland|planning|agenda|werksessie|blok)\b/i.test(parsed.summary) &&
    !/\b(?:er staat\s+)?(?:nog\s+)?niets\s+gepland\b/i.test(parsed.summary)
  ) {
    parsed.summary = String(parsed.summary)
      .replace(/\b(Ik heb|Er staat|Ik zet|Ik plan)[^.?!]*(conceptdag|potlood|potloodblok|ingepland|gepland|planning|agenda|werksessie|blok)[^.?!]*[.?!]?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  if (parsed?.dashboard_output) {
    parsed.dashboard_output.suggestions = (parsed.dashboard_output.suggestions || [])
      .filter((item) => !/\b(Klopt deze planning|bevestig|potloodblok|ingepland|gepland)\b/i.test(String(item || '')));
    parsed.dashboard_output.agenda = [];
  }
  return parsed;
}

function openThreadConversationLine(parsed) {
  const thread = (Array.isArray(parsed?.open_threads) ? parsed.open_threads : [])
    .find((item) => item && item.status !== 'closed' && (item.question || item.title));
  const question = String(thread?.question || thread?.title || '').trim();
  if (!question) return '';
  const clean = question.replace(/\s+/g, ' ').replace(/[?!.]+$/, '');
  return `Open gesprek: ${clean}? Wil je dit nu bespreken, laten hangen, sluiten of later plannen?`;
}

function latestUserMessage(text) {
  const s = String(text || '');
  const marker = '\n\nNieuw bericht:\n';
  const ix = s.lastIndexOf(marker);
  return (ix >= 0 ? s.slice(ix + marker.length) : s).trim();
}

function isShortOpenThreadReply(message) {
  const m = String(message || '').trim().toLowerCase().replace(/[.!?]+$/g, '');
  if (!m || m.length > 80) return false;
  return /^(marketing|technisch|bestellen|uitzoeken|laat open|laat hangen|laten hangen|parkeer dit|later|hangt|plan maar|plan dit maar|plannen|sluiten|sluit maar|maandag|deze week|vanavond|plan dit vanavond nog|plan dit vanavond nog even)$/i.test(m);
}

function chooseOpenThreadForReply(openThreads, message) {
  const open = (Array.isArray(openThreads) ? openThreads : []).filter((item) => item && item.status !== 'closed');
  if (!open.length) return null;
  const m = String(message || '').toLowerCase();
  const scoreThread = (thread) => {
    const blob = [thread.title, thread.question, thread.context, thread.project].filter(Boolean).join(' ').toLowerCase();
    let score = 0;
    if (/marketing/.test(m) && /marketing|foto|video|promot|testavond/.test(blob)) score += 10;
    if (/technisch/.test(m) && /technisch|elektra|materiaal|testavond/.test(blob)) score += 10;
    if (/lalampe/.test(blob)) score += 2;
    if (/testavond/.test(blob)) score += 2;
    return score;
  };
  return [...open].sort((a, b) => scoreThread(b) - scoreThread(a))[0];
}

function hasAgendaForTitle(agenda, title) {
  const wanted = String(title || '').trim().toLowerCase();
  return (Array.isArray(agenda) ? agenda : []).some((item) => String(item?.title || '').trim().toLowerCase() === wanted);
}

function placePencilBlock(parsed, block, nowInfo, text) {
  parsed.clara_agenda = Array.isArray(parsed.clara_agenda) ? parsed.clara_agenda : [];
  if (hasAgendaForTitle(parsed.clara_agenda, block.title)) return parsed;
  let duration = block.estimated_duration_minutes || 60;
  const allowOutside = allowsOutOfPolicyPlanning(text);
  const plan = allowOutside
    ? getNextPlanningStart(nowInfo, text, duration)
    : getNextValidWorkStart(nowInfo, { duration, agenda: parsed.clara_agenda });
  if (allowOutside && plan.start + duration > 24 * 60 - 1) {
    duration = Math.max(15, 24 * 60 - 1 - plan.start);
  }
  parsed.clara_agenda.push({
    title: block.title,
    kind: 'planned_task',
    date: plan.date,
    start_time: minToTime(plan.start),
    end_time: minToTime(plan.end ?? plan.start + duration),
    estimated_duration_minutes: duration,
    status: 'pencil',
    project: block.project || null,
    source: block.source || 'open_thread_reply',
    reason: `${block.reason || 'Potloodvoorstel op basis van open item.'} ${plan.reason || 'Verplaatst naar eerstvolgende werkmoment; oorspronkelijke voorstel viel buiten normale werktijd.'}`,
    confirmation_required: true,
    confidence: block.confidence || 0.72
  });
  return parsed;
}

function enforceWorkdayPlanningPolicy(parsed, nowInfo, text) {
  if (!parsed || !Array.isArray(parsed.clara_agenda)) return parsed;
  const intentText = latestUserMessage(text);
  const allowOutside = allowsOutOfPolicyPlanning(intentText);
  let moved = false;
  parsed.clara_agenda = parsed.clara_agenda.map((item, index) => {
    if (!item) return item;
    if (itemIsHardAndExplicit(item) && allowOutside) {
      const out = { ...item };
      const start = timeToMin(out.start_time);
      const duration = Math.max(15, Number(out.estimated_duration_minutes || 60));
      if (start != null && !out.end_time) out.end_time = minToTime(start + duration);
      if (!out.estimated_duration_minutes) out.estimated_duration_minutes = duration;
      return out;
    }
    const out = { ...item };
    const duration = Math.max(15, Number(out.estimated_duration_minutes || 60));
    const date = out.date || nowInfo?.date;
    const start = timeToMin(out.start_time);
    if (allowOutside && !itemIsHardAndExplicit(out) && (out.status === 'needs_time' || start == null)) {
      const plan = getNextPlanningStart(nowInfo, intentText, Math.min(duration, 45));
      const end = plan.end ?? Math.min(24 * 60 - 1, plan.start + Math.min(duration, 45));
      out.date = plan.date;
      out.start_time = minToTime(plan.start);
      out.end_time = minToTime(end);
      out.estimated_duration_minutes = Math.max(15, end - plan.start);
      out.status = 'pencil';
      out.confirmation_required = true;
      return out;
    }
    let mustMove = false;
    const win = workWindowForDate(date);

    if (date && nowInfo?.date && date < nowInfo.date) mustMove = true;
    if (!win && !allowOutside) mustMove = true;
    if (date === nowInfo?.date && start != null && start < nowInfo.minutes) mustMove = true;
    if (date === nowInfo?.date && nowInfo.minutes >= 18 * 60 && !allowOutside) mustMove = true;
    if (date === nowInfo?.date && nowInfo.minutes >= 20 * 60 && !allowOutside) mustMove = true;
    if (win && start != null && (start < win.start || start + duration > win.end) && !allowOutside) mustMove = true;
    if (!mustMove) return out;

    const plan = getNextValidWorkStart(nowInfo, {
      duration,
      agenda: parsed.clara_agenda,
      excludeIndex: index,
      fromDate: date && date > nowInfo.date ? date : nowInfo.date
    });
    moved = true;
    out.date = plan.date;
    out.start_time = minToTime(plan.start);
    out.end_time = minToTime(plan.end ?? plan.start + duration);
    out.estimated_duration_minutes = duration;
    out.status = 'pencil';
    out.confirmation_required = true;
    out.reason = `${out.reason || 'Potloodvoorstel.'} Verplaatst naar eerstvolgende werkmoment; oorspronkelijke voorstel viel buiten normale werktijd.`;
    return out;
  });
  if (moved && !/eerstvolgende werkmoment|niet meer op zondagavond|buiten normale werktijd/i.test(String(parsed.summary || ''))) {
    parsed.summary = `${String(parsed.summary || '').trim()} Ik plan dit niet buiten normale werktijd; ik zet het op het eerstvolgende werkmoment.`.trim();
  }
  return parsed;
}

const enforceTimeAwarePlanning = enforceWorkdayPlanningPolicy;

function clearPastDayReviewTime(parsed, nowInfo) {
  const st = timeToMin(parsed?.day_review?.suggested_time);
  if (st != null && nowInfo?.minutes != null && st <= nowInfo.minutes) {
    parsed.day_review.suggested_time = null;
  }
  return parsed;
}

function ensureExplicitWeekendAppointment(parsed, text, nowInfo) {
  const s = String(text || '');
  const msg = latestUserMessage(s);
  const m = msg.match(/\b(zaterdag|zondag)\b[\s\S]{0,120}?\bom\s+(\d{1,2})(?::|\.?)(\d{2})?\b/i);
  if (!m) return parsed;
  const dow = m[1].toLowerCase() === 'zaterdag' ? 6 : 0;
  const date = nextDateForWeekday(nowInfo.date, dow);
  const hour = Number(m[2]);
  const minute = Number(m[3] || 0);
  const start = hour * 60 + minute;
  const duration = 60;
  const project = getSingleExplicitProject(msg) || detectExplicitProjectMentions(msg)[0] || null;
  const titleProject = project ? (PROJECT_LABELS[project] || project) : 'Werk';
  const title = /harde\s+klus/i.test(msg) ? `Harde klus voor ${titleProject}` : `${titleProject} afspraak`;
  parsed.clara_agenda = Array.isArray(parsed.clara_agenda) ? parsed.clara_agenda : [];
  parsed.clara_agenda = parsed.clara_agenda.filter((item) => {
    if (!item || item.date === date) return true;
    const blob = `${item.title || ''} ${item.project || ''}`.toLowerCase();
    return !(item.kind === 'appointment' && project && textMentionsProject(blob, project));
  });
  if (!parsed.clara_agenda.some((item) => item.date === date && item.start_time === minToTime(start) && /harde klus|afspraak/i.test(item.title || ''))) {
    parsed.clara_agenda.push({
      title,
      kind: 'appointment',
      date,
      start_time: minToTime(start),
      end_time: minToTime(start + duration),
      estimated_duration_minutes: duration,
      status: 'confirmed',
      project,
      source: 'explicit_user_weekend_time',
      reason: 'Jeroen gaf expliciet een weekendmoment met tijd; daarom wel toegestaan.',
      confirmation_required: false,
      confidence: 0.86
    });
  }
  parsed.summary = `Genoteerd: ${title} op ${date} om ${minToTime(start)}. Omdat je zaterdag expliciet met tijd noemt, mag dit wel in het weekend staan.`;
  return parsed;
}

function applyOpenThreadReply(parsed, labStateRaw, text, nowInfo) {
  const message = latestUserMessage(text);
  if (!isShortOpenThreadReply(message)) return parsed;
  const thread = chooseOpenThreadForReply(labStateRaw?.open_threads, message);
  if (!thread) return parsed;

  parsed.open_threads = mergeOpenThreads(labStateRaw?.open_threads, parsed.open_threads);
  const reply = message.toLowerCase();
  const targetId = thread.id;
  const project = thread.project || 'lalampe';
  const label = PROJECT_LABELS[project] || project;

  parsed.dashboard_output = parsed.dashboard_output || { today: [], attention: [], waiting_for: [], agenda: [], project_signals: [], suggestions: [] };
  parsed.dashboard_output.attention = Array.isArray(parsed.dashboard_output.attention) ? parsed.dashboard_output.attention : [];
  parsed.dashboard_output.agenda = [];
  parsed.dashboard_output.suggestions = [];
  parsed.proposed_items = Array.isArray(parsed.proposed_items) ? parsed.proposed_items : [];

  if (/sluiten|sluit maar/.test(reply)) {
    parsed.open_threads = parsed.open_threads.map((item) => item.id === targetId ? { ...item, status: 'closed', context: `${item.context || ''}\nAfgesloten door Jeroen.`.trim() } : item);
    parsed.clara_agenda = [];
    parsed.summary = `Helder. Ik sluit dit open item voor nu; er staat niets gepland.`;
    return parsed;
  }

  if (/laat open|laat hangen|laten hangen|parkeer dit|later|hangt/.test(reply)) {
    parsed.open_threads = parsed.open_threads.map((item) => item.id === targetId ? { ...item, status: 'hanging', context: `${item.context || ''}\nJeroen wil dit voorlopig laten hangen.`.trim() } : item);
    parsed.clara_agenda = [];
    parsed.summary = `Prima, ik laat dit open item hangen en maak er geen planning van.`;
    return parsed;
  }

  let decision = '';
  let blockTitle = '';
  let reason = '';
  if (/marketing/.test(reply)) {
    decision = 'Richting gekozen: de eerste LaLampe-testavond krijgt ook een marketingdoel.';
    blockTitle = 'Marketingdoel eerste LaLampe-testavond uitwerken';
    reason = 'Jeroen gaf aan dat de eerste testavond ook marketingdoel heeft.';
  } else if (/technisch/.test(reply)) {
    decision = 'Richting gekozen: de eerste LaLampe-testavond is primair technisch.';
    blockTitle = 'Technische testopzet eerste LaLampe-testavond uitwerken';
    reason = 'Jeroen gaf aan dat de eerste testavond vooral technisch bedoeld is.';
  } else {
    const threadBlob = [thread.title, thread.question, thread.context].filter(Boolean).join(' ').toLowerCase();
    decision = `Richting door Jeroen: ${message}.`;
    if (project === 'lalampe' && /marketing|foto|video|testavond/.test(threadBlob)) {
      blockTitle = 'Marketingdoel eerste LaLampe-testavond uitwerken';
      reason = 'Jeroen vroeg om dit open item als concrete vervolgstap op te pakken.';
    } else {
      blockTitle = project === 'lalampe' ? 'LaLampe open item omzetten naar vervolgstap' : `${label} open item omzetten naar vervolgstap`;
      reason = 'Jeroen gaf richting op een open item.';
    }
  }

  parsed.open_threads = parsed.open_threads.map((item) => item.id === targetId ? {
    ...item,
    status: /marketing|technisch/.test(reply) ? 'closed' : 'hanging',
    context: `${item.context || ''}\n${decision}`.trim(),
    question: 'Welke observatiepunten of vervolgstap wil je hieruit halen?',
    suggested_next_step: blockTitle,
    last_seen: nowInfo?.date || item.last_seen
  } : item);

  parsed.dashboard_output.attention = [{
    text: `[Keuze gemaakt] ${decision.replace(/^Richting gekozen:\s*/i, '')}`,
    kind: 'keuze'
  }];
  parsed.proposed_items = [];
  parsed.proposed_items.push({
    title: blockTitle,
    type: 'task',
    project,
    status: 'proposed',
    date: null,
    time: null,
    description: reason,
    source: 'open_thread_reply',
    confidence: 0.74
  });
  parsed.clara_agenda = (Array.isArray(parsed.clara_agenda) ? parsed.clara_agenda : []).filter(itemIsHardAndExplicit);
  parsed = placePencilBlock(parsed, {
    title: blockTitle,
    project,
    estimated_duration_minutes: /vanavond/.test(reply) ? 45 : 60,
    reason,
    source: 'open_thread_reply',
    confidence: 0.74
  }, nowInfo, message);

  const item = parsed.clara_agenda.find((agendaItem) => agendaItem.title === blockTitle);
  const when = item ? `${item.date} ${item.start_time}` : 'als potloodvoorstel';
  parsed.summary = /marketing/.test(reply)
    ? `Helder. Dan is dit open item beantwoord: de testavond krijgt ook een marketingdoel. Ik zet een potloodblok klaar om het marketingdoel en de observatiepunten uit te werken (${when}).`
    : `Helder. Ik werk dit open item om naar een concrete vervolgstap en zet die als potloodblok klaar (${when}).`;
  if (item && item.date !== nowInfo?.date) {
    parsed.summary += ` Vandaag plan ik niets meer terug in de tijd.`;
  }
  return parsed;
}

function enforceNoPlanningOutput(parsed, options = {}) {
  if (!parsed) return parsed;
  parsed.clara_agenda = [];
  parsed.scheduling_needs = [];
  parsed.proposed_items = (Array.isArray(parsed.proposed_items) ? parsed.proposed_items : [])
    .filter((item) => item?.type === 'attention');
  parsed.open_threads = (Array.isArray(parsed.open_threads) ? parsed.open_threads : [])
    .filter((item) => item && item.status !== 'closed')
    .slice(0, 3);
  if (!parsed.open_threads.length) {
    parsed.open_threads = buildRawFallbackOpenThreads(
      options.projectbrainContext,
      options.meaningfulRawProjects,
      options.today
    );
  }

  parsed.dashboard_output = parsed.dashboard_output || {
    today: [],
    attention: [],
    waiting_for: [],
    agenda: [],
    project_signals: [],
    suggestions: []
  };
  parsed.dashboard_output.today = [];
  parsed.dashboard_output.waiting_for = [];
  parsed.dashboard_output.agenda = [];
  parsed.dashboard_output.project_signals = [];
  parsed.dashboard_output.suggestions = [];
  parsed.dashboard_output.attention = (parsed.dashboard_output.attention || [])
    .filter((item) => {
      const value = typeof item === 'string' ? item : item?.text;
      return !/\b(gepland|inplannen|agenda|potloodblok|check rond|einde dag)\b/i.test(String(value || ''));
    })
    .slice(0, 2);

  const line = openThreadConversationLine(parsed);
  parsed.day_review = {
    review_needed: false,
    suggested_time: null,
    items_to_check: [],
    rollover_candidates: [],
    review_prompt: '',
    now_first_move: line.slice(0, 320)
  };

  if (parsed.summary && /\b(conceptdag|potlood|potloodblok|ingepland|gepland|planning|agenda|check rond|17:30|18:00)\b/i.test(parsed.summary)) {
    parsed.summary = '';
  }
  if (parsed.open_threads.length && /\bgeen\s+(open\s+)?(eindjes|items|punten)\b/i.test(String(parsed.summary || ''))) {
    parsed.summary = '';
  }
  if (!String(parsed.summary || '').trim()) {
    if (parsed.open_threads.length) {
      const first = parsed.open_threads[0];
      const project = first.project ? ` rond ${PROJECT_LABELS[first.project] || first.project}` : '';
      const question = String(first.question || first.title || 'wil je dit open laten, afsluiten of plannen?').trim();
      const rest = parsed.open_threads.length - 1;
      const more = rest > 1 ? ` Er zijn nog ${rest} andere open items, maar laten we klein beginnen.` : rest === 1 ? ' Er is nog 1 ander open item, maar laten we klein beginnen.' : '';
      parsed.summary = `Er hangt nog één open item${project}: ${question} Wil je dit open laten, afsluiten of plannen?${more}`;
    } else {
      parsed.summary = 'Ik pak dit als gesprek, niet als planning. Er staat nog niets gepland.';
    }
  } else if (parsed.open_threads.length && !/niets\s+gepland|nog\s+niets\s+gepland/i.test(parsed.summary)) {
    parsed.summary = `${String(parsed.summary).replace(/\s+/g, ' ').trim()} Er staat nog niets gepland.`;
  }
  return stripPlanningClaimsWithoutAgenda(parsed);
}

function createSingleProjectPencilBlock(project, date, agenda = []) {
  const defaults = PROJECT_PENCIL_DEFAULTS[project] || PROJECT_PENCIL_DEFAULTS.clara;
  const occupied = buildDayOccupancy((Array.isArray(agenda) ? agenda : []).filter((item) => item?.date === date && item.start_time));
  const duration = defaults.duration || 60;
  const slot = findFreeSlot(occupied, duration, defaults.earliest || 10 * 60, 19 * 60) ||
    findFreeSlot(occupied, duration, 10 * 60, 23 * 60);
  if (!slot) return null;
  return {
    title: defaults.title,
    kind: 'focus_block',
    date,
    start_time: minToTime(slot.start),
    end_time: minToTime(slot.end),
    estimated_duration_minutes: duration,
    status: 'pencil',
    project,
    source: 'projectbrain_raw_single_project',
    reason: defaults.reason,
    confirmation_required: true,
    confidence: 0.55
  };
}

function ensureSingleProjectPlanningConsistency(parsed, project, text, today) {
  if (!parsed || !project) return parsed;
  parsed.clara_agenda = Array.isArray(parsed.clara_agenda) ? parsed.clara_agenda : [];
  const hasProjectAgenda = parsed.clara_agenda.some((item) => itemBelongsToProject(item, project));
  const shouldCreatePencil = !hasProjectAgenda && (wantsSingleProjectPencil(text) || claimsPencilPlanning(parsed));

  if (shouldCreatePencil) {
    const block = createSingleProjectPencilBlock(project, today, parsed.clara_agenda);
    if (block) {
      parsed.clara_agenda.push(block);
      parsed.dashboard_output = parsed.dashboard_output || { today: [], attention: [], waiting_for: [], agenda: [], project_signals: [], suggestions: [] };
      parsed.dashboard_output.agenda = [`${PROJECT_LABELS[project] || project}: ${block.title}`];
      parsed.dashboard_output.suggestions = [`Klopt dit potloodblok voor ${PROJECT_LABELS[project] || project}?`];
      parsed.day_review = parsed.day_review || {};
      parsed.day_review.review_needed = true;
      if (!parsed.day_review.now_first_move) parsed.day_review.now_first_move = `${PROJECT_LABELS[project] || project}: begin met ${block.title.toLowerCase()}.`;
    }
  }

  return stripPlanningClaimsWithoutAgenda(parsed);
}

function enforceStartupRawProjectsOutput(parsed, projects) {
  const active = Array.isArray(projects) ? projects : [];
  if (!parsed || !active.length) {
    if (parsed) {
      parsed.clara_agenda = [];
      parsed.proposed_items = [];
      parsed.scheduling_needs = [];
      parsed.open_threads = [];
      if (parsed.dashboard_output) {
        parsed.dashboard_output.attention = [];
        parsed.dashboard_output.project_signals = [];
        parsed.dashboard_output.agenda = [];
        parsed.dashboard_output.suggestions = [];
      }
      if (parsed.day_review) {
        parsed.day_review.items_to_check = [];
        parsed.day_review.rollover_candidates = [];
        parsed.day_review.now_first_move = '';
      }
    }
    return parsed;
  }

  parsed.clara_agenda = (Array.isArray(parsed.clara_agenda) ? parsed.clara_agenda : [])
    .filter((item) => itemBelongsStrictToAnyProject(item, active));
  parsed.proposed_items = (Array.isArray(parsed.proposed_items) ? parsed.proposed_items : [])
    .filter((item) => itemBelongsStrictToAnyProject(item, active));
  parsed.scheduling_needs = (Array.isArray(parsed.scheduling_needs) ? parsed.scheduling_needs : [])
    .filter((item) => itemBelongsStrictToAnyProject(item, active));
  parsed.open_threads = (Array.isArray(parsed.open_threads) ? parsed.open_threads : [])
    .filter((item) => itemBelongsStrictToAnyProject(item, active))
    .slice(0, Math.max(1, active.length));
  parsed.signals = (Array.isArray(parsed.signals) ? parsed.signals : [])
    .filter((item) => itemBelongsStrictToAnyProject(item, active));

  if (parsed.dashboard_output) {
    parsed.dashboard_output.attention = filterDashboardAttentionForProjectsStrict(parsed.dashboard_output.attention, active)
      .slice(0, active.length * 2);
    parsed.dashboard_output.today = filterTextListForProjectsStrict(parsed.dashboard_output.today, active);
    parsed.dashboard_output.waiting_for = filterTextListForProjectsStrict(parsed.dashboard_output.waiting_for, active);
    parsed.dashboard_output.agenda = filterTextListForProjectsStrict(parsed.dashboard_output.agenda, active);
    parsed.dashboard_output.project_signals = filterTextListForProjectsStrict(parsed.dashboard_output.project_signals, active);
    parsed.dashboard_output.suggestions = filterTextListForProjectsStrict(parsed.dashboard_output.suggestions, active);
  }

  parsed.uncertainties = filterTextListForProjectsStrict(parsed.uncertainties, active);
  parsed.questions = filterTextListForProjectsStrict(parsed.questions, active);

  if (parsed.day_review) {
    parsed.day_review.items_to_check = filterTextListForProjectsStrict(parsed.day_review.items_to_check, active).slice(0, 2);
    parsed.day_review.rollover_candidates = filterTextListForProjectsStrict(parsed.day_review.rollover_candidates, active);
    parsed.day_review.now_first_move = filterTextForProjects(parsed.day_review.now_first_move, active);
    parsed.day_review.review_prompt = filterTextForProjects(parsed.day_review.review_prompt, active);
  }
  parsed.summary = filterTextForProjects(parsed.summary, active);
  return parsed;
}

function ensureRawStartupPencilAgenda(result, rawProjects, today) {
  const active = Array.isArray(rawProjects) ? rawProjects : [];
  if (!result || !active.length) return result;
  result.clara_agenda = Array.isArray(result.clara_agenda) ? result.clara_agenda : [];
  for (const project of active) {
    const hasProjectBlock = result.clara_agenda.some((item) => itemBelongsToProject(item, project));
    if (hasProjectBlock) continue;
    const block = createSingleProjectPencilBlock(project, today, result.clara_agenda);
    if (block) result.clara_agenda.push(block);
  }
  return result;
}

function enforceSingleProjectOutput(parsed, project) {
  if (!parsed || !project) return parsed;

  parsed.clara_agenda = (Array.isArray(parsed.clara_agenda) ? parsed.clara_agenda : [])
    .filter((item) => itemBelongsToProject(item, project));

  parsed.proposed_items = (Array.isArray(parsed.proposed_items) ? parsed.proposed_items : [])
    .filter((item) => itemBelongsToProject(item, project));

  parsed.scheduling_needs = (Array.isArray(parsed.scheduling_needs) ? parsed.scheduling_needs : [])
    .filter((item) => itemBelongsToProject(item, project));
  parsed.open_threads = (Array.isArray(parsed.open_threads) ? parsed.open_threads : [])
    .filter((item) => itemBelongsToProject(item, project));

  parsed.signals = (Array.isArray(parsed.signals) ? parsed.signals : [])
    .filter((item) => itemBelongsToProject(item, project));

  if (parsed.dashboard_output) {
    parsed.dashboard_output.attention = (Array.isArray(parsed.dashboard_output.attention) ? parsed.dashboard_output.attention : [])
      .filter((item) => itemBelongsToProject(item, project));
    parsed.dashboard_output.today = filterTextListForProject(parsed.dashboard_output.today, project);
    parsed.dashboard_output.waiting_for = filterTextListForProject(parsed.dashboard_output.waiting_for, project);
    parsed.dashboard_output.agenda = filterTextListForProject(parsed.dashboard_output.agenda, project);
    parsed.dashboard_output.project_signals = filterTextListForProject(parsed.dashboard_output.project_signals, project);
    parsed.dashboard_output.suggestions = filterTextListForProject(parsed.dashboard_output.suggestions, project);
  }

  parsed.uncertainties = filterTextListForProject(parsed.uncertainties, project);
  parsed.questions = filterTextListForProject(parsed.questions, project);
  parsed.ignored_noise = filterTextListForProject(parsed.ignored_noise, project);
  parsed.summary = filterTextForProject(parsed.summary, project) ||
    `Ik kijk alleen naar ${PROJECT_LABELS[project] || project}.`;

  if (parsed.day_review) {
    parsed.day_review.items_to_check = filterTextListForProject(parsed.day_review.items_to_check, project).slice(0, 2);
    parsed.day_review.rollover_candidates = filterTextListForProject(parsed.day_review.rollover_candidates, project);
    for (const field of ['review_prompt', 'now_first_move']) {
      const value = String(parsed.day_review[field] || '').trim();
      parsed.day_review[field] = filterTextForProject(value, project);
    }
  }

  return parsed;
}

function detectExplicitMultiProjectPlanningRequest(text, requestedDays) {
  if (!Array.isArray(requestedDays) || requestedDays.length < 2) return false;
  const n = String(text || '').toLowerCase();
  if (!/planning|plannen|\bplan\b|agenda|realistische\s+planning|ingedeeld|indelen/.test(n)) return false;
  const mentionsClara = /\bclara\b/.test(n);
  const mentionsLampe = /lalampe|la\s*lampe/.test(n);
  const mentionsBegeister = /begeister/.test(n);
  const mentionsAfk = /\bafk\b|landjuweel|amarte/.test(n);
  const hits = [mentionsClara, mentionsLampe, mentionsBegeister, mentionsAfk].filter(Boolean).length;
  return hits >= 2;
}

function detectProjectbrainPlanningRequest(text, requestedDays) {
  if (!Array.isArray(requestedDays) || requestedDays.length < 2) return false;
  const n = String(text || '').toLowerCase();
  const brain = /projectbrain|lopende\s+projecten|uit\s+de\s+projecten|\bprojecten\b.*\b(projectbrain|brein)/i.test(n);
  const plan = /planning|plannen|realistisch|eerstvolgende|agenda|aandacht|dagregie|needs_time|niet\s+overlap/i.test(n);
  return brain && plan;
}

const ATTENTION_KINDS = new Set(['risico', 'keuze', 'check', 'wacht', 'past_niet', 'project']);

function isGenericAttentionText(s) {
  const t = String(s || '')
    .toLowerCase()
    .trim();
  if (t.length < 10) return false;
  const bans = [
    /projectbrain.*(aandacht|bewaren|opnemen)/,
    /bewaar.*(keuzes|risico).*projectbrain/,
    /geen\s+overlap/,
    /plan\s+geen\s+overlap/,
    /voorkom.*overlap/,
    /verkorten\s+van\s+taken/,
    /taken\s+niet\s+verkorten/,
    /niet\s+.*verkorten/,
    /geen\s+projectbrain[-\s]?dump/,
    /geen\s+dump/,
    /maak\s+geen\s+dump/,
    /projectbrain\s+als\s+context/,
    /gebruik\s+projectbrain\s+als/,
    /context\s+uit\s+projectbrain/,
    /^twijfel:\s*projectbrain\s+is\s+beperkt/,
    /potloodblokken\s+zijn\s+geen\s+harde/,
    /controleer\s+per\s+project\s+of\s+de\s+duur/i,
    /schuif\s+desnoods\s+in\s+de\s+ui/i,
    /bewaar\s+.*\s+in\s+de\s+aandacht/i,
    /risico.*s\s+en\s+keuzes.*vanuit\s+projectbrain/i
  ];
  return bans.some((re) => re.test(t));
}

function normalizeAttentionEntry(entry, index) {
  if (entry == null) return null;
  if (typeof entry === 'string') {
    const s = entry.trim();
    if (!s) return null;
    const m = s.match(/^(risico|keuze|check|wacht|past\s+niet|project)\s*[—\-:]\s*(.+)$/i);
    if (m) {
      let kind = m[1].toLowerCase().replace(/\s+/g, '_');
      if (kind === 'past_niet' || m[1].toLowerCase().replace(/\s+/g, '') === 'pastniet') kind = 'past_niet';
      if (!ATTENTION_KINDS.has(kind)) kind = 'check';
      return { text: m[2].trim(), kind };
    }
    return { text: s, kind: 'check' };
  }
  if (typeof entry === 'object' && entry.text) {
    const k = String(entry.kind || 'check').toLowerCase();
    const kind = ATTENTION_KINDS.has(k) ? k : 'check';
    return { text: String(entry.text).trim().slice(0, 220), kind };
  }
  return null;
}

function normalizeDashboardAttention(parsed) {
  if (!parsed?.dashboard_output) return parsed;
  const arr = Array.isArray(parsed.dashboard_output.attention) ? parsed.dashboard_output.attention : [];
  const out = [];
  const seen = new Set();
  for (let i = 0; i < arr.length; i++) {
    const n = normalizeAttentionEntry(arr[i], i);
    if (!n || !n.text) continue;
    if (isGenericAttentionText(n.text)) continue;
    const key = n.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
    if (out.length >= 5) break;
  }
  parsed.dashboard_output.attention = out;
  return parsed;
}

function projectbrainContextUsable(projectbrainContext) {
  const s = String(projectbrainContext || '');
  if (s.includes('GitHub token ontbreekt')) return false;
  if (s.includes('PROJECTBRAIN_REPO is ongeldig')) return false;
  if (s.trim().length < 120) return false;
  return true;
}

function countTimedAgendaBlocksInDays(agenda, requestedDays) {
  if (!Array.isArray(agenda) || !Array.isArray(requestedDays)) return 0;
  return agenda.filter((item) => {
    if (!item?.date || !requestedDays.includes(item.date)) return false;
    if (!item.start_time || !/^\d{1,2}:[0-5]\d$/.test(String(item.start_time))) return false;
    return item.status !== 'needs_time';
  }).length;
}

function ensurePencilMultiProjectAgenda(result, requestedDays) {
  if (!Array.isArray(requestedDays) || requestedDays.length === 0) return result;
  const agenda = Array.isArray(result.clara_agenda) ? [...result.clara_agenda] : [];
  if (countTimedAgendaBlocksInDays(agenda, requestedDays) > 0) return result;

  const d = (i) => requestedDays[Math.min(i, requestedDays.length - 1)];

  let blocks;
  if (requestedDays.length === 2) {
    blocks = [
      { title: 'Potlood: werksessie Clara (kern & lab)', date: d(0), start_time: '10:00', end_time: '11:00', estimated_duration_minutes: 60, kind: 'focus_block', status: 'pencil', project: 'clara', source: 'projectbrain_multi_project_plan', reason: 'Voorstel op basis van projectcontext; geen harde afspraak.', confirmation_required: true, confidence: 0.4 },
      { title: 'Potlood: werksessie LaLampe', date: d(0), start_time: '14:00', end_time: '15:15', estimated_duration_minutes: 75, kind: 'focus_block', status: 'pencil', project: 'lalampe', source: 'projectbrain_multi_project_plan', reason: 'Voorstel workshop/sporen; bevestigen voor inhoud.', confirmation_required: true, confidence: 0.4 },
      { title: 'Potlood: werksessie Begeister', date: d(1), start_time: '10:00', end_time: '11:00', estimated_duration_minutes: 60, kind: 'focus_block', status: 'pencil', project: 'begeister', source: 'projectbrain_multi_project_plan', reason: 'Voorstel rollen en afspraken scherp zetten.', confirmation_required: true, confidence: 0.4 },
      { title: 'Potlood: werksessie AFK / Landjuweel / Amarte', date: d(1), start_time: '13:30', end_time: '15:00', estimated_duration_minutes: 90, kind: 'focus_block', status: 'pencil', project: 'afk-landjuweel-amarte', source: 'projectbrain_multi_project_plan', reason: 'Voorstel inhoud/aanvraag verkennen; geen echte deadline.', confirmation_required: true, confidence: 0.4 }
    ];
  } else {
    blocks = [
      { title: 'Potlood: werksessie Clara (kern & lab)', date: d(0), start_time: '10:00', end_time: '11:00', estimated_duration_minutes: 60, kind: 'focus_block', status: 'pencil', project: 'clara', source: 'projectbrain_multi_project_plan', reason: 'Voorstel op basis van projectcontext; geen harde afspraak.', confirmation_required: true, confidence: 0.4 },
      { title: 'Potlood: werksessie LaLampe', date: d(0), start_time: '14:00', end_time: '15:15', estimated_duration_minutes: 75, kind: 'focus_block', status: 'pencil', project: 'lalampe', source: 'projectbrain_multi_project_plan', reason: 'Voorstel workshop/sporen; bevestigen voor inhoud.', confirmation_required: true, confidence: 0.4 },
      { title: 'Potlood: werksessie Begeister', date: d(1), start_time: '10:30', end_time: '11:30', estimated_duration_minutes: 60, kind: 'focus_block', status: 'pencil', project: 'begeister', source: 'projectbrain_multi_project_plan', reason: 'Voorstel rollen en afspraken scherp zetten.', confirmation_required: true, confidence: 0.4 },
      { title: 'Potlood: werksessie AFK / Landjuweel / Amarte', date: d(2), start_time: '10:00', end_time: '11:30', estimated_duration_minutes: 90, kind: 'focus_block', status: 'pencil', project: 'afk-landjuweel-amarte', source: 'projectbrain_multi_project_plan', reason: 'Voorstel inhoud/aanvraag verkennen; geen echte deadline.', confirmation_required: true, confidence: 0.4 }
    ];
  }

  result.clara_agenda = [...agenda, ...blocks];
  result.dashboard_output = result.dashboard_output || { today: [], attention: [], waiting_for: [], agenda: [], project_signals: [], suggestions: [] };
  const att = Array.isArray(result.dashboard_output.attention) ? result.dashboard_output.attention : [];
  const unc = Array.isArray(result.uncertainties) ? result.uncertainties : [];
  const uncObjs = unc.map((u) => normalizeAttentionEntry(u, 0)).filter((x) => x && !isGenericAttentionText(x.text));
  const merged = [...att.map((x) => normalizeAttentionEntry(x, 0)).filter((x) => x && !isGenericAttentionText(x.text)), ...uncObjs];
  const seen = new Set();
  result.dashboard_output.attention = merged.filter((x) => {
    const k = x.text.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 5);
  if (!String(result.summary || '').trim()) {
    result.summary = 'Ik zet voorzichtige potloodblokken klaar over de gevraagde dagen op basis van je projectnamen en Projectbrain; geen harde afspraken toegevoegd.';
  } else if (!/potlood|voorzichtig|voorstel/i.test(result.summary)) {
    result.summary = `${result.summary.trim()} Daarnaast staan er potlood-werksessies in de agenda (bevestigen of schuiven).`;
  }
  result.day_review = result.day_review || {};
  result.day_review.review_needed = true;
  if (!result.day_review.suggested_time) result.day_review.suggested_time = '17:30';
  if (!result.day_review.review_prompt) result.day_review.review_prompt = 'Wil je de potloodblokken behouden of verschuiven?';
  result.day_review.items_to_check = Array.isArray(result.day_review.items_to_check) ? result.day_review.items_to_check : [];
  result.day_review.rollover_candidates = Array.isArray(result.day_review.rollover_candidates) ? result.day_review.rollover_candidates : [];
  if (!String(result.day_review.now_first_move || '').trim()) {
    result.day_review.now_first_move = '';
  }
  return result;
}

function inferUserIntentHints(text) {
  const n = String(text || '').toLowerCase();
  const noPlanning =
    /\b(?:even\s+)?niet\s+plannen\b/i.test(n) ||
    /\bgeen\s+agenda\b/i.test(n) ||
    /\balleen\s+bespreken\b/i.test(n) ||
    /\bwelke\s+open\s+(?:items|dingen)\b/i.test(n) ||
    /\bwat\s+(?:staat|hangt)\s+er\s+nog\s+open\b/i.test(n) ||
    /\bwat\s+hangt\s+er\s+nog\b/i.test(n) ||
    /\bik\s+wil\s+(?:even\s+)?kijken\s+wat\s+er\s+nog\s+open\s+staat\b/i.test(n) ||
    /\blaat\s+open\b|\bparkeer dit\b|\blater\b/i.test(n);
  const wantsExplicitTimedPlanning =
    !noPlanning &&
    (/planning\s+voor|komende\s+\d+|volgende\s+\d+|realistische\s+planning|\bplan\s+(?:vandaag|morgen|deze)/i.test(n) ||
      /maak\s+(?:een\s+)?(?:realistische\s+)?planning/i.test(n) ||
      /\d+\s+dagen.*(?:clara|lalampe|begeister|afk|landjuweel)/i.test(text) ||
      (/\bplan\b/i.test(n) && /omheen|rond|zonder\s+overlap|tussen|daarom|ruimte\s+over/i.test(n)) ||
      (/projectbrain|lopende\s+projecten|uit\s+de\s+projecten/i.test(n) &&
        /planning|plannen|agenda|vandaag|morgen|eerstvolgende|aandacht|dagregie|needs_time|overlap/i.test(n)));
  const attentionPrimary =
    /geen\s+agenda|niet\s+.*\bagenda\b.*vul|alleen\s+weten|alleen\s+aandacht|vooral\s+aandacht|niet\s+alles\s+plannen|wat\s+aandacht\s+nodig/i.test(n);
  const attentionUnlessCritical =
    /tenzij.*tijdkritisch|tijdkritisch/i.test(n) && /geen\s+agenda|niet.*agenda/i.test(n);
  const attentionOnly =
    noPlanning || (!wantsExplicitTimedPlanning && (attentionPrimary || attentionUnlessCritical));
  const weekDirectionOnly =
    !wantsExplicitTimedPlanning &&
    !attentionOnly &&
    ((/richting.*(?:deze\s+)?week|deze\s+week.*per\s+project|weekoverzicht|rubric/i.test(n) &&
      /geen\s+exacte|zonder\s+(?:getimede\s+)?tijden|geen\s+tijdblokken|geen\s+agenda/i.test(n)) ||
      (/geen\s+exacte\s+planning/i.test(n) && /deze\s+week/i.test(n) && /per\s+project|elk\s+project/i.test(n)) ||
      (/realistische\s+richting/i.test(n) && /deze\s+week/i.test(n) && /per\s+project|elk\s+project/i.test(n)) ||
      (/deze\s+week/i.test(n) && /per\s+project/i.test(n) && /(richting|focus|nadruk)/i.test(n) && !/\bplan\s+vandaag\b/i.test(n)));
  const wantsLightDay =
    /haalba(a)?r|licht(er)?\s+dag|niet\s+de\s+hele\s+dag|geen\s+volle\s+dag|rust|pauze|niet\s+de\s+hele\s+dag|laptop/i.test(n);
  const wantsHonestCapacity = /eerlijk|past\s+niet|te\s+veel\s+werk|niet\s+alles\s+past|prioriteer|wat\s+laat|schrap/i.test(n);
  const wantsOverlapResolve = /overlap|botsing/i.test(n) && /\b(?:los|oplossen|opgelost)\b/i.test(n);
  const wantsDayRegie =
    /\b(?:het\s+is|nu)\s+\d{1,2}[:.]\d{2}\b/i.test(text) ||
    /dagregie|rest\s+van\s+de\s+dag|vandaag\s+nog|nog\s+wel\s+of\s+niet|afrond|dagcheck/i.test(n);
  const projectQuestionOnly =
    !wantsExplicitTimedPlanning &&
    !attentionOnly &&
    /wat\s+zijn|welke\s+open|open\s+lijnen|belangrijkste|eerste\s+werksessie|logische\s+eerste/i.test(n) &&
    /project|projectcontext|projectbrain/i.test(n);
  const wantsProjectbrainPlanning =
    !attentionOnly &&
    !weekDirectionOnly &&
    (/projectbrain|\bprojecten\b.*\b(brein|context)|lopende\s+projecten/i.test(n) || /eerstvolgende\s+actie|per\s+project/i.test(n)) &&
    /planning|plannen|realistisch|agenda|vandaag|morgen|taken|aandacht|dagregie|needs_time|overlap/i.test(n);
  return {
    noPlanning,
    attentionOnly,
    weekDirectionOnly,
    wantsLightDay,
    wantsHonestCapacity,
    wantsOverlapResolve,
    wantsDayRegie,
    projectQuestionOnly,
    wantsProjectbrainPlanning,
    wantsExplicitTimedPlanning
  };
}

function buildCompactAcceptanceAndSituational(intent) {
  const core = `Acceptatie — Clara AI (algemene regels, niet zin-voor-zin hardcoderen):
1) Expliciet planningsverzoek + meerdere bekende projecten + bruikbare Projectbrain ⇒ minimaal enkele getimede potloodblokken verdeeld over de gevraagde dagen; lege agenda is dan onwenselijk.
2) Projectbrain = context voor thema, prioriteit en voorbehoud — geen 1:1 markdown- of sectiedump als agenda/takenlijst.
3) Afgeleide werksessies: status pencil + confirmation_required true; alleen echte afspraken met door de gebruiker gegeven datum+tijd ⇒ confirmed appointment.
4) Geen harde externe afspraken of vaste tijden met derden verzinnen.
5) Twijfel en hiaten ⇒ dashboard_output.attention en uncertainties; dat mag potloodplanning niet laten verdwijnen als de gebruiker wél expliciet wil plannen.
6) Scheiding: clara_agenda = uitvoering in tijd; proposed_items alleen task/reminder (geen attention-type); dashboard_output.attention = korte regels met text + kind (risico|keuze|check|wacht|past_niet|project). Elk punt moet inhoudelijk zijn: antwoord op "wat mag ik niet uit het oog verliezen?" per project. Geen metaregels of procesinstructies (zoals overlap vermijden, geen dump maken, Projectbrain "in aandacht bewaren", taken niet verkorten).
7) Realistische duur: gewone werksessie 45–90 min; korte app/follow-up 10–20; diep werk 90–120; duur niet kunstmatig verkorten om te passen.
8) Geen overlap tussen flexibele blokken; harde items blijven; wat echt niet past ⇒ needs_time + scheduling_needs.
9) Titels eerlijk en breed ("Project — onderwerp nalopen"); geen schijnzekerheid over details die niet in input of Projectbrain staan.
10) JSON-blok "Actuele lokale Clara Lab State" in de gebruikerstekst is leidend: handmatige edits gaan vóór eerdere AI-voorstellen.
11) day_review.now_first_move: 1–2 zinnen die sturen — waarom déze eerste stap nu logisch is; geen letterlijke agendatitel alleen. day_review.items_to_check: max. 2 korte checks/reminders, géén herhaling van agendablokken. day_review.review_prompt: één scherpe einde-dag-reviewvraag (geen generieke potloodvraag).`;

  const situational = [];
  if (intent.attentionOnly) {
    situational.push(
      '**Intent deze ronde:** aandacht samenvatten volgens appendix; geen nieuwe getimede blokken tenzij tijdkritisch met tijd in de vraag.'
    );
  }
  if (intent.noPlanning) {
    situational.push(
      '**Intent deze ronde:** niet-plannen/open gesprek — geen agenda-items, geen dagplan, hooguit 1–3 open items en rustige vervolgvragen.'
    );
  }
  if (intent.weekDirectionOnly) {
    situational.push(
      '**Intent deze ronde:** weekrichting per project (project_signals + summary); geen nieuwe getimede agenda-blokken — zie appendix.'
    );
  }
  if (intent.projectQuestionOnly) {
    situational.push(
      '**Intent deze ronde:** uitleg/opsomming — geen volledige meerdaagse agenda; hooguit één logische eerste werksessie als proposed_item of korte suggestie.'
    );
  }
  if (intent.wantsLightDay && !intent.attentionOnly) {
    situational.push('**Intent:** haalbare/lichte dag — vul niet de hele dag; laat bewust gaten of rust.');
  }
  if (intent.wantsHonestCapacity) {
    situational.push('**Intent:** eerlijke capaciteit — wat niet past: needs_time + uitleg in summary en scheduling_needs, niet alles forceren.');
  }
  if (intent.wantsOverlapResolve) {
    situational.push('**Intent:** overlap oplossen — verschuif potlood/flex; verplaats geen harde confirmed/external_busy tenzij de gebruiker dat expliciet vraagt.');
  }
  if (intent.wantsDayRegie) {
    situational.push('**Intent:** dagregie — focus op rest van vandaag, korte keuzes; geen hele week herschrijven tenzij de vraag dat nodig maakt.');
  }
  if (intent.wantsProjectbrainPlanning) {
    situational.push('**Intent:** planning uit Projectbrain/projecten — zie appendix Projectbrain→planning.');
  }

  const extra = situational.length ? `\n\n${situational.join('\n')}` : '';
  return `\n\n${core}${extra}`;
}

function detectTodayOnlyReplan(text, requestedDays, today) {
  if (!Array.isArray(requestedDays) || requestedDays.length !== 1 || requestedDays[0] !== today) return false;
  const n = String(text || '').toLowerCase();
  return /\bplan\s+vandaag\b/i.test(n) || (/vandaag\s*:/i.test(n) && /plan|rust|eerlijk|administratie|boodschappen/i.test(n));
}

function hasTimeCriticalBypassAttention(text) {
  const t = String(text || '');
  return /\b(nu|asap|spoed|uiterlijk|deadline|tijdkritisch|onmiddellijk)\b/i.test(t) && /\d{1,2}[:.]\d{2}/.test(t);
}

function agendaItemKey(item) {
  return `${item?.date || ''}|${item?.start_time || ''}|${String(item?.title || '').trim().toLowerCase()}`;
}

function mergePreserveAgendaOtherDays(parsed, labState, today) {
  if (!parsed || !Array.isArray(parsed.clara_agenda) || !labState || !Array.isArray(labState.agenda)) return parsed;
  const fromLab = labState.agenda.filter((i) => i?.date && i.date !== today);
  if (!fromLab.length) return parsed;
  const agenda = [...parsed.clara_agenda];
  const have = new Set(agenda.map(agendaItemKey));
  for (const item of fromLab) {
    const k = agendaItemKey(item);
    if (!have.has(k)) {
      agenda.push({ ...item, source: item.source || 'lab_state_preserved' });
      have.add(k);
    }
  }
  parsed.clara_agenda = agenda;
  return parsed;
}

function buildDateDisciplineAppendix(today, tomorrow, todayOnlyReplan) {
  return `\n\nDatum- en state-isolatie:\n- ISO vandaag = ${today}, morgen = ${tomorrow}. "Vandaag" in tekst ⇒ date ${today}; "morgen" ⇒ date ${tomorrow}. Zet een afspraak die de gebruiker uitdrukkelijk bij **morgen** plaatst nooit op ${today}.\n- Bestaande agenda-items in Lab State: behoud hun \`date\` tenzij de gebruiker expliciet verplaatst.${todayOnlyReplan ? `\n- **Alleen-vandaag-herplanning:** neem alle bestaande clara_agenda-items met date ≠ ${today} ongewijzigd mee in je output (zelfde datum, tijden, status). Werk alleen ${today} bij.` : ''}\n- dashboard_output.today: alleen items die echt ${today} betreffen.\n`;
}

function buildAttentionOnlyAppendix(labState) {
  const has =
    labState &&
    (labState.agenda?.length ||
      labState.attention?.length ||
      labState.tasks?.length ||
      labState.day_regie?.items_to_check?.length ||
      labState.day_regie?.rollover_candidates?.length);
  const preview = has
    ? `\n- Lab State bevat nu: agenda ${labState.agenda?.length || 0}, aandacht ${labState.attention?.length || 0}, taken ${labState.tasks?.length || 0}, checken ${labState.day_regie?.items_to_check?.length || 0}, doorschuiven ${labState.day_regie?.rollover_candidates?.length || 0}.`
    : '\n- Lab State is visueel leeg; zeg niet dat er "niets" speelt zonder dat te onderbouwen.';

  return `\n\nAttention-only modus:\n- Voeg geen nieuwe getimede clara_agenda-items toe tenzij de gebruiker een **echte** tijdkritische afspraak met concreet tijdstip noemt (nu/spoed/deadline + tijd).\n- Lees verplicht het **lab_state JSON** én de ingesloten Lab State in de tekst: neem agenda (ook needs_time/conflict), attention, tasks, day_regie (items_to_check, rollover_candidates, review_prompt, suggested_time) en signalen uit het chatverloop mee.${preview}\n- dashboard_output.attention: max. 5 punten; concreet inhoudelijk (risico/keuze/check) uit projectcontext; geen systeemregels.\n- day_review.now_first_move: waarom nu eerst deze stap (stuurt), niet agendakopie.\n- day_review.items_to_check max. 2 checks (geen agendatitels); review_prompt één scherpe reviewvraag.\n- Summary: korte uitsplitsing met koppen **Aandacht**, **Doorschuiven**, **Checken**, **Tijdkritisch**, **Agenda / needs_time** — alleen secties vullen die echt inhoud hebben.\n- Zeg **niet** dat er niets te doen is als een van die lijsten inhoud heeft.\n`;
}

function buildNoPlanningAppendix() {
  return `\n\nNiet-plannen modus:\n- De gebruiker wil expliciet niet plannen of vraagt naar open items. Maak deze ronde **geen** nieuwe clara_agenda-items, geen startup-planning en geen proposed task/reminder.\n- Zet open items niet om naar dagplanning. Open items zijn alleen aanleiding voor gesprek, aandacht of een rustige vraag.\n- Geef maximaal 1–3 open_threads terug, liefst de inhoudelijk meest levende.\n- Summary: kort en rustig; zeg niet "conceptdag klaargezet", "potloodblok gepland" of "klopt deze planning".\n- Vraag iets als: "Wil je dit nu bespreken, laten hangen, sluiten of later plannen?"\n- day_review mag leeg blijven of alleen één zachte gespreksregel in now_first_move bevatten. Geen NU/STRAKS/EINDE DAG-dagplan, geen checktijd en geen 17:30/18:00 tenzij de gebruiker expliciet om reminder/planning vraagt.\n`;
}

function buildPlanningPolicyAppendix(nowInfo) {
  return `\n\nTijd- en weekbewuste planning:\n- Actuele Amsterdamse tijd: ${nowInfo?.label || 'onbekend'}.\n- Plan nooit nieuwe werkblokken in het verleden.\n- Na 17:30: vandaag alleen nog korte lichte blokken als Jeroen expliciet "vandaag", "nu" of "vanavond" zegt; anders naar de eerstvolgende geschikte werkdag.\n- Na 20:00: behandel vandaag als praktisch voorbij; geen werkplanning vandaag tenzij Jeroen expliciet "vanavond nog" vraagt.\n- Zaterdag en zondag: standaard geen werkblokken; alleen bij expliciete weekendafspraak, harde deadline of expliciete userwens.\n- Maandag: niet vroeg plannen; standaard vanaf 11:00 of 12:00, tenzij Jeroen expliciet een vroegere tijd noemt.\n- Dinsdag t/m vrijdag: normale werkplanning vanaf 10:00.\n- Avond: alleen lichte taken of expliciet gevraagde avondplanning.\n`;
}

function buildWeekDirectionAppendix(projectbrainContext) {
  const pb = String(projectbrainContext || '');
  const pbHint =
    pb.length > 400 && !pb.includes('token ontbreekt')
      ? 'Gebruik concrete feiten uit Projectbrain per project (kern/open lijnen), geen lege managementtaal.'
      : 'Is Projectbrain kort of afwezig: geef per genoemd project toch één **concrete** voorzichtige zin (bijv. "LaLampe — workshopflow en veiligheid scherp krijgen") op basis van naam en vraag.';

  return `\n\nWeekrichting (geen exacte uren):\n- **Geen nieuwe getimede clara_agenda-items**; wijzig geen datums van bestaande Lab-agenda tenzij de gebruiker dat vraagt.\n- Vul **dashboard_output.project_signals** met minstens één regel per relevant project (**clara**, **lalampe**, **begeister**, **afk** / Landjuweel / Amarte) als die in de vraag of context voorkomen, vorm: \`Project — focus deze week\`.\n- Geen vage zinnen als "richt je op prioriteiten" zonder projectinhoud.${pbHint}\n`;
}

function buildProjectbrainPlanningAppendix(today, tomorrow, requestedDays) {
  const days = Array.isArray(requestedDays) && requestedDays.length ? requestedDays.join(', ') : `${today}, ${tomorrow}`;
  return `\n\nProjectbrain → planning (deze ronde):\n- Projectbrain = context; geen dump van markdown of secties; geen automatische algemene samenvatting in attention.\n- Per relevant project max. 1–2 eerstvolgende acties als potlood in clara_agenda over: ${days}; status pencil, confirmation_required true; geen overlap tussen potloodblokken op dezelfde dag.\n- Gewone uitvoerbare acties: clara_agenda en/of proposed_items als task/reminder (niet als attention).\n- Risico's, twijfel, open keuzes, wachten, needs_time-uitleg: **dashboard_output.attention** met korte regels; elk item heeft kind: risico | keuze | check | wacht | past_niet | project.\n- Wat niet eerlijk past: needs_time + scheduling_needs, niet forceren.\n- **day_review**: now_first_move = eerste beweging nu (met korte waarom); items_to_check = max. 2 checks/reminders, géén agendakopie; review_prompt = één scherpe einde-dag-vraag; rollover_candidates alleen echte doorschuivers.\n`;
}

function buildSingleProjectAppendix(project) {
  if (!project) return '';
  const label = PROJECT_LABELS[project] || project;
  return `\n\nExpliciete projectfocus: ${label}\n- De gebruiker noemt precies één project; behandel ${label} als primaire context.\n- Gebruik STABIELE PROJECTCONTEXT en vooral RECENTE PROJECTSIGNALEN/raw van ${label}; andere projecten zijn alleen achtergrond.\n- Maak geen dashboard_output.attention, proposed_items, clara_agenda, scheduling_needs, day_review-items of uncertainties voor AFK, Begeister, Clara of Clara Core Lab tenzij de gebruiker die projecten ook noemt.\n- Startup/dagbrede Projectbrain-suggesties mogen niet lekken in dit single-project antwoord.\n- Als je een potloodsuggestie maakt, houd die bij ${label}; raw blijft verboden als bron voor confirmed taken of harde afspraken zonder expliciete datum, tijd en bevestiging.\n`;
}

function buildStartupRawAppendix(rawProjects, today, tomorrow) {
  const active = Array.isArray(rawProjects) ? rawProjects : [];
  const labels = active.map((project) => PROJECT_LABELS[project] || project).join(', ');
  if (!active.length) {
    return `\n\n**Automatische Core Lab-start (bron projectbrain_startup):**\n- Er zijn geen projecten met betekenisvolle RECENTE PROJECTSIGNALEN/raw.\n- Maak geen startup-agenda, attention of dagregie uit STABIELE PROJECTCONTEXT alleen.\n- Geef kort aan dat er geen recente raw-signalen zijn om een actuele conceptdag op te bouwen.\n- Geen generieke Projectbrain-context of systeemregels in attention.\n`;
  }
  return `\n\n**Automatische Core Lab-start (bron projectbrain_startup):**\n- Bouw de startup alleen uit projecten met betekenisvolle RECENTE PROJECTSIGNALEN/raw: ${labels}.\n- STABIELE PROJECTCONTEXT is alleen achtergrond; maak daar geen startup-blokken uit.\n- Negeer raw-template-only, ontbrekende of lege raw-bestanden.\n- Voor elk raw-actief project: max. één potloodblok op ${today}; gebruik ${tomorrow} alleen als ${today} eerlijk niet past.\n- Voor elk raw-actief project: max. 1–2 concrete attention-items.\n- Maak geen agenda/attention/day_regie voor projecten zonder betekenisvolle raw.\n- Geen harde afspraken, confirmed taken of externe afspraken uit raw.\n- Geen generieke systeem-attention-items of "Projectbrain context ontbreekt" zolang raw voor ${labels} bestaat.\n- summary: max. twee korte zinnen.\n`;
}

function buildOpenThreadsAppendix(isStartup) {
  return `\n\nOpen items:\n- Detecteer inhoudelijke open eindjes uit raw, projectcontext en rommelige chatcontext als \`open_threads\`.\n- Open items zijn GEEN taken, GEEN afspraken en GEEN automatische agenda-items.\n- Maak van een open item geen clara_agenda-item en geen proposed task tenzij de gebruiker expliciet vraagt om planning.\n- Als de laatste Clara-vraag duidelijk over een open_thread ging en Jeroen kort antwoordt ("marketing", "technisch", "plan maar", "sluiten", "maandag", "deze week"), behandel dat als antwoord op dat item, niet als los onderwerp.\n- Als zo'n antwoord richting geeft, werk context/status bij, herhaal de vraag niet, en maak een concrete vervolgstap of potloodblok tenzij Jeroen zegt dat het moet blijven hangen.\n- Gebruik open_threads voor rustige vervolgvragen, inhoudelijke reminders en chat-starts: "Hoe staat het hiermee?", "Weet je al wat je hiermee wil doen?", "Moet dit blijven hangen of mag het weg?"\n- Stel maximaal 1–2 rustige vragen als dat nuttig is.\n- Als raw een sectie \`## Open items / chat-reminders\` bevat, behandel die als sterke input voor open_threads.\n- Status: open | hanging | closed. Gesloten items niet opnieuw openen tenzij raw duidelijk nieuwe context geeft.\n- Objectvorm per item: id, project, title, question, context, status, source, last_seen, importance, suggested_next_step.${isStartup ? '\n- Bij startup maximaal één open_thread teruggeven; prioriteit lager dan urgente agenda/aandacht.' : ''}\n`;
}

function detectProjectPlanIntent(text) {
  const n = String(text || '').toLowerCase();
  const wantsPlan =
    /maak\s+(?:een\s+)?projectplan/.test(n) ||
    /zet\s+dit\s+om\s+in\s+een\s+projectplan/.test(n) ||
    /help\s+me\s+dit\s+traject\s+opdelen/.test(n) ||
    /wat\s+zijn\s+de\s+stappen\s+om/.test(n) ||
    /\bprojectplan\b/.test(n) ||
    /\bmaak\s+een\s+plan\b/.test(n) ||
    /\bmaak\s+.*\bplan\s+voor\b/.test(n) ||
    (/\bik\s+wil\b/.test(n) && /\b(bereiken|afhebben|opleveren)\b/.test(n) && /\bvoor\b/.test(n)) ||
    (/\bik\s+wil\b/.test(n) && /\bproject\b/.test(n) && /\bplan\b/.test(n));
  const looksLikeDayPlanning =
    /\bdagplanning\b|\bconceptdag\b|\bplan\s+vandaag\b|\bplan\s+morgen\b/.test(n) ||
    /maak\s+een\s+dagplanning/.test(n);
  const tooSmall =
    n.trim().split(/\s+/).filter(Boolean).length <= 6 &&
    !/\bprojectplan\b/.test(n);
  if (looksLikeDayPlanning) return false;
  if (tooSmall) return false;
  return wantsPlan;
}

function buildProjectPlanAppendix(singleProjectLabel) {
  const focus = singleProjectLabel ? `\n- Focusproject: ${singleProjectLabel}. Gebruik vooral context/recente signalen van dit project; dump geen hele Projectbrain.` : '';
  return `\n\nProjectplan-voorstel (alleen als de gebruiker hier expliciet om vraagt):\n- Vul optioneel \`project_plan_suggestion\` met een **concept** projectplan.\n- Alleen doen bij duidelijke projectplan-intentie; anders: laat \`project_plan_suggestion\` weg.\n- Geen agenda-mutaties: laat \`clara_agenda\` onveranderd of leeg; maak geen nieuwe getimede blokken.\n- Kwaliteit: 3–7 stappen; elke stap 1–3 taken; realistische duur; logische afhankelijkheden.\n- dependency_type: none | after_previous | parallel | external_wait.\n- “external_wait” betekent wachten op input; dat is geen uitvoerblok.\n- Deadline alleen als expliciet genoemd of betrouwbaar af te leiden; anders null.\n- Vermijd vage stappen (“Voorbereiden”, “Afronden”, “Checken”) zonder concrete inhoud.\n- context: 1–3 zinnen waarom deze stappen logisch zijn.\n- confidence: 0–1 (hoe zeker is dit plan op basis van input+context).${focus}\n`;
}

function buildProjectPlanFocusGuard(inputText) {
  const t = String(inputText || '').toLowerCase();
  const wantsLaLampe = /lalampe|la\s*lampe/.test(t);
  const wantsAFK = /\bafk\b|landjuweel|amarte/.test(t);
  const wantsBegeister = /begeister/.test(t);
  const wantsCoreLab = /clara\s+core\s+lab|core\s+lab|clara-4|clara\s+lab/.test(t);
  if (wantsLaLampe && !wantsAFK) return '\n\nFocus guard: Deze aanvraag gaat over LaLampe. Gebruik AFK/Landjuweel/Amarte-context niet voor stappen, tenzij de gebruiker dat expliciet noemt. Vermijd woorden/steps als lampwezen, nachtdiertjes, voetconstructie, servo/sensor, POC, stabiliteit/lichtbeeld/veiligheid testen, installatie-documentatie.';
  if (wantsAFK && !wantsLaLampe) return '\n\nFocus guard: Deze aanvraag gaat over AFK/Landjuweel/Amarte. Gebruik LaLampe-workshopcontext niet voor stappen, tenzij de gebruiker dat expliciet noemt.';
  if (wantsBegeister) return '\n\nFocus guard: Deze aanvraag gaat over Begeister. Focus op samenwerking, rollen, grenzen en besluitvorming.';
  if (wantsCoreLab) return '\n\nFocus guard: Deze aanvraag gaat over Clara Core Lab. Focus op softwaregedrag, feature-stappen en tests.';
  return '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { input = '', source = 'manual', lab_state: labStateRaw = null, now_override: nowOverride = null } = req.body || {};
    const text = String(input || '').trim();
    if (!text) return res.status(400).json({ error: 'Missing input' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });

    const isStartup = source === 'projectbrain_startup';
    const isProjectPlanRequest = source === 'project_plan_request' || detectProjectPlanIntent(text);
    const safeNowOverride = process.env.VERCEL_ENV === 'production' ? null : nowOverride;
    const { today, tomorrow, now } = getAmsterdamDateInfo(safeNowOverride);
    const requestedDays = isStartup ? [today, addDaysIso(today, 1)] : detectRequestedPlanningDays(text, today);
    const projectbrainContext = await loadProjectbrainContext();
    const meaningfulRawProjects = getMeaningfulRawProjects(projectbrainContext);
    const latestMessage = latestUserMessage(text);
    let intent = inferUserIntentHints(latestMessage);
    const singleExplicitProject = isStartup ? null : getSingleExplicitProject(latestMessage);
    if (isStartup) {
      intent = {
        ...intent,
        wantsProjectbrainPlanning: true,
        attentionOnly: false,
        weekDirectionOnly: false,
        wantsExplicitTimedPlanning: false,
        projectQuestionOnly: false
      };
    }
    const todayOnlyReplan = isStartup ? false : detectTodayOnlyReplan(text, requestedDays, today);
    const openThreadReplyThisTurn =
      !isStartup &&
      Array.isArray(labStateRaw?.open_threads) &&
      labStateRaw.open_threads.some((item) => item && item.status !== 'closed') &&
      isShortOpenThreadReply(latestUserMessage(text));

    const startupAppendix = isStartup ? buildStartupRawAppendix(meaningfulRawProjects, today, tomorrow) : '';

    const projectPlanFocusGuard = isProjectPlanRequest ? buildProjectPlanFocusGuard(latestMessage) : '';
    const promptAddenda =
      buildDateDisciplineAppendix(today, tomorrow, todayOnlyReplan) +
      buildPlanningPolicyAppendix(now) +
      (intent.noPlanning ? buildNoPlanningAppendix() : '') +
      (intent.attentionOnly ? buildAttentionOnlyAppendix(labStateRaw) : '') +
      (intent.weekDirectionOnly ? buildWeekDirectionAppendix(projectbrainContext) : '') +
      (!isStartup && intent.wantsProjectbrainPlanning ? buildProjectbrainPlanningAppendix(today, tomorrow, requestedDays) : '') +
      (isProjectPlanRequest ? buildProjectPlanAppendix(singleExplicitProject ? (PROJECT_LABELS[singleExplicitProject] || singleExplicitProject) : '') : '') +
      projectPlanFocusGuard +
      buildSingleProjectAppendix(singleExplicitProject) +
      buildOpenThreadsAppendix(isStartup) +
      startupAppendix;

    const schema = {
      name: 'clara_core_analysis',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['summary','signals','proposed_items','dashboard_output','clara_agenda','scheduling_needs','day_review','open_threads','uncertainties','questions','ignored_noise'],
        properties: {
          summary: { type: 'string' },
          signals: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title','kind','reason','confidence'], properties: { title: { type: 'string' }, kind: { type: 'string', enum: ['action_for_jeroen','waiting_for_other','appointment_or_deadline','project_context','note','decision','risk_or_blocker','suggestion','noise'] }, reason: { type: 'string' }, confidence: { type: 'number', minimum: 0, maximum: 1 } } } },
          proposed_items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title','type','project','status','date','time','description','source','confidence'], properties: { title: { type: 'string' }, type: { type: 'string', enum: ['task','appointment','waiting_for','note','project_context','decision','reminder','attention'] }, project: { type: ['string','null'] }, status: { type: 'string', enum: ['proposed','needs_review','ready_to_save','ignore'] }, date: { type: ['string','null'] }, time: { type: ['string','null'] }, description: { type: 'string' }, source: { type: 'string' }, confidence: { type: 'number', minimum: 0, maximum: 1 } } } },
          dashboard_output: { type: 'object', additionalProperties: false, required: ['today','attention','waiting_for','agenda','project_signals','suggestions'], properties: { today: { type: 'array', items: { type: 'string' } }, attention: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['text','kind'], properties: { text: { type: 'string' }, kind: { type: 'string', enum: ['risico','keuze','check','wacht','past_niet','project'] } } } }, waiting_for: { type: 'array', items: { type: 'string' } }, agenda: { type: 'array', items: { type: 'string' } }, project_signals: { type: 'array', items: { type: 'string' } }, suggestions: { type: 'array', items: { type: 'string' } } } },
          clara_agenda: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title','kind','date','start_time','end_time','estimated_duration_minutes','status','project','source','reason','confirmation_required','confidence'], properties: { title: { type: 'string' }, kind: { type: 'string', enum: ['appointment','planned_task','focus_block','deadline','reminder','external_busy','day_review'] }, date: { type: ['string','null'] }, start_time: { type: ['string','null'] }, end_time: { type: ['string','null'] }, estimated_duration_minutes: { type: ['number','null'] }, status: { type: 'string', enum: ['confirmed','pencil','needs_time','external_busy','conflict','done','cancelled'] }, project: { type: ['string','null'] }, source: { type: 'string' }, reason: { type: 'string' }, confirmation_required: { type: 'boolean' }, confidence: { type: 'number', minimum: 0, maximum: 1 } } } },
          scheduling_needs: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title','preferred_date','estimated_duration_minutes','priority','reason'], properties: { title: { type: 'string' }, preferred_date: { type: ['string','null'] }, estimated_duration_minutes: { type: ['number','null'] }, priority: { type: 'string', enum: ['low','normal','high'] }, reason: { type: 'string' } } } },
          day_review: { type: 'object', additionalProperties: false, required: ['review_needed','suggested_time','review_prompt','items_to_check','rollover_candidates','now_first_move'], properties: { review_needed: { type: 'boolean' }, suggested_time: { type: ['string','null'] }, review_prompt: { type: 'string' }, items_to_check: { type: 'array', items: { type: 'string' } }, rollover_candidates: { type: 'array', items: { type: 'string' } }, now_first_move: { type: 'string' } } },
          open_threads: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id','project','title','question','context','status','source','last_seen','importance','suggested_next_step'], properties: { id: { type: 'string' }, project: { type: ['string','null'] }, title: { type: 'string' }, question: { type: 'string' }, context: { type: 'string' }, status: { type: 'string', enum: ['open','hanging','closed'] }, source: { type: 'string' }, last_seen: { type: 'string' }, importance: { type: 'string', enum: ['low','normal','high'] }, suggested_next_step: { type: 'string' } } } },
          uncertainties: { type: 'array', items: { type: 'string' } },
          questions: { type: 'array', items: { type: 'string' } },
          ignored_noise: { type: 'array', items: { type: 'string' } },
          project_plan_suggestion: {
            type: 'object',
            additionalProperties: false,
            required: ['project','title','goal','deadline','status','context','confidence','source','steps'],
            properties: {
              project: { type: 'string' },
              title: { type: 'string' },
              goal: { type: 'string' },
              deadline: { type: ['string','null'] },
              status: { type: 'string', enum: ['concept'] },
              context: { type: 'string' },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              source: { type: 'string', enum: ['ai_project_plan'] },
              steps: {
                type: 'array',
                minItems: 3,
                maxItems: 7,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['title','status','estimated_duration_minutes','dependency_type','depends_on_step_id','deadline','tasks'],
                  properties: {
                    title: { type: 'string' },
                    status: { type: 'string', enum: ['todo'] },
                    estimated_duration_minutes: { type: 'number', minimum: 10, maximum: 240 },
                    dependency_type: { type: 'string', enum: ['none','after_previous','parallel','external_wait'] },
                    depends_on_step_id: { type: ['string','null'] },
                    deadline: { type: ['string','null'] },
                    tasks: {
                      type: 'array',
                      minItems: 1,
                      maxItems: 3,
                      items: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['title','status','estimated_duration_minutes','deadline','source_reason'],
                        properties: {
                          title: { type: 'string' },
                          status: { type: 'string', enum: ['todo'] },
                          estimated_duration_minutes: { type: 'number', minimum: 10, maximum: 180 },
                          deadline: { type: ['string','null'] },
                          source_reason: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      strict: true
    };

    const multiProjectPlanningBlock =
      !isStartup && !singleExplicitProject && requestedDays.length >= 2 && !intent.attentionOnly && !intent.weekDirectionOnly
        ? `\n\nMeerdaagse projectplanning (verplicht wanneer de gebruiker dit zo vraagt, of bij automatische startup):\n- Bij startup of expliciete meerdaagse vraag: als Projectbrain-context technisch beschikbaar is (geen token-/repo-fouttekst), mag clara_agenda voor de gevraagde dagen niet leeg blijven zonder getimede potloodblokken.\n- Zet per relevant project minstens één werksessie (kind focus_block of planned_task, status pencil, confirmation_required true, duur volgens appendix) verdeeld over: ${requestedDays.join(', ')}.\n- Geen overlap tussen potloodblokken op dezelfde dag.\n- Gebruik Projectbrain voor thema/hoofdlijn in titel en reason; geen 1:1 dump van Markdown-secties als takenlijst.\n- Verzin geen externe afspraken of bevestigde meetings met derden.\n- Parkeer twijfel en ontbrekende feiten in dashboard_output.attention en uncertainties.\n`
        : '';

    const systemPrompt = `Je bent Clara Core Lab: de interpretatielaag achter Clara.\n\nVandaag is ${today}. Morgen is ${tomorrow}. Gebruik deze datums als absolute basis voor relatieve woorden zoals vandaag, morgen en vrijdag.\n\nClara werkt vanuit echte lagen (niet losse zinnen):\n- clara_agenda = tijdblokken (agenda truth in UI)\n- project_plans = project → plan → stappen (met duur, afhankelijkheden, checklist)\n- general_tasks = praktische losse taken zonder projectplan\n- open_threads = open vragen/keuzes die nog niet planbaar zijn\n\nKernregel: maak alleen nieuwe agenda-blokken als het een **concrete actie** is met **project/context** en **realistische duur**. Vermijd generieke titels zoals 'Voorbereiden', 'Afronden', 'Oppakken', 'Verder uitwerken', 'Checken', 'Korte voorbereiding' tenzij de titel meteen een concrete actie + project bevat.\n\nClara is vooral een AI-assistent met een dagagenda als spoor/geheugen. De UI heeft een sterk visuele messenger-chat. Gebruik de summary als korte, menselijke Clara-reactie: 1 tot 3 rustige zinnen, geen rapporttaal.\n\nJe krijgt Projectbrain-context uit lokaal of GitHub. Behandel STABIELE PROJECTCONTEXT als projectgeheugen: gebruik het om projecten, beslissingen, open acties en onzekerheden beter te begrijpen. Zet Projectbrain-informatie niet automatisch als taak op vandaag, tenzij de gebruiker daar expliciet om vraagt. RECENTE PROJECTSIGNALEN/raw mag alleen aandacht, day_regie, uncertainties, open_threads en potloodsuggesties informeren. Raw mag geen confirmed taken of harde afspraken maken zonder expliciete datum, tijd en bevestiging.\n\nPlanningskern:\n- Clara moet een realistische planning maken, niet alleen taken herkennen.\n- Verdeel werk over beschikbare dagen wanneer de gebruiker om meerdere dagen vraagt.\n- Gevraagde planningsdagen in deze input: ${requestedDays.join(', ')}.\n- Plan potloodtaken, focusblokken en reminders nooit bewust over elkaar heen.\n- Overlap is alleen toegestaan voor harde afspraken die echt botsen, of wanneer iets onmogelijk past.\n- Als iets niet past: zet status needs_time en benoem waarom.\n\nProjectplan-regels:\n- Als de gebruiker een projectdoel noemt of om meerdaagse planning vraagt: maak/werk een project_plans-item bij met stappen.\n- Stappen hebben: naam, estimated_duration_minutes, dependency_type, depends_on_step_ids en checklist tasks[].\n- Projectplan is voorstelbaar en bewerkbaar; pas daarna pas je stappen om naar agenda-blokken.\n\nAlgemene taken:\n- Als iets geen projectcontext heeft (bijv. 'schroeven bestellen'), zet het in general_tasks (met category) en maak pas een agenda-blok als de gebruiker echt wil plannen.\n\nActieregels:\n- Als de input een eerdere Clara-analyse bevat plus een nieuw bericht of aangeklikte actie, werk dan voort op die eerdere analyse.\n- Als de gebruiker vraagt 'los het op' of een suggestieknop aanklikt, pas de planning concreet aan. Vraag niet eerst om toestemming. Maak een beste potloodoplossing en laat resterende conflicten zichtbaar.\n- Als je iets hebt aangepast, benoem kort wat je deed.\n\nAgendaweergave-regels:\n- De agenda loopt van 10:00 tot 23:00.\n- De UI splitst die in Dag 10:00–19:00 en Avond 19:00–24:00.\n- Items zonder starttijd, needs_time of zeer lange blokken mogen boven de agenda als dagbrede/all-day items verschijnen.\n- Zet echte tijdsblokken met start_time en end_time in clara_agenda zodat ze zichtbaar zijn.\n\nBasisregels:\n- Antwoord altijd in het Nederlands.\n- Dashboard today mag alleen items tonen die vandaag (${today}) spelen. Morgen-items horen niet in today.\n- action_for_jeroen = Jeroen moet iets doen of iemand wacht op Jeroen.\n- waiting_for_other = Jeroen wacht op iemand anders.\n- Tijd die in dashboard_output.agenda staat moet ook in clara_agenda staan.\n\nHarde afspraken en conflicten:\n- Een afspraak met datum en tijd is appointment confirmed, confirmation_required=false.\n- Als twee confirmed afspraken overlappen, zet allebei in clara_agenda. De overlappende afspraak mag status='conflict' krijgen als dat nodig is om het zichtbaar te maken, maar hij blijft inhoudelijk een harde afspraak.\n- Conflicten nooit gladstrijken of verbergen.\n\nTaken zonder tijd verspreiden:\n- Als input zegt dat taken morgen/vandaag moeten maar geen tijd geeft, mag Clara vrije ruimtes zoeken tussen harde afspraken en daar planned_task pencil plaatsen.\n- Zet zulke taken niet allemaal onder needs_time als er duidelijke dagruimte is.\n- Plaats korte taken liefst eerst na een overleg en lange blokken daarna, tenzij de input een andere prioriteit of deadline noemt.\n- Pencil betekent voorstel: confirmation_required=true.\n\nEerlijke duurregels:\n- Schat duur op basis van de aard van de taak, niet op basis van beschikbare ruimte.\n- Maak taken niet korter om ze passend te krijgen.\n- Korte follow-up: 10-15 min. Simpel antwoord: 15-25 min. Zorgvuldige mail/inhoudelijke reactie: 25-40 min. Bestellen/regelen: 30-45 min. Administratie/ordenen: 45-90 min. Btw-administratie/financieel uitzoeken: 120-180 min. Nieuw concept schrijven: 120-240 min. Denkwerk: 45-90 min. Deep work: 90-120 min. Overleg zonder eindtijd: 60 min. Dagcheck: 15 min.\n\nTijdsdruk zichtbaar maken:\n- Als Clara zegt dat iets krap wordt of niet past, moet dat zichtbaar zijn in clara_agenda via overlap, conflict of een needs_time item plus high scheduling_need.\n- Tijdsdruk nooit alleen in summary, attention of scheduling_needs laten staan.\n\nDagafsluiting:\n- Maak day_review.review_needed=true zodra er geplande of potlood-acties zijn.\n- Stel meestal 17:30 of 18:00 voor als suggested_time, tenzij input iets anders noemt.\n- day_review.now_first_move: stuur op de eerste zinvolle actie (waarom nu), niet de agendalijst herhalen.\n- day_review.items_to_check: max. twee checkzinnen (kwaliteit/moment), geen taak- of agendakopie.\n- day_review.review_prompt: één concrete einde-dagvraag over afronden versus doorschuiven.\n\nDashboardrust:\n- Suggestions alleen tonen als ze echt helpen en aan een keuze hangen.\n- Project_signals alleen vullen met echte projectcontext, beslissingen of inhoudelijke projectinformatie, niet met gewone projecttaken.${multiProjectPlanningBlock}${promptAddenda}${buildCompactAcceptanceAndSituational(intent)}`;

    const structuredLab =
      intent.attentionOnly ||
      intent.weekDirectionOnly ||
      todayOnlyReplan ||
      intent.wantsProjectbrainPlanning ||
      (Array.isArray(labStateRaw?.open_threads) && labStateRaw.open_threads.length > 0) ||
      isStartup
        ? `\n\n## lab_state (gestructureerd JSON, leidend naast vrije tekst)\n${JSON.stringify(labStateRaw ?? {})}\n`
        : '';

    const userPrompt = `Projectbrain-context uit GitHub:\n---\n${projectbrainContext}\n---\n\nBron: ${source}\n${structuredLab}\nGebruikersinput / lokale Clara Lab-context:\n---\n${text}\n---`;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL_ANALYZE || process.env.OPENAI_MODEL || 'gpt-5.5',
        input: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        text: { format: { type: 'json_schema', name: schema.name, schema: schema.schema, strict: true } }
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: 'OpenAI request failed', detail: data });

    const outputText = getOutputText(data);
    if (!outputText) return res.status(500).json({ error: 'No structured output returned', raw: data });

    let parsed = JSON.parse(outputText);
    parsed.open_threads = mergeOpenThreads(labStateRaw?.open_threads, parsed.open_threads);
    parsed = applyOpenThreadReply(parsed, labStateRaw, text, now);
    parsed = ensureExplicitWeekendAppointment(parsed, text, now);
    parsed = normalizeDashboardAttention(parsed);
    parsed = sanitizeClaraAgenda(parsed, { requestedDays });
    parsed = enforceTimeAwarePlanning(parsed, now, text);

    if (isProjectPlanRequest && !isStartup) {
      // Keep agenda truth unchanged; no automatic planning in this mode.
      if (Array.isArray(labStateRaw?.agenda)) parsed.clara_agenda = JSON.parse(JSON.stringify(labStateRaw.agenda));
      parsed.scheduling_needs = [];
      parsed.proposed_items = [];
      if (!parsed.dashboard_output) parsed.dashboard_output = { today: [], attention: [], waiting_for: [], agenda: [], project_signals: [], suggestions: [] };
      if (!Array.isArray(parsed.dashboard_output.suggestions)) parsed.dashboard_output.suggestions = [];
      if (!String(parsed.summary || '').trim()) parsed.summary = 'Ik heb een projectplan-voorstel gemaakt. Loop het even na; daarna kun je het in potlood inplannen.';
    }

    const timeCritical = hasTimeCriticalBypassAttention(text);
    if (intent.noPlanning && !isStartup) {
      parsed = enforceNoPlanningOutput(parsed, { projectbrainContext, meaningfulRawProjects, today });
    } else if (intent.attentionOnly && !timeCritical && !isStartup) {
      if (Array.isArray(labStateRaw?.agenda) && labStateRaw.agenda.length) {
        parsed.clara_agenda = JSON.parse(JSON.stringify(labStateRaw.agenda));
      } else {
        parsed.clara_agenda = (parsed.clara_agenda || []).filter(
          (i) => !(i?.start_time && /^\d{1,2}:[0-5]\d$/.test(String(i.start_time)))
        );
      }
    } else if (intent.weekDirectionOnly && !isStartup) {
      if (Array.isArray(labStateRaw?.agenda) && labStateRaw.agenda.length) {
        parsed.clara_agenda = JSON.parse(JSON.stringify(labStateRaw.agenda));
      } else {
        parsed.clara_agenda = (parsed.clara_agenda || []).filter(
          (i) => !(i?.start_time && /^\d{1,2}:[0-5]\d$/.test(String(i.start_time)))
        );
      }
    } else if (todayOnlyReplan) {
      parsed = mergePreserveAgendaOtherDays(parsed, labStateRaw, today);
    }

    if (intent.noPlanning && !isStartup) {
      parsed = enforceNoPlanningOutput(parsed, { projectbrainContext, meaningfulRawProjects, today });
    } else {
      parsed = sanitizeClaraAgenda(parsed, { requestedDays });
    }
    if (singleExplicitProject) {
      parsed = enforceSingleProjectOutput(parsed, singleExplicitProject);
    }

    const explicitMulti = detectExplicitMultiProjectPlanningRequest(text, requestedDays);
    const projectbrainPlan = detectProjectbrainPlanningRequest(text, requestedDays);
    if (
      !singleExplicitProject &&
      !isStartup &&
      !intent.attentionOnly &&
      !intent.noPlanning &&
      !intent.weekDirectionOnly &&
      (explicitMulti || projectbrainPlan) &&
      projectbrainContextUsable(projectbrainContext) &&
      countTimedAgendaBlocksInDays(parsed.clara_agenda, requestedDays) === 0
    ) {
      parsed = ensurePencilMultiProjectAgenda(parsed, requestedDays);
      parsed = sanitizeClaraAgenda(parsed, { requestedDays });
      parsed = enforceTimeAwarePlanning(parsed, now, text);
    }
    parsed = normalizeDashboardAttention(parsed);
    if (isStartup) {
      parsed = enforceStartupRawProjectsOutput(parsed, meaningfulRawProjects);
      if (meaningfulRawProjects.length && countTimedAgendaBlocksInDays(parsed.clara_agenda, requestedDays) === 0) {
        parsed = ensureRawStartupPencilAgenda(parsed, meaningfulRawProjects, today);
        parsed = sanitizeClaraAgenda(parsed, { requestedDays });
        parsed = enforceTimeAwarePlanning(parsed, now, text);
        parsed = enforceStartupRawProjectsOutput(parsed, meaningfulRawProjects);
      }
    }
    if (singleExplicitProject) {
      parsed = enforceSingleProjectOutput(parsed, singleExplicitProject);
      if (!intent.noPlanning) {
        parsed = ensureSingleProjectPlanningConsistency(parsed, singleExplicitProject, text, today);
      }
      parsed = enforceSingleProjectOutput(parsed, singleExplicitProject);
      parsed = normalizeDashboardAttention(parsed);
    }
    parsed = enforceTimeAwarePlanning(parsed, now, text);
    if (isStartup) parsed = enforceStartupAgendaMetadata(parsed, today, tomorrow);
    if (intent.noPlanning && !isStartup) {
      parsed = enforceNoPlanningOutput(parsed, { projectbrainContext, meaningfulRawProjects, today });
    } else {
      parsed = sanitizeDayReview(parsed, today);
    }
    if (isStartup) {
      parsed = enforceStartupRawProjectsOutput(parsed, meaningfulRawProjects);
    }
    if (singleExplicitProject) {
      parsed = enforceSingleProjectOutput(parsed, singleExplicitProject);
      parsed = stripPlanningClaimsWithoutAgenda(parsed);
    }
    if (intent.noPlanning && !isStartup) {
      parsed = enforceNoPlanningOutput(parsed, { projectbrainContext, meaningfulRawProjects, today });
    }
    if (openThreadReplyThisTurn && !intent.noPlanning) {
      parsed.day_review = {
        review_needed: false,
        suggested_time: null,
        items_to_check: [],
        rollover_candidates: [],
        review_prompt: '',
        now_first_move: ''
      };
      parsed.dashboard_output = parsed.dashboard_output || { today: [], attention: [], waiting_for: [], agenda: [], project_signals: [], suggestions: [] };
      parsed.dashboard_output.suggestions = [];
    }
    parsed = clearPastDayReviewTime(parsed, now);
    if (isStartup && parsed.summary) {
      parsed.summary = String(parsed.summary).replace(/\s+/g, ' ').trim().slice(0, 320);
    }
    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({ error: 'Analyze failed', message: error?.message || String(error) });
  }
}
