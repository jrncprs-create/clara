import memory from "./add";

export default function handler(req, res) {
  try {
    res.status(200).json(memory.default || memory);
  } catch (e) {
    res.status(500).json({
      error: "failed_to_read_memory",
      details: e.message
    });
  }
}
