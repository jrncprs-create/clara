export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const body = req.body || {};

    if (!body.type) {
      return res.status(400).json({ error: "missing_type" });
    }

    const item = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      title: body.title || "",
      project: body.project || "",
      status: body.status || "nieuw",
      date: body.date || "",
      time: body.time || "",
      noteType: body.noteType || "",
      raw: body.raw || ""
    };

    return res.status(200).json({
      success: true,
      received: {
        type: body.type,
        item
      }
    });
  } catch (e) {
    return res.status(500).json({
      error: "failed_to_process_request",
      details: e.message
    });
  }
}
