import fs from "fs";
import path from "path";

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const filePath = path.join(process.cwd(), "api", "data", "clara.json");
    const fileData = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(fileData);

    const body = req.body;

    if (!body || !body.type) {
      return res.status(400).json({ error: "invalid_body" });
    }

    if (body.type === "task") {
      data.tasks.push({
        title: body.title || "",
        project: body.project || "",
        status: body.status || "nieuw"
      });
    }

    if (body.type === "agenda") {
      data.agenda.push({
        title: body.title || "",
        date: body.date || "",
        time: body.time || ""
      });
    }

    if (body.type === "note") {
      data.projects.push({
        title: body.title || "",
        type: body.noteType || "notitie"
      });
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    res.status(200).json({ success: true, data });

  } catch (e) {
    res.status(500).json({
      error: "failed_to_write_data",
      details: e.message
    });
  }
}
