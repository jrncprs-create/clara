export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { input = '', source = 'manual' } = req.body || {};
    const text = String(input || '').trim();

    if (!text) {
      return res.status(400).json({ error: 'Missing input' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
    }

    const schema = {
      name: 'clara_core_analysis',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: [
          'summary',
          'signals',
          'proposed_items',
          'dashboard_output',
          'clara_agenda',
          'scheduling_needs',
          'day_review',
          'uncertainties',
          'questions',
          'ignored_noise'
        ],
        properties: {
          summary: { type: 'string', description: 'Korte Nederlandse samenvatting van wat Clara begrijpt.' },
          signals: {
            type: 'array',
            description: 'Betekenisvolle signalen die Clara in de input ziet.',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'kind', 'reason', 'confidence'],
              properties: {
                title: { type: 'string' },
                kind: { type: 'string', enum: ['action_for_jeroen', 'waiting_for_other', 'appointment_or_deadline', 'project_context', 'note', 'decision', 'risk_or_blocker', 'suggestion', 'noise'] },
                reason: { type: 'string' },
                confidence: { type: 'number', minimum: 0, maximum: 1 }
              }
            }
          },
          proposed_items: {
            type: 'array',
            description: 'Items die Clara zou willen opslaan of klaarzetten.',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'type', 'project', 'status', 'date', 'time', 'description', 'source', 'confidence'],
              properties: {
                title: { type: 'string' },
                type: { type: 'string', enum: ['task', 'appointment', 'waiting_for', 'note', 'project_context', 'decision', 'reminder', 'attention'] },
                project: { type: ['string', 'null'] },
                status: { type: 'string', enum: ['proposed', 'needs_review', 'ready_to_save', 'ignore'] },
                date: { type: ['string', 'null'], description: 'YYYY-MM-DD als expliciet of logisch afleidbaar, anders null.' },
                time: { type: ['string', 'null'], description: 'HH:MM alleen als expliciet aanwezig, anders null.' },
                description: { type: 'string' },
                source: { type: 'string' },
                confidence: { type: 'number', minimum: 0, maximum: 1 }
              }
            }
          },
          dashboard_output: {
            type: 'object',
            additionalProperties: false,
            required: ['today', 'attention', 'waiting_for', 'agenda', 'project_signals', 'suggestions'],
            properties: {
              today: { type: 'array', items: { type: 'string' } },
              attention: { type: 'array', items: { type: 'string' } },
              waiting_for: { type: 'array', items: { type: 'string' } },
              agenda: { type: 'array', items: { type: 'string' } },
              project_signals: { type: 'array', items: { type: 'string' } },
              suggestions: { type: 'array', items: { type: 'string' } }
            }
          },
          clara_agenda: {
            type: 'array',
            description: 'Clara Agenda is de agenda-waarheid. Externe agenda’s zijn bronnen, Clara Agenda beslist wat gepland of bevestigd is.',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'kind', 'date', 'start_time', 'end_time', 'estimated_duration_minutes', 'status', 'project', 'source', 'reason', 'confirmation_required', 'confidence'],
              properties: {
                title: { type: 'string' },
                kind: { type: 'string', enum: ['appointment', 'planned_task', 'focus_block', 'deadline', 'reminder', 'external_busy', 'day_review'] },
                date: { type: ['string', 'null'], description: 'YYYY-MM-DD of null.' },
                start_time: { type: ['string', 'null'], description: 'HH:MM of null.' },
                end_time: { type: ['string', 'null'], description: 'HH:MM of null.' },
                estimated_duration_minutes: { type: ['number', 'null'] },
                status: { type: 'string', enum: ['confirmed', 'pencil', 'needs_time', 'external_busy', 'conflict', 'done', 'cancelled'] },
                project: { type: ['string', 'null'] },
                source: { type: 'string' },
                reason: { type: 'string' },
                confirmation_required: { type: 'boolean' },
                confidence: { type: 'number', minimum: 0, maximum: 1 }
              }
            }
          },
          scheduling_needs: {
            type: 'array',
            description: 'Dingen die nog gepland moeten worden of waar Clara een potloodblok voor mag zoeken.',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'preferred_date', 'estimated_duration_minutes', 'priority', 'reason'],
              properties: {
                title: { type: 'string' },
                preferred_date: { type: ['string', 'null'] },
                estimated_duration_minutes: { type: ['number', 'null'] },
                priority: { type: 'string', enum: ['low', 'normal', 'high'] },
                reason: { type: 'string' }
              }
            }
          },
          day_review: {
            type: 'object',
            additionalProperties: false,
            required: ['review_needed', 'suggested_time', 'review_prompt', 'items_to_check', 'rollover_candidates'],
            properties: {
              review_needed: { type: 'boolean' },
              suggested_time: { type: ['string', 'null'], description: 'HH:MM of null.' },
              review_prompt: { type: 'string' },
              items_to_check: { type: 'array', items: { type: 'string' } },
              rollover_candidates: { type: 'array', items: { type: 'string' } }
            }
          },
          uncertainties: { type: 'array', items: { type: 'string' } },
          questions: { type: 'array', description: 'Alleen vragen stellen als Clara zonder antwoord echt iets belangrijks verkeerd kan opslaan.', items: { type: 'string' } },
          ignored_noise: { type: 'array', description: 'Dingen die Clara bewust niet op het dashboard zou zetten.', items: { type: 'string' } }
        }
      },
      strict: true
    };

    const systemPrompt = `Je bent Clara Core Lab v0.5: de interpretatielaag achter Clara.\n\nClara is vooral een assistent. Het dashboard is alleen het spoor/geheugen dat Clara vult. Clara Agenda is de agenda-waarheid. Externe agenda’s zijn hooguit bronnen, blokkades of synchronisatie.\n\nBelangrijke regels:\n- Antwoord altijd in het Nederlands.\n- Zet niet alles om in taken.\n- Toon alleen betekenisvolle dingen op dashboard-output.\n- Verzin geen tijden. Als er geen expliciete tijd is: time=null.\n- Verzin geen datum behalve bij duidelijke relatieve woorden zoals morgen/vandaag/overmorgen/volgende week/donderdag/vrijdag.\n- Gebruik datumcontext: vandaag is ${new Date().toISOString().slice(0, 10)}.\n- Bij twijfel: zet status op needs_review of pencil en benoem onzekerheid.\n- Stel zo min mogelijk vragen. Vraag alleen als het belangrijk is voor correcte opslag.\n- Project mag null zijn als het niet duidelijk is.\n- Bron is: ${source}.\n\nCruciaal onderscheid:\n- action_for_jeroen = iemand wacht op Jeroen, Jeroen moet reageren, Jeroen moet iets doen, of er ligt actie bij Jeroen.\n- waiting_for_other = Jeroen wacht op iemand anders. Voorbeeld: 'Wachten op offerte van Jan' betekent waiting_for_other.\n- Zet iets alleen in dashboard_output.waiting_for als Jeroen echt op iemand anders wacht. Als iemand op Jeroen wacht, zet het in attention.\n- Als een situatie beide kanten heeft, bijvoorbeeld 'Jan heeft nog niks gestuurd, daar moet ik achteraan', maak dan één proposed_item met type='waiting_for' en zet het óók kort in dashboard_output.attention als actie.\n\nAandacht:\n- dashboard_output.attention is voor alle concrete acties die Jeroen binnenkort moet zien of doen.\n- Laat duidelijke acties niet verdwijnen uit attention omdat ze ook proposed_items zijn.\n- Als er veel acties zijn, houd attention kort maar volledig: maximaal 5 kernregels.\n\nClara Agenda Core:\n- clara_agenda is Clara’s eigen agenda-waarheid.\n- confirmed = duidelijke afspraak met datum en tijd of expliciet bevestigd blok.\n- pencil = Clara’s potloodvoorstel: logisch ingepland of klaar om met één klik te bevestigen.\n- needs_time = er is wel iets te plannen, maar tijd ontbreekt en Clara moet nog een plek zoeken.\n- external_busy = bezette tijd uit externe agenda, niet per se inhoudelijk Clara-item.\n- Een taak met datum maar zonder tijd is geen confirmed agenda-item. Zet die als planned_task met status pencil of needs_time.\n- Een echt overleg met datum en tijd is appointment confirmed.\n- Een 'blok vrijhouden' zonder begintijd/eindtijd is focus_block met status pencil of needs_time, nooit confirmed.\n- Schat duur praktisch: korte mail/follow-up 15 min, belletje 30 min, bestellen/regelen 30-45 min, denkblok/deep work 90-120 min, overleg zonder eindtijd 60 min.\n- Potloodblokken moeten confirmation_required=true hebben. Confirmed echte afspraken mogen confirmation_required=false krijgen.\n\nDagafsluiting:\n- Maak day_review.review_needed=true zodra er geplande of potlood-acties zijn.\n- Stel meestal 17:30 of 18:00 voor als suggested_time, tenzij input iets anders noemt.\n- day_review vraagt niet vaag 'is alles gelukt?', maar checkt concrete items.\n- rollover_candidates zijn acties die makkelijk naar morgen/doorschuiven kunnen als ze niet lukken.\n\nDashboardrust:\n- Suggestions alleen tonen als ze echt helpen. Geef geen generieke suggesties zoals 'koppel aan project indien relevant'.\n- Project_signals alleen vullen met echte projectcontext, beslissingen, richtingsverandering of inhoudelijke projectinformatie. Niet met gewone projecttaken.\n- Een idee zoals 'lichtwezens reageren als schuwe nachtdieren' is wél project_context en mag bij project_signals.\n\nProjectonzekerheid:\n- Als een project onzeker is, mag het item nog steeds als aandachtspunt bestaan met project=null en status=needs_review.\n- Projectonzekerheid mag een uncertainty zijn, maar moet de actie niet blokkeren.`;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        text: { format: { type: 'json_schema', name: schema.name, schema: schema.schema, strict: true } }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: 'OpenAI request failed', detail: data });
    }

    const outputText = data.output_text || data.output?.flatMap(item => item.content || []).find(part => part.type === 'output_text')?.text;

    if (!outputText) {
      return res.status(500).json({ error: 'No structured output returned', raw: data });
    }

    return res.status(200).json(JSON.parse(outputText));
  } catch (error) {
    return res.status(500).json({ error: 'Analyze failed', message: error?.message || String(error) });
  }
}
