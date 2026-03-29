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

    const item = {
      id: Date.now(),
      title: body.title || "",
      project: body.project || "",
      status: body.status || "nieuw",
      date: body.date || "",
      time: body.time || "",
      type: body.type,
      raw: body.raw || ""
    };

    if (body.type === "task") {
      data.tasks.unshift(item);
    }

    if (body.type === "agenda") {
      data.agenda.unshift(item);
    }

    if (body.type === "note") {
      data.projects.unshift(item);
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    res.status(200).json({ success: true });

  } catch (e) {
    res.status(500).json({
      error: "failed_to_write",
      details: e.message
    });
  }
}
