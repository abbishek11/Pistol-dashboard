import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";

export default async (req: Request, context: Context) => {
  const db = getDatabase();

  if (req.method === "GET") {
    const rows = await db.sql`SELECT * FROM sessions ORDER BY session_date DESC, id DESC`;
    return new Response(JSON.stringify(rows), { headers: { "content-type": "application/json" } });
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
    return new Response(JSON.stringify(row), { headers: { "content-type": "application/json" } });
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
