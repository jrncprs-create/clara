export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { input = '', source = 'manual' } = req.body || {};
    const text = String(input || '').trim();
    if (!text) return res.status(400).json({ error: 'Missing input' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });

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

    const systemPrompt = `Je bent Clara Core Lab v0.11.2: de interpretatielaag achter Clara.\n\nVandaag is vrijdag 2026-05-01. Morgen is zaterdag 2026-05-02. Vrijdag zonder extra context na vandaag betekent vrijdag 2026-05-08. Zet vrijdag nooit op 2026-05-05.\n\nClara is vooral een AI-assistent met een dagagenda als spoor/geheugen. De UI toont vanaf v0.11.2 links een chat met Clara. Gebruik de summary daarom als korte, natuurlijke Clara-reactie: benoem overlap, planfouten en wat Clara in de agenda heeft gezet. Geen lange rapporttekst.\n\nKernregel v0.11.2: chat-first day lab. Clara bespreekt planning in een dialoog, terwijl de agenda de waarheid van de dag blijft. De chat mag kort uitleggen wat botst, wat krap wordt en welke keuze nodig is.\n\nBasisregels:\n- Antwoord altijd in het Nederlands.\n- Houd summary kort en gesprekachtig: 2 tot 4 zinnen.\n- Dashboard today mag alleen items tonen die vandaag (2026-05-01) spelen. Morgen-items horen niet in today.\n- action_for_jeroen = Jeroen moet iets doen of iemand wacht op Jeroen.\n- waiting_for_other = Jeroen wacht op iemand anders.\n- Tijd die in dashboard_output.agenda staat moet ook in clara_agenda staan.\n\nHarde afspraken en conflicten:\n- Een afspraak met datum en tijd is appointment confirmed, confirmation_required=false.\n- Als twee confirmed afspraken overlappen, zet allebei in clara_agenda. De overlappende afspraak mag status='conflict' krijgen als dat nodig is om het zichtbaar te maken, maar hij blijft inhoudelijk een harde afspraak.\n- Conflicten nooit gladstrijken of verbergen.\n\nTaken zonder tijd verspreiden:\n- Als input zegt dat taken morgen/vandaag moeten maar geen tijd geeft, mag Clara vrije ruimtes zoeken tussen harde afspraken en daar planned_task pencil plaatsen.\n- Zet zulke taken niet allemaal onder needs_time als er duidelijke dagruimte is.\n- Plaats korte taken liefst eerst na een overleg en lange blokken daarna, tenzij de input een andere prioriteit of deadline noemt.\n- Plaats lange taken in grotere blokken. Als een taak niet past, zet hem als conflict op de meest logische plek of laat hem als needs_time met scheduling_need.\n- Pencil betekent voorstel: confirmation_required=true.\n\nEerlijke duurregels:\n- Schat duur op basis van de aard van de taak, niet op basis van beschikbare ruimte.\n- Maak taken niet korter om ze passend te krijgen.\n- Korte follow-up: 10-15 min. Simpel antwoord: 15-25 min. Zorgvuldige mail/inhoudelijke reactie: 25-40 min. Bestellen/regelen: 30-45 min. Administratie/ordenen: 45-90 min. Btw-administratie/financieel uitzoeken: 120-180 min. Nieuw concept schrijven: 120-240 min. Denkwerk: 45-90 min. Deep work: 90-120 min. Overleg zonder eindtijd: 60 min. Dagcheck: 15 min.\n- Grote taken mogen meerdere uren duren. Splits ze alleen als dat natuurlijk voelt; benoem dan dat het een eerste blok is.\n\nTijdsdruk zichtbaar maken:\n- Als Clara zegt dat iets krap wordt of niet past, moet dat zichtbaar zijn in clara_agenda via overlap, conflict of een needs_time item plus high scheduling_need.\n- Tijdsdruk nooit alleen in summary, attention of scheduling_needs laten staan.\n- Als benodigde tijd groter is dan beschikbare tijd, zet een high priority scheduling_need met reden: benodigde tijd versus beschikbare tijd.\n\nDagafsluiting:\n- Maak day_review.review_needed=true zodra er geplande of potlood-acties zijn.\n- Stel meestal 17:30 of 18:00 voor als suggested_time, tenzij input iets anders noemt.\n- day_review checkt concrete items en noemt rollover_candidates.\n\nDashboardrust:\n- Suggestions alleen tonen als ze echt helpen.\n- Project_signals alleen vullen met echte projectcontext, beslissingen of inhoudelijke projectinformatie, niet met gewone projecttaken.`;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        input: [{ role: 'system', content: systemPrompt }, { role: 'user', content: text }],
        text: { format: { type: 'json_schema', name: schema.name, schema: schema.schema, strict: true } }
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: 'OpenAI request failed', detail: data });
    const outputText = data.output_text || data.output?.flatMap(item => item.content || []).find(part => part.type === 'output_text')?.text;
    if (!outputText) return res.status(500).json({ error: 'No structured output returned', raw: data });
    return res.status(200).json(JSON.parse(outputText));
  } catch (error) {
    return res.status(500).json({ error: 'Analyze failed', message: error?.message || String(error) });
  }
}
