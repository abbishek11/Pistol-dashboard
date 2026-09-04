import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!key) return new Response("Missing key", { status: 400 });

  const store = getStore("shooting-sheets");
  const result = await store.getWithMetadata(key, { type: "arrayBuffer" });
  if (!result) return new Response("Not found", { status: 404 });

  const mediaType = (result.metadata && (result.metadata as any).mediaType) || "image/jpeg";
  return new Response(result.data, { headers: { "content-type": mediaType, "cache-control": "private, max-age=31536000" } });
};

export const config: Config = {
  path: "/api/photo",
};
