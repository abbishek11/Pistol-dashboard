import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";

export default async (req: Request, context: Context) => {
  const db = getDatabase();

  if (req.method === "GET") {
    const rows = await db.sql`SELECT * FROM competitions ORDER BY comp_date DESC, id DESC`;
    return new Response(JSON.stringify(rows), { headers: { "content-type": "application/json" } });
  }

  if (req.method === "POST") {
    const body = await req.json();
    if (!body.date) return new Response("Missing date", { status: 400 });

    const [row] = await db.sql`
      INSERT INTO competitions (
        comp_date, comp_name, lane, comp_no, athlete_name, event_no,
        dra_rc_ru, series, penalty, total, remarks, notes
      )
      VALUES (
        ${body.date}, ${body.compName ?? null}, ${body.lane ?? null}, ${body.compNo ?? null},
        ${body.athleteName ?? null}, ${body.eventNo ?? null}, ${body.draRcRu ?? null},
        ${JSON.stringify(body.series ?? [])}, ${body.penalty ?? 0}, ${body.total ?? 0},
        ${body.remarks ?? null}, ${body.notes ?? null}
      )
      RETURNING *
    `;
    return new Response(JSON.stringify(row), { headers: { "content-type": "application/json" } });
  }

  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });
    await db.sql`DELETE FROM competitions WHERE id = ${id}`;
    return new Response(null, { status: 204 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/competitions",
};
