const PROJECTBRAIN_PROJECTS = {
  clara: 'projectbrain/projects/clara.md',
  lalampe: 'projectbrain/projects/lalampe.md',
  begeister: 'projectbrain/projects/begeister.md',
  'afk-landjuweel-amarte': 'projectbrain/projects/afk-landjuweel-amarte.md',
  'clara-core-lab': 'projectbrain/projects/clara-core-lab.md'
};

function getAmsterdamDateInfo() {
  const now = new Date();
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

  return { today, tomorrow };
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

async function loadProjectbrainContext() {
  const token = process.env.PROJECTBRAIN_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  const targetRepo = process.env.PROJECTBRAIN_REPO || 'jrncprs-create/clara';
  const branch = process.env.PROJECTBRAIN_BASE_BRANCH || 'main';

  if (!token) return 'Projectbrain-context niet geladen: GitHub token ontbreekt.';

  const [owner, repo] = targetRepo.split('/');
  if (!owner || !repo) return 'Projectbrain-context niet geladen: PROJECTBRAIN_REPO is ongeldig.';

  const parts = await Promise.all(Object.entries(PROJECTBRAIN_PROJECTS).map(async ([project, path]) => {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${encodeURIComponent(branch)}`;
      const file = await githubRequest({ token, url });
      const content = Buffer.from(file.content || '', 'base64').toString('utf8');
      return `## ${project}\nBestand: ${path}\n\n${content}`;
    } catch (error) {
      return `## ${project}\nBestand: ${path}\n\nKon niet laden: ${error.message || String(error)}`;
    }
  }));

  return parts.join('\n\n---\n\n');
}

