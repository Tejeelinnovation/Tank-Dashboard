import { NextRequest, NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";

const INFLUX_URL = process.env.INFLUX_URL;
const INFLUX_TOKEN = process.env.INFLUX_TOKEN;

export async function GET(req: NextRequest) {
  const ok = await isAdminLoggedIn();
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // "orgs" or "buckets"
  const orgId = searchParams.get("orgId"); // for buckets

  try {
    if (type === "orgs") {
      const res = await fetch(`${INFLUX_URL}/api/v2/orgs`, {
        headers: { Authorization: `Token ${INFLUX_TOKEN}` },
      });
      const data = await res.json();
      return NextResponse.json({ ok: true, orgs: data.orgs || [] });
    }

    if (type === "buckets") {
      if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });
      const res = await fetch(`${INFLUX_URL}/api/v2/buckets?orgID=${orgId}`, {
        headers: { Authorization: `Token ${INFLUX_TOKEN}` },
      });
      const data = await res.json();
      return NextResponse.json({ ok: true, buckets: data.buckets || [] });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (err: any) {
    console.error("Influx discovery error:", err);
    return NextResponse.json({ error: "Failed to fetch from Influx" }, { status: 500 });
  }
}
