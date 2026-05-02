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
  const match = normalized.match(/(?:komende|volgende|aanstaande|next)\s+(\d{1,2})\s+dagen/);
  const count = match ? Math.max(1, Math.min(14, Number(match[1]))) : 1;
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { input = '', source = 'manual' } = req.body || {};
    const text = String(input || '').trim();
    if (!text) return res.status(400).json({ error: 'Missing input' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });

    const { today, tomorrow } = getAmsterdamDateInfo();
    const requestedDays = detectRequestedPlanningDays(text, today);
    const projectbrainContext = await loadProjectbrainContext();

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
          dashboard_output: { type: 'object', additionalProperties: false, required: ['today','attention','waiting_for','agenda','project_signals','suggestions'], properties: { today: { type: 'array', items: { type: 'string' } }, attention: { type: 'array', items: { type: 'string' } }, waiting_for: { type: 'array', items: { type: 'string' } }, agenda: { type: 'array', items: { type: 'string' } }, project_signals: { type: 'array', items: { type: 'string' } }, suggestions: { type: 'array', items: { type: 'string' } } } },
          clara_agenda: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title','kind','date','start_time','end_time','estimated_duration_minutes','status','project','source','reason','confirmation_required','confidence'], properties: { title: { type: 'string' }, kind: { type: 'string', enum: ['appointment','planned_task','focus_block','deadline','reminder','external_busy','day_review'] }, date: { type: ['string','null'] }, start_time: { type: ['string','null'] }, end_time: { type: ['string','null'] }, estimated_duration_minutes: { type: ['number','null'] }, status: { type: 'string', enum: ['confirmed','pencil','needs_time','external_busy','conflict','done','cancelled'] }, project: { type: ['string','null'] }, source: { type: 'string' }, reason: { type: 'string' }, confirmation_required: { type: 'boolean' }, confidence: { type: 'number', minimum: 0, maximum: 1 } } } },
          scheduling_needs: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title','preferred_date','estimated_duration_minutes','priority','reason'], properties: { title: { type: 'string' }, preferred_date: { type: ['string','null'] }, estimated_duration_minutes: { type: ['number','null'] }, priority: { type: 'string', enum: ['low','normal','high'] }, reason: { type: 'string' } } } },
          day_review: { type: 'object', additionalProperties: false, required: ['review_needed','suggested_time','review_prompt','items_to_check','rollover_candidates'], properties: { review_needed: { type: 'boolean' }, suggested_time: { type: ['string','null'] }, review_prompt: { type: 'string' }, items_to_check: { type: 'array', items: { type: 'string' } }, rollover_candidates: { type: 'array', items: { type: 'string' } } } },
          uncertainties: { type: 'array', items: { type: 'string' } },
          questions: { type: 'array', items: { type: 'string' } },
          ignored_noise: { type: 'array', items: { type: 'string' } }
        }
      },
      strict: true
    };

    const systemPrompt = `Je bent Clara Core Lab: de interpretatielaag achter Clara.\n\nVandaag is ${today}. Morgen is ${tomorrow}. Gebruik deze datums als absolute basis voor relatieve woorden zoals vandaag, morgen en vrijdag.\n\nClara is vooral een AI-assistent met een dagagenda als spoor/geheugen. De UI heeft een sterk visuele messenger-chat. Gebruik de summary als korte, menselijke Clara-reactie: 1 tot 3 rustige zinnen, geen rapporttaal.\n\nJe krijgt naast de lokale Clara Lab State ook Projectbrain-context uit GitHub. Behandel Projectbrain als projectgeheugen: gebruik het om projecten, beslissingen, open acties en onzekerheden beter te begrijpen. Zet Projectbrain-informatie niet automatisch als taak op vandaag, tenzij de gebruiker daar expliciet om vraagt.\n\nPlanningskern:\n- Clara moet een realistische planning maken, niet alleen taken herkennen.\n- Verdeel werk over beschikbare dagen wanneer de gebruiker om meerdere dagen vraagt.\n- Gevraagde planningsdagen in deze input: ${requestedDays.join(', ')}.\n- Plan potloodtaken, focusblokken en reminders nooit bewust over elkaar heen.\n- Overlap is alleen toegestaan voor harde afspraken die echt botsen, of wanneer iets onmogelijk past.\n- Als iets niet past: zet status needs_time en benoem waarom.\n\nActieregels:\n- Als de input een eerdere Clara-analyse bevat plus een nieuw bericht of aangeklikte actie, werk dan voort op die eerdere analyse.\n- Als de gebruiker vraagt 'los het op' of een suggestieknop aanklikt, pas de planning concreet aan. Vraag niet eerst om toestemming. Maak een beste potloodoplossing en laat resterende conflicten zichtbaar.\n- Als je iets hebt aangepast, benoem kort wat je deed.\n\nAgendaweergave-regels:\n- De agenda loopt van 10:00 tot 23:00.\n- De UI splitst die in Dag 10:00–19:00 en Avond 19:00–24:00.\n- Items zonder starttijd, needs_time of zeer lange blokken mogen boven de agenda als dagbrede/all-day items verschijnen.\n- Zet echte tijdsblokken met start_time en end_time in clara_agenda zodat ze zichtbaar zijn.\n\nBasisregels:\n- Antwoord altijd in het Nederlands.\n- Dashboard today mag alleen items tonen die vandaag (${today}) spelen. Morgen-items horen niet in today.\n- action_for_jeroen = Jeroen moet iets doen of iemand wacht op Jeroen.\n- waiting_for_other = Jeroen wacht op iemand anders.\n- Tijd die in dashboard_output.agenda staat moet ook in clara_agenda staan.\n\nHarde afspraken en conflicten:\n- Een afspraak met datum en tijd is appointment confirmed, confirmation_required=false.\n- Als twee confirmed afspraken overlappen, zet allebei in clara_agenda. De overlappende afspraak mag status='conflict' krijgen als dat nodig is om het zichtbaar te maken, maar hij blijft inhoudelijk een harde afspraak.\n- Conflicten nooit gladstrijken of verbergen.\n\nTaken zonder tijd verspreiden:\n- Als input zegt dat taken morgen/vandaag moeten maar geen tijd geeft, mag Clara vrije ruimtes zoeken tussen harde afspraken en daar planned_task pencil plaatsen.\n- Zet zulke taken niet allemaal onder needs_time als er duidelijke dagruimte is.\n- Plaats korte taken liefst eerst na een overleg en lange blokken daarna, tenzij de input een andere prioriteit of deadline noemt.\n- Pencil betekent voorstel: confirmation_required=true.\n\nEerlijke duurregels:\n- Schat duur op basis van de aard van de taak, niet op basis van beschikbare ruimte.\n- Maak taken niet korter om ze passend te krijgen.\n- Korte follow-up: 10-15 min. Simpel antwoord: 15-25 min. Zorgvuldige mail/inhoudelijke reactie: 25-40 min. Bestellen/regelen: 30-45 min. Administratie/ordenen: 45-90 min. Btw-administratie/financieel uitzoeken: 120-180 min. Nieuw concept schrijven: 120-240 min. Denkwerk: 45-90 min. Deep work: 90-120 min. Overleg zonder eindtijd: 60 min. Dagcheck: 15 min.\n\nTijdsdruk zichtbaar maken:\n- Als Clara zegt dat iets krap wordt of niet past, moet dat zichtbaar zijn in clara_agenda via overlap, conflict of een needs_time item plus high scheduling_need.\n- Tijdsdruk nooit alleen in summary, attention of scheduling_needs laten staan.\n\nDagafsluiting:\n- Maak day_review.review_needed=true zodra er geplande of potlood-acties zijn.\n- Stel meestal 17:30 of 18:00 voor als suggested_time, tenzij input iets anders noemt.\n\nDashboardrust:\n- Suggestions alleen tonen als ze echt helpen en aan een keuze hangen.\n- Project_signals alleen vullen met echte projectcontext, beslissingen of inhoudelijke projectinformatie, niet met gewone projecttaken.`;

    const userPrompt = `Projectbrain-context uit GitHub:\n---\n${projectbrainContext}\n---\n\nBron: ${source}\n\nGebruikersinput / lokale Clara Lab-context:\n---\n${text}\n---`;

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

    const parsed = JSON.parse(outputText);
    return res.status(200).json(sanitizeClaraAgenda(parsed, { requestedDays }));
  } catch (error) {
    return res.status(500).json({ error: 'Analyze failed', message: error?.message || String(error) });
  }
}