function getOutputText(data) {
  return data.output_text || data.output?.flatMap(item => item.content || []).find(part => part.type === 'output_text')?.text;
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
  const wantsExplicitTimedPlanning =
    /planning\s+voor|komende\s+\d+|volgende\s+\d+|realistische\s+planning|\bplan\s+(?:vandaag|morgen|deze)/i.test(n) ||
    /maak\s+(?:een\s+)?(?:realistische\s+)?planning/i.test(n) ||
    /\d+\s+dagen.*(?:clara|lalampe|begeister|afk|landjuweel)/i.test(text) ||
    (/\bplan\b/i.test(n) && /omheen|rond|zonder\s+overlap|tussen|daarom|ruimte\s+over/i.test(n)) ||
    (/projectbrain|lopende\s+projecten|uit\s+de\s+projecten/i.test(n) &&
      /planning|plannen|agenda|vandaag|morgen|eerstvolgende|aandacht|dagregie|needs_time|overlap/i.test(n));
  const attentionPrimary =
    /geen\s+agenda|niet\s+.*\bagenda\b.*vul|alleen\s+weten|alleen\s+aandacht|vooral\s+aandacht|niet\s+alles\s+plannen|wat\s+aandacht\s+nodig/i.test(n);
  const attentionUnlessCritical =
    /tenzij.*tijdkritisch|tijdkritisch/i.test(n) && /geen\s+agenda|niet.*agenda/i.test(n);
  const attentionOnly =
    !wantsExplicitTimedPlanning && (attentionPrimary || attentionUnlessCritical);
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { input = '', source = 'manual', lab_state: labStateRaw = null } = req.body || {};
    const text = String(input || '').trim();
    if (!text) return res.status(400).json({ error: 'Missing input' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });

    const isStartup = source === 'projectbrain_startup';
    const { today, tomorrow } = getAmsterdamDateInfo();
    const requestedDays = isStartup ? [today, addDaysIso(today, 1)] : detectRequestedPlanningDays(text, today);
    const projectbrainContext = await loadProjectbrainContext();
    let intent = inferUserIntentHints(text);
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

    const startupAppendix = isStartup
      ? `\n\n**Automatische Core Lab-start (bron projectbrain_startup):**\n- Rustige conceptplanning voor ${today}; gebruik ${tomorrow} alleen als ${today} te vol wordt.\n- Max. één eerstvolgende potloodblok per actief project (o.a. clara, lalampe, begeister, afk-landjuweel-amarte, clara-core-lab).\n- Max. 3–5 getimede potloodblokken totaal; status pencil, confirmation_required true; zet op elk blok source exact de string \`projectbrain_startup\`.\n- Duurrichtlijn: clara-core-lab 60–90 min; lalampe, begeister, afk elk 45–75 min; optioneel één korte dagcheck 10–15 min.\n- Geen harde externe afspraken verzinnen; geen confirmed appointments tenzij gebruiker ze letterlijk noemde.\n- Vandaag niet overvol; overlap vermijden; wat niet past → needs_time + scheduling_needs.\n- Aandacht: concrete checks (mobiel/Marlon, LaLampe materiaal, Begeister-grens, AFK ecologie); geen systeem- of overlap-instructies.\n- summary: max. twee korte zinnen.\n`
      : '';

    const promptAddenda =
      buildDateDisciplineAppendix(today, tomorrow, todayOnlyReplan) +
      (intent.attentionOnly ? buildAttentionOnlyAppendix(labStateRaw) : '') +
      (intent.weekDirectionOnly ? buildWeekDirectionAppendix(projectbrainContext) : '') +
      ((intent.wantsProjectbrainPlanning || isStartup) ? buildProjectbrainPlanningAppendix(today, tomorrow, requestedDays) : '') +
      startupAppendix;

    const schema = {
      name: 'clara_core_analysis',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['summary','signals','proposed_items','dashboard_output','clara_agenda','scheduling_needs','day_review','uncertainties','questions','ignored_noise'],
        properties: {
          summary: { type: 'string' },
          signals: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title','kind','reason','confidence'], properties: { title: { type: 'string' }, kind: { type: 'string', enum: ['action_for_jeroen','waiting_for_other','appointment_or_deadline','project_context','note','decision','risk_or_blocker','suggestion','noise'] }, reason: { type: 'string' }, confidence: { type: 'number', minimum: 0, maximum: 1 } } } },
          proposed_items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title','type','project','status','date','time','description','source','confidence'], properties: { title: { type: 'string' }, type: { type: 'string', enum: ['task','appointment','waiting_for','note','project_context','decision','reminder','attention'] }, project: { type: ['string','null'] }, status: { type: 'string', enum: ['proposed','needs_review','ready_to_save','ignore'] }, date: { type: ['string','null'] }, time: { type: ['string','null'] }, description: { type: 'string' }, source: { type: 'string' }, confidence: { type: 'number', minimum: 0, maximum: 1 } } } },
          dashboard_output: { type: 'object', additionalProperties: false, required: ['today','attention','waiting_for','agenda','project_signals','suggestions'], properties: { today: { type: 'array', items: { type: 'string' } }, attention: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['text','kind'], properties: { text: { type: 'string' }, kind: { type: 'string', enum: ['risico','keuze','check','wacht','past_niet','project'] } } } }, waiting_for: { type: 'array', items: { type: 'string' } }, agenda: { type: 'array', items: { type: 'string' } }, project_signals: { type: 'array', items: { type: 'string' } }, suggestions: { type: 'array', items: { type: 'string' } } } },
          clara_agenda: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title','kind','date','start_time','end_time','estimated_duration_minutes','status','project','source','reason','confirmation_required','confidence'], properties: { title: { type: 'string' }, kind: { type: 'string', enum: ['appointment','planned_task','focus_block','deadline','reminder','external_busy','day_review'] }, date: { type: ['string','null'] }, start_time: { type: ['string','null'] }, end_time: { type: ['string','null'] }, estimated_duration_minutes: { type: ['number','null'] }, status: { type: 'string', enum: ['confirmed','pencil','needs_time','external_busy','conflict','done','cancelled'] }, project: { type: ['string','null'] }, source: { type: 'string' }, reason: { type: 'string' }, confirmation_required: { type: 'boolean' }, confidence: { type: 'number', minimum: 0, maximum: 1 } } } },
          scheduling_needs: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title','preferred_date','estimated_duration_minutes','priority','reason'], properties: { title: { type: 'string' }, preferred_date: { type: ['string','null'] }, estimated_duration_minutes: { type: ['number','null'] }, priority: { type: 'string', enum: ['low','normal','high'] }, reason: { type: 'string' } } } },
          day_review: { type: 'object', additionalProperties: false, required: ['review_needed','suggested_time','review_prompt','items_to_check','rollover_candidates','now_first_move'], properties: { review_needed: { type: 'boolean' }, suggested_time: { type: ['string','null'] }, review_prompt: { type: 'string' }, items_to_check: { type: 'array', items: { type: 'string' } }, rollover_candidates: { type: 'array', items: { type: 'string' } }, now_first_move: { type: 'string' } } },
          uncertainties: { type: 'array', items: { type: 'string' } },
          questions: { type: 'array', items: { type: 'string' } },
          ignored_noise: { type: 'array', items: { type: 'string' } }
        }
      },
      strict: true
    };

    const multiProjectPlanningBlock =
      requestedDays.length >= 2 && !intent.attentionOnly && !intent.weekDirectionOnly
        ? `\n\nMeerdaagse projectplanning (verplicht wanneer de gebruiker dit zo vraagt, of bij automatische startup):\n- Bij startup of expliciete meerdaagse vraag: als Projectbrain-context technisch beschikbaar is (geen token-/repo-fouttekst), mag clara_agenda voor de gevraagde dagen niet leeg blijven zonder getimede potloodblokken.\n- Zet per relevant project minstens één werksessie (kind focus_block of planned_task, status pencil, confirmation_required true, duur volgens appendix) verdeeld over: ${requestedDays.join(', ')}.\n- Geen overlap tussen potloodblokken op dezelfde dag.\n- Gebruik Projectbrain voor thema/hoofdlijn in titel en reason; geen 1:1 dump van Markdown-secties als takenlijst.\n- Verzin geen externe afspraken of bevestigde meetings met derden.\n- Parkeer twijfel en ontbrekende feiten in dashboard_output.attention en uncertainties.\n`
        : '';

    const systemPrompt = `Je bent Clara Core Lab: de interpretatielaag achter Clara.\n\nVandaag is ${today}. Morgen is ${tomorrow}. Gebruik deze datums als absolute basis voor relatieve woorden zoals vandaag, morgen en vrijdag.\n\nClara is vooral een AI-assistent met een dagagenda als spoor/geheugen. De UI heeft een sterk visuele messenger-chat. Gebruik de summary als korte, menselijke Clara-reactie: 1 tot 3 rustige zinnen, geen rapporttaal.\n\nJe krijgt naast de lokale Clara Lab State ook Projectbrain-context uit GitHub. Behandel Projectbrain als projectgeheugen: gebruik het om projecten, beslissingen, open acties en onzekerheden beter te begrijpen. Zet Projectbrain-informatie niet automatisch als taak op vandaag, tenzij de gebruiker daar expliciet om vraagt.\n\nPlanningskern:\n- Clara moet een realistische planning maken, niet alleen taken herkennen.\n- Verdeel werk over beschikbare dagen wanneer de gebruiker om meerdere dagen vraagt.\n- Gevraagde planningsdagen in deze input: ${requestedDays.join(', ')}.\n- Plan potloodtaken, focusblokken en reminders nooit bewust over elkaar heen.\n- Overlap is alleen toegestaan voor harde afspraken die echt botsen, of wanneer iets onmogelijk past.\n- Als iets niet past: zet status needs_time en benoem waarom.\n\nActieregels:\n- Als de input een eerdere Clara-analyse bevat plus een nieuw bericht of aangeklikte actie, werk dan voort op die eerdere analyse.\n- Als de gebruiker vraagt 'los het op' of een suggestieknop aanklikt, pas de planning concreet aan. Vraag niet eerst om toestemming. Maak een beste potloodoplossing en laat resterende conflicten zichtbaar.\n- Als je iets hebt aangepast, benoem kort wat je deed.\n\nAgendaweergave-regels:\n- De agenda loopt van 10:00 tot 23:00.\n- De UI splitst die in Dag 10:00–19:00 en Avond 19:00–24:00.\n- Items zonder starttijd, needs_time of zeer lange blokken mogen boven de agenda als dagbrede/all-day items verschijnen.\n- Zet echte tijdsblokken met start_time en end_time in clara_agenda zodat ze zichtbaar zijn.\n\nBasisregels:\n- Antwoord altijd in het Nederlands.\n- Dashboard today mag alleen items tonen die vandaag (${today}) spelen. Morgen-items horen niet in today.\n- action_for_jeroen = Jeroen moet iets doen of iemand wacht op Jeroen.\n- waiting_for_other = Jeroen wacht op iemand anders.\n- Tijd die in dashboard_output.agenda staat moet ook in clara_agenda staan.\n\nHarde afspraken en conflicten:\n- Een afspraak met datum en tijd is appointment confirmed, confirmation_required=false.\n- Als twee confirmed afspraken overlappen, zet allebei in clara_agenda. De overlappende afspraak mag status='conflict' krijgen als dat nodig is om het zichtbaar te maken, maar hij blijft inhoudelijk een harde afspraak.\n- Conflicten nooit gladstrijken of verbergen.\n\nTaken zonder tijd verspreiden:\n- Als input zegt dat taken morgen/vandaag moeten maar geen tijd geeft, mag Clara vrije ruimtes zoeken tussen harde afspraken en daar planned_task pencil plaatsen.\n- Zet zulke taken niet allemaal onder needs_time als er duidelijke dagruimte is.\n- Plaats korte taken liefst eerst na een overleg en lange blokken daarna, tenzij de input een andere prioriteit of deadline noemt.\n- Pencil betekent voorstel: confirmation_required=true.\n\nEerlijke duurregels:\n- Schat duur op basis van de aard van de taak, niet op basis van beschikbare ruimte.\n- Maak taken niet korter om ze passend te krijgen.\n- Korte follow-up: 10-15 min. Simpel antwoord: 15-25 min. Zorgvuldige mail/inhoudelijke reactie: 25-40 min. Bestellen/regelen: 30-45 min. Administratie/ordenen: 45-90 min. Btw-administratie/financieel uitzoeken: 120-180 min. Nieuw concept schrijven: 120-240 min. Denkwerk: 45-90 min. Deep work: 90-120 min. Overleg zonder eindtijd: 60 min. Dagcheck: 15 min.\n\nTijdsdruk zichtbaar maken:\n- Als Clara zegt dat iets krap wordt of niet past, moet dat zichtbaar zijn in clara_agenda via overlap, conflict of een needs_time item plus high scheduling_need.\n- Tijdsdruk nooit alleen in summary, attention of scheduling_needs laten staan.\n\nDagafsluiting:\n- Maak day_review.review_needed=true zodra er geplande of potlood-acties zijn.\n- Stel meestal 17:30 of 18:00 voor als suggested_time, tenzij input iets anders noemt.\n- day_review.now_first_move: stuur op de eerste zinvolle actie (waarom nu), niet de agendalijst herhalen.\n- day_review.items_to_check: max. twee checkzinnen (kwaliteit/moment), geen taak- of agendakopie.\n- day_review.review_prompt: één concrete einde-dagvraag over afronden versus doorschuiven.\n\nDashboardrust:\n- Suggestions alleen tonen als ze echt helpen en aan een keuze hangen.\n- Project_signals alleen vullen met echte projectcontext, beslissingen of inhoudelijke projectinformatie, niet met gewone projecttaken.${multiProjectPlanningBlock}${promptAddenda}${buildCompactAcceptanceAndSituational(intent)}`;

    const structuredLab =
      intent.attentionOnly ||
      intent.weekDirectionOnly ||
      todayOnlyReplan ||
      intent.wantsProjectbrainPlanning ||
      isStartup
        ? `\n\n## lab_state (gestructureerd JSON, leidend naast vrije tekst)\n${JSON.stringify(labStateRaw ?? {})}\n`
        : '';

    const userPrompt = `Projectbrain-context uit GitHub:\n---\n${projectbrainContext}\n---\n\nBron: ${source}\n${structuredLab}\nGebruikersinput / lokale Clara Lab-context:\n---\n${text}\n---`;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        input: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        text: { format: { type: 'json_schema', name: schema.name, schema: schema.schema, strict: true } }
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: 'OpenAI request failed', detail: data });

    const outputText = getOutputText(data);
    if (!outputText) return res.status(500).json({ error: 'No structured output returned', raw: data });

    let parsed = JSON.parse(outputText);
    parsed = normalizeDashboardAttention(parsed);
    parsed = sanitizeClaraAgenda(parsed, { requestedDays });

    const timeCritical = hasTimeCriticalBypassAttention(text);
    if (intent.attentionOnly && !timeCritical && !isStartup) {
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

    parsed = sanitizeClaraAgenda(parsed, { requestedDays });

    const explicitMulti = detectExplicitMultiProjectPlanningRequest(text, requestedDays);
    const projectbrainPlan = detectProjectbrainPlanningRequest(text, requestedDays);
    if (
      !intent.attentionOnly &&
      !intent.weekDirectionOnly &&
      (explicitMulti || projectbrainPlan || (isStartup && projectbrainContextUsable(projectbrainContext))) &&
      projectbrainContextUsable(projectbrainContext) &&
      countTimedAgendaBlocksInDays(parsed.clara_agenda, requestedDays) === 0
    ) {
      parsed = ensurePencilMultiProjectAgenda(parsed, requestedDays);
      parsed = sanitizeClaraAgenda(parsed, { requestedDays });
    }
    parsed = normalizeDashboardAttention(parsed);
    if (isStartup) parsed = enforceStartupAgendaMetadata(parsed, today, tomorrow);
    parsed = sanitizeDayReview(parsed, today);
    if (isStartup && parsed.summary) {
      parsed.summary = String(parsed.summary).replace(/\s+/g, ' ').trim().slice(0, 320);
    }
    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({ error: 'Analyze failed', message: error?.message || String(error) });
  }
}
