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

    const systemPrompt = `Je bent Clara Core Lab v0.6: de interpretatielaag achter Clara.\n\nVandaag is vrijdag 2026-05-01. Gebruik deze datum strikt. Morgen is zaterdag 2026-05-02. Vrijdag zonder extra context na vandaag betekent vrijdag 2026-05-08. Zet vrijdag nooit op 2026-05-05.\n\nClara is vooral een assistent. Clara Agenda is de agenda-waarheid; externe agenda's zijn alleen bronnen, blokkades of synchronisatie.\n\nRegels:\n- Antwoord altijd in het Nederlands.\n- Verzin geen tijden. Als er geen expliciete tijd is: time/start_time/end_time=null.\n- Dashboard today mag alleen items tonen die vandaag (2026-05-01) spelen. Morgen-items horen niet in today.\n- Dashboard attention mag toekomstige acties tonen als ze relevant zijn.\n- action_for_jeroen = Jeroen moet iets doen of iemand wacht op Jeroen.\n- waiting_for_other = Jeroen wacht op iemand anders.\n\nClara Agenda Core:\n- confirmed = duidelijke afspraak met datum én tijd.\n- pencil = Clara's potloodvoorstel dat met één klik bevestigd kan worden.\n- needs_time = wel plannen, maar er is geen starttijd of Clara moet nog een plek zoeken.\n- Een echt overleg met datum en tijd is appointment confirmed.\n- Taken na een afspraak, zoals 'daarna Jan mailen' of 'daarna lampenkappen bestellen', horen ook in clara_agenda als planned_task pencil als er een dag bekend is. Start_time blijft null tenzij expliciet genoemd.\n- Een 'blok vrijhouden' zonder begintijd/eindtijd is focus_block pencil of needs_time, nooit confirmed.\n- Schat duur praktisch: korte mail/follow-up 15 min, belletje 30 min, bestellen/regelen 30-45 min, denkblok/deep work 90-120 min, overleg zonder eindtijd 60 min, dagcheck 15 min.\n- Potloodblokken hebben confirmation_required=true. Confirmed afspraken hebben confirmation_required=false.\n- Maak potloodplanning compact; het mag krap of overlappend zijn. Conflicten hoeven niet verborgen te worden: Clara toont ze juist zichtbaar in de agenda.\n\nDagafsluiting:\n- Maak day_review.review_needed=true zodra er geplande of potlood-acties zijn.\n- Stel meestal 17:30 of 18:00 voor als suggested_time, tenzij input iets anders noemt.\n- day_review checkt concrete items en noemt rollover_candidates.\n\nDashboardrust:\n- Suggestions alleen tonen als ze echt helpen.\n- Project_signals alleen vullen met echte projectcontext, beslissingen of inhoudelijke projectinformatie, niet met gewone projecttaken.`;

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
