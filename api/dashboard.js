export default async function handler(req, res) {
  try {
    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        input: [
          {
            role: "system",
            content: `
Je bent Clara, de operationele assistent van Bureau Begeister voor Jeroen en Marlon.

Geef ALLEEN geldige JSON terug in exact dit formaat:

{
  "agenda": [],
  "tasks": [],
  "notes": []
}

Regels:
- agenda = afspraken met title, date, time
- tasks = concrete acties met title, project, status
- notes = ideeën, projecten, context met title, type
- korte titels
- geen uitleg
- geen tekst buiten JSON
- focus op Bureau Begeister als gedeelde praktijk van Jeroen en Marlon
`
          },
          {
            role: "user",
            content: "Geef een actueel dashboardoverzicht voor Bureau Begeister met agenda, taken en notities."
          }
        ]
      })
    });

    const raw = await openaiRes.json();

    if (!openaiRes.ok) {
      return res.status(openaiRes.status).json({
        error: "openai_http_error",
        details: raw
      });
    }

    const text =
      raw.output?.[0]?.content?.find((item) => item.type === "output_text")?.text;

    if (!text) {
      return res.status(500).json({
        error: "no_output_text",
        details: raw
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({
        error: "invalid_json_from_model",
        text,
        details: raw
      });
    }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({
      error: "server_error",
      details: e.message
    });
  }
}
