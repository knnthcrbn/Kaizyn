import { connection } from "next/server";
import { failure, structured } from "@/lib/footage/claude";

// GPS from a phone video -> "Fort Lauderdale, Florida". OpenStreetMap's
// geocoder first; Claude names the nearest city if that fails.
export async function GET(req: Request) {
  await connection();
  const params = new URL(req.url).searchParams;
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return Response.json({ error: "Bad coordinates" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lat=${lat}&lon=${lon}`,
      { headers: { "User-Agent": "ContentHub/1.0 (private footage library)", "Accept-Language": "en" }, signal: AbortSignal.timeout(6000) },
    );
    if (res.ok) {
      const d = (await res.json()) as { address?: Record<string, string> };
      const a = d.address ?? {};
      const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county;
      const region = a.country_code === "us" ? a.state : (a.state ?? a.country);
      const place = [city, region].filter(Boolean).join(", ");
      if (place) return Response.json({ place });
    }
  } catch {
    // Fall through to Claude.
  }

  try {
    const out = await structured<{ place: string }>({
      system: "Name the city nearest to the given coordinates as 'City, State' in the US or 'City, Country' elsewhere.",
      content: [{ type: "text", text: `${lat}, ${lon}` }],
      schema: { type: "object", additionalProperties: false, required: ["place"], properties: { place: { type: "string" } } },
      maxTokens: 100,
    });
    return Response.json({ place: out.place });
  } catch (err) {
    const { message, status } = failure(err);
    return Response.json({ error: message }, { status });
  }
}
