let memory = {
  inbox: [],
  tasks: [],
  projects: [],
  agenda: [],
  focus: []
};

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const body = req.body;

    if (!body || !body.type) {
      return res.status(400).json({ error: "invalid_body" });
    }

    if (body.type === "task") {
      memory.tasks.push({
        title: body.title || "",
        project: body.project || "",
        status: body.status || "nieuw"
      });
    }

    if (body.type === "agenda") {
      memory.agenda.push({
        title: body.title || "",
        date: body.date || "",
        time: body.time || ""
      });
    }

    if (body.type === "note") {
      memory.projects.push({
        title: body.title || "",
        type: body.noteType || "notitie"
      });
    }

    res.status(200).json({ success: true, memory });

  } catch (e) {
    res.status(500).json({
      error: "failed_to_write_data",
      details: e.message
    });
  }
}
