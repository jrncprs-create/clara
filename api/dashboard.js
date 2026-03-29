import fs from "fs";
import path from "path";

export default function handler(req, res) {
  try {
    const filePath = path.join(process.cwd(), "api", "data", "clara.json");
    const fileData = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(fileData);

    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({
      error: "failed_to_read_data",
      details: e.message
    });
  }
}
