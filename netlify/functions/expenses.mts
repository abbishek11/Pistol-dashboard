import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";

export default async (req: Request, context: Context) => {
  const db = getDatabase();

  if (req.method === "GET") {
    const rows = await db.sql`SELECT * FROM expenses ORDER BY spend_date DESC, id DESC`;
    return new Response(JSON.stringify(rows), { headers: { "content-type": "application/json" } });
  }

  if (req.method === "POST") {
    const body = await req.json();
    if (!body.date || !body.category) return new Response("Missing date or category", { status: 400 });

    const [row] = await db.sql`
      INSERT INTO expenses (
        spend_date, category, item_name, amount, quantity, purchase_source, vendor, notes
      )
      VALUES (
        ${body.date}, ${body.category}, ${body.itemName ?? null}, ${body.amount ?? 0},
        ${body.quantity ?? null}, ${body.purchaseSource ?? null}, ${body.vendor ?? null}, ${body.notes ?? null}
      )
      RETURNING *
    `;
    return new Response(JSON.stringify(row), { headers: { "content-type": "application/json" } });
  }

  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });
    await db.sql`DELETE FROM expenses WHERE id = ${id}`;
    return new Response(null, { status: 204 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/expenses",
};
