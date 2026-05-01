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
          'uncertainties',
          'questions',
          'ignored_noise'
        ],
        properties: {
          summary: {
            type: 'string',
            description: 'Korte Nederlandse samenvatting van wat Clara begrijpt.'
          },
          signals: {
            type: 'array',
            description: 'Betekenisvolle signalen die Clara in de input ziet.',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'kind', 'reason', 'confidence'],
              properties: {
                title: { type: 'string' },
                kind: {
                  type: 'string',
                  enum: ['action_for_jeroen', 'waiting_for_other', 'appointment_or_deadline', 'project_context', 'note', 'decision', 'risk_or_blocker', 'suggestion', 'noise']
                },
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
                type: {
                  type: 'string',
                  enum: ['task', 'appointment', 'waiting_for', 'note', 'project_context', 'decision', 'reminder', 'attention']
                },
                project: { type: ['string', 'null'] },
                status: {
                  type: 'string',
                  enum: ['proposed', 'needs_review', 'ready_to_save', 'ignore']
                },
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
          uncertainties: {
            type: 'array',
            items: { type: 'string' }
          },
          questions: {
            type: 'array',
            description: 'Alleen vragen stellen als Clara zonder antwoord echt iets belangrijks verkeerd kan opslaan.',
            items: { type: 'string' }
          },
          ignored_noise: {
            type: 'array',
            description: 'Dingen die Clara bewust niet op het dashboard zou zetten.',
            items: { type: 'string' }
          }
        }
      },
      strict: true
    };

    const systemPrompt = `Je bent Clara Core Lab: de interpretatielaag achter Clara.\n\nClara is vooral een assistent. Het dashboard is alleen het spoor/geheugen dat Clara vult.\n\nBelangrijke regels:\n- Antwoord altijd in het Nederlands.\n- Zet niet alles om in taken.\n- Toon alleen betekenisvolle dingen op dashboard-output.\n- Verzin geen tijden. Als er geen expliciete tijd is: time=null.\n- Verzin geen datum behalve bij duidelijke relatieve woorden zoals morgen/vandaag/volgende week.\n- Gebruik datumcontext: vandaag is ${new Date().toISOString().slice(0, 10)}.\n- Bij twijfel: zet status op needs_review en benoem onzekerheid.\n- Stel zo min mogelijk vragen. Vraag alleen als het belangrijk is voor correcte opslag.\n- Project mag null zijn als het niet duidelijk is.\n- Bron is: ${source}.\n- Clara leest uiteindelijk mail, agenda en gesprek, maar dit lab analyseert alleen de aangeleverde tekst.\n\nCruciaal onderscheid:\n- action_for_jeroen = iemand wacht op Jeroen, Jeroen moet reageren, Jeroen moet iets doen, of er ligt actie bij Jeroen. Voorbeeld: 'Claire vroeg of ik beschikbaar ben' betekent actie voor Jeroen: Claire beantwoorden.\n- waiting_for_other = Jeroen wacht op iemand anders. Voorbeeld: 'Wachten op offerte van Jan' betekent waiting_for_other.\n- Zet iets alleen in dashboard_output.waiting_for als Jeroen echt op iemand anders wacht. Als iemand op Jeroen wacht, zet het in attention.\n\nProjectonzekerheid:\n- Als een project onzeker is, mag het item nog steeds als aandachtspunt bestaan met project=null en status=needs_review.\n- Maak van projectonzekerheid liever een uncertainty dan een blokkerende suggestie. Clara moet niet suggereren dat Jeroen eerst projectkoppeling moet oplossen voordat hij kan antwoorden.\n- Goede suggestie: 'Koppel dit later aan AFK of een nieuw project.'\n- Slechte suggestie: 'Check eerst het project voordat je antwoordt.'`;

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
        text: {
          format: {
            type: 'json_schema',
            name: schema.name,
            schema: schema.schema,
            strict: true
          }
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'OpenAI request failed',
        detail: data
      });
    }

    const outputText = data.output_text || data.output?.flatMap(item => item.content || []).find(part => part.type === 'output_text')?.text;

    if (!outputText) {
      return res.status(500).json({ error: 'No structured output returned', raw: data });
    }

    return res.status(200).json(JSON.parse(outputText));
  } catch (error) {
    return res.status(500).json({
      error: 'Analyze failed',
      message: error?.message || String(error)
    });
  }
}
