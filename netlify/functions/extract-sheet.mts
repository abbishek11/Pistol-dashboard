import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

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

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const { imageBase64, mediaType } = await req.json();
  if (!imageBase64) {
    return new Response(JSON.stringify({ error: "No image provided" }), { status: 400 });
  }

  // Store the original photo permanently in Netlify Blobs
  const store = getStore("shooting-sheets");
  const key = `sheet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const bytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
  await store.set(key, bytes.buffer, { metadata: { mediaType: mediaType || "image/jpeg" } });

  // Ask Claude to read the sheet, if an API key has been configured
  const apiKey = Netlify.env.get("ANTHROPIC_API_KEY");
  let extracted = null;
  let extractionError = null;

  if (!apiKey) {
    extractionError = "no_api_key";
  } else {
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageBase64 } },
                { type: "text", text: EXTRACTION_PROMPT },
              ],
            },
          ],
        }),
      });
      const data = await resp.json();
      const textBlock = (data.content || []).find((b: any) => b.type === "text");
      const raw = textBlock ? textBlock.text : "{}";
      extracted = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch (err) {
      console.error("Extraction failed:", err);
      extractionError = "extraction_failed";
    }
  }

  return new Response(
    JSON.stringify({ photoKey: key, extracted, extractionError }),
    { headers: { "content-type": "application/json" } }
  );
};

export const config: Config = {
  path: "/api/extract-sheet",
};
