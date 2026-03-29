export default async function handler(req, res) {
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
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
- denk vanuit Bureau Begeister als gedeelde praktijk van Jeroen en Marlon
- focus op werk, planning, projecten, kansen, afspraken en relevante context
`
          },
          {
            role: "user",
            content: "Geef een actueel dashboardoverzicht voor Bureau Begeister met agenda, taken en notities."
          }
        ]
      })
    });

    const data = await response.json();
    const text = data.output[0].content[0].text;

    res.status(200).json(JSON.parse(text));
  } catch (e) {
    res.status(500).json({ error: "failed", details: e.message });
  }
}
