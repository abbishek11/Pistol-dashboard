import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";

export default async (req: Request, context: Context) => {
  const db = getDatabase();

  if (req.method === "GET") {
    const rows = await db.sql`SELECT * FROM attendance ORDER BY attend_date DESC, id DESC`;
    return new Response(JSON.stringify(rows), { headers: { "content-type": "application/json" } });
  }

  if (req.method === "POST") {
    const body = await req.json();
    if (!body.date) return new Response("Missing date", { status: 400 });

    // One row per day: marking an already-attended day returns the existing row.
    const [existing] = await db.sql`SELECT * FROM attendance WHERE attend_date = ${body.date}`;
    if (existing) {
      return new Response(JSON.stringify(existing), { headers: { "content-type": "application/json" } });
    }

    const [row] = await db.sql`
      INSERT INTO attendance (attend_date, notes)
      VALUES (${body.date}, ${body.notes ?? null})
      RETURNING *
    `;
    return new Response(JSON.stringify(row), { headers: { "content-type": "application/json" } });
  }

  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });
    await db.sql`DELETE FROM attendance WHERE id = ${id}`;
    return new Response(null, { status: 204 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/attendance",
};
