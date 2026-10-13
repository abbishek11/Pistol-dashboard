import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";

export default async (req: Request, context: Context) => {
  const db = getDatabase();

  const jsonHeaders = { "content-type": "application/json", "cache-control": "no-store" };

  if (req.method === "GET") {
    const rows = await db.sql`SELECT * FROM sessions ORDER BY session_date DESC, id DESC`;
    return new Response(JSON.stringify(rows), { headers: jsonHeaders });
  }

  // Attach or replace the photo on one sheet of an existing session.
  if (req.method === "PATCH") {
    const body = await req.json();
    const { id, sheet, photoKey } = body ?? {};
    if (!id || sheet === undefined || sheet === null) {
      return new Response(JSON.stringify({ error: "Missing id or sheet" }), { status: 400, headers: jsonHeaders });
    }
    const [existing] = await db.sql`SELECT series FROM sessions WHERE id = ${id}`;
    if (!existing) {
      return new Response(JSON.stringify({ error: "Session not found" }), { status: 404, headers: jsonHeaders });
    }
    const series = Array.isArray(existing.series) ? existing.series : [];
    const updated = series.map((entry: any, index: number) => {
      const normalised = typeof entry === "number"
        ? { sheet: index + 1, score: entry, shots: [], photoKey: null }
        : entry;
      const sheetNumber = normalised.sheet ?? index + 1;
      return sheetNumber === Number(sheet) ? { ...normalised, photoKey } : normalised;
    });
    const [row] = await db.sql`
      UPDATE sessions SET series = ${JSON.stringify(updated)} WHERE id = ${id} RETURNING *
    `;
    return new Response(JSON.stringify(row), { headers: jsonHeaders });
  }

  if (req.method === "POST") {
    const body = await req.json();
    const [row] = await db.sql`
      INSERT INTO sessions (
        session_date, session_number, discipline, distance, total_shots,
        total_score, max_score, x_count, series, shot_breakdown, notes, photo_key
      )
      VALUES (
        ${body.date}, ${body.sessionNumber ?? null}, ${body.discipline ?? null}, ${body.distance ?? null},
        ${body.totalShots ?? 0}, ${body.totalScore ?? 0}, ${body.maxScore ?? 0}, ${body.xCount ?? 0},
        ${JSON.stringify(body.series ?? [])}, ${JSON.stringify(body.shotBreakdown ?? null)},
        ${JSON.stringify(body.notes ?? {})}, ${body.photoKey ?? null}
      )
      RETURNING *
    `;
    return new Response(JSON.stringify(row), { headers: jsonHeaders });
  }

  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });
    await db.sql`DELETE FROM sessions WHERE id = ${id}`;
    return new Response(null, { status: 204 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/sessions",
};
