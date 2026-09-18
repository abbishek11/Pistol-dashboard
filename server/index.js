import fs from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import pg from "pg";

const PORT = Number(process.env.PORT ?? 8080);
const STATIC_DIR = process.env.STATIC_DIR ?? "/app/static";
const PHOTO_DIR = process.env.PHOTO_DIR ?? "/data/photos";
const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR ?? "/app/migrations";

// Photo keys are generated server-side; anything else must never reach path.join.
const PHOTO_KEY = /^sheet-\d{1,20}-[a-z0-9]{1,12}$/;
const ALLOWED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

const EXTRACTION_PROMPT =
  "This image is a photo of a handwritten or printed pistol shooting practice score sheet. " +
  "Extract these fields as a single JSON object and respond with ONLY that JSON " +
  "(no markdown fences, no commentary): " +
  '{"date": "YYYY-MM-DD or null", "sessionNumber": number or null, "discipline": string or null, ' +
  '"distance": string or null, "totalShots": number or null, "totalScore": number or null, ' +
  '"maxScore": number or null, "xCount": number or null, "series": array of numbers or null, ' +
  '"tenCount": number or null, "nineCount": number or null, "eightCount": number or null, ' +
  '"sevenCount": number or null, "sixCount": number or null, "fiveOrBelowCount": number or null, ' +
  '"remarks": string or null}. If a field cannot be read confidently, use null rather than guessing.';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

async function migrate() {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())"
  );
  const files = (await fs.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    const { rowCount } = await pool.query("SELECT 1 FROM _migrations WHERE name = $1", [file]);
    if (rowCount) continue;

    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`Applied migration ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}

const app = express();
app.use(express.json({ limit: "25mb" }));

app.get("/api/sessions", async (_req, res) => {
  const { rows } = await pool.query("SELECT * FROM sessions ORDER BY session_date DESC, id DESC");
  res.json(rows);
});

app.post("/api/sessions", async (req, res) => {
  const b = req.body;
  const { rows } = await pool.query(
    `INSERT INTO sessions (
       session_date, session_number, discipline, distance, total_shots,
       total_score, max_score, x_count, series, shot_breakdown, notes, photo_key
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      b.date,
      b.sessionNumber ?? null,
      b.discipline ?? null,
      b.distance ?? null,
      b.totalShots ?? 0,
      b.totalScore ?? 0,
      b.maxScore ?? 0,
      b.xCount ?? 0,
      JSON.stringify(b.series ?? []),
      JSON.stringify(b.shotBreakdown ?? null),
      JSON.stringify(b.notes ?? {}),
      b.photoKey ?? null,
    ]
  );
  res.json(rows[0]);
});

app.delete("/api/sessions", async (req, res) => {
  const id = Number(req.query.id);
  if (!Number.isInteger(id)) return res.status(400).send("Missing or invalid id");
  await pool.query("DELETE FROM sessions WHERE id = $1", [id]);
  res.status(204).end();
});

app.get("/api/photo", async (req, res) => {
  const key = req.query.key;
  if (typeof key !== "string" || !PHOTO_KEY.test(key)) return res.status(400).send("Invalid key");

  let mediaType = "image/jpeg";
  try {
    const meta = JSON.parse(await fs.readFile(path.join(PHOTO_DIR, `${key}.meta.json`), "utf8"));
    if (ALLOWED_MEDIA_TYPES.has(meta.mediaType)) mediaType = meta.mediaType;
  } catch {
    // No sidecar metadata: fall back to the default media type.
  }

  let data;
  try {
    data = await fs.readFile(path.join(PHOTO_DIR, key));
  } catch {
    return res.status(404).send("Not found");
  }

  res.set("content-type", mediaType);
  res.set("cache-control", "private, max-age=31536000");
  res.send(data);
});

app.post("/api/extract-sheet", async (req, res) => {
  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: "No image provided" });

  const mediaType = ALLOWED_MEDIA_TYPES.has(req.body.mediaType) ? req.body.mediaType : "image/jpeg";

  const key = `sheet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await fs.writeFile(path.join(PHOTO_DIR, key), Buffer.from(imageBase64, "base64"));
  await fs.writeFile(path.join(PHOTO_DIR, `${key}.meta.json`), JSON.stringify({ mediaType }));

  let extracted = null;
  let extractionError = null;

  if (!anthropic) {
    extractionError = "no_api_key";
  } else {
    try {
      const message = await anthropic.messages.create({
        model: "claude-opus-5",
        max_tokens: 16000,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
              { type: "text", text: EXTRACTION_PROMPT },
            ],
          },
        ],
      });
      const textBlock = message.content.find((block) => block.type === "text");
      extracted = JSON.parse((textBlock?.text ?? "{}").replace(/```json|```/g, "").trim());
    } catch (err) {
      console.error("Extraction failed:", err);
      extractionError = "extraction_failed";
    }
  }

  res.json({ photoKey: key, extracted, extractionError });
});

app.use(express.static(STATIC_DIR));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "internal_error" });
});

await fs.mkdir(PHOTO_DIR, { recursive: true });
await migrate();
app.listen(PORT, () => console.log(`Listening on :${PORT}`));
