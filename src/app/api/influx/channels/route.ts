import { NextRequest, NextResponse } from "next/server";
import { queryInflux } from "@/lib/influx";
import { pool } from "@/lib/postgres";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const org = searchParams.get("org") || undefined;
  const bucket = searchParams.get("bucket");
  const slug = searchParams.get("slug");

  let customUrl: string | undefined = undefined;
  let customToken: string | undefined = undefined;
  let finalOrg: string | undefined = org;
  let finalBucket: string | null = bucket;

  if (slug && pool) {
    try {
      const companyRes = await pool.query(
        `SELECT influx_org, influx_bucket, influx_url, influx_token FROM companies WHERE slug = $1 LIMIT 1`,
        [slug]
      );
      if (companyRes.rows[0]) {
        const comp = companyRes.rows[0];
        if (comp.influx_url) customUrl = comp.influx_url;
        if (comp.influx_token) customToken = comp.influx_token;
        if (!org && comp.influx_org) finalOrg = comp.influx_org;
        if (!bucket && comp.influx_bucket) finalBucket = comp.influx_bucket;
      }
    } catch (dbErr) {
      console.error("DB check failed for company slug in channels API:", dbErr);
    }
  }

  if (!finalBucket) {
    return NextResponse.json({ error: "Bucket is required" }, { status: 400 });
  }

  try {
    // Query unique channel values from the specified bucket
    const flux = `
import "influxdata/influxdb/schema"
schema.tagValues(
  bucket: "${finalBucket}",
  tag: "channel",
  start: -365d
)
`;

    const rows = await queryInflux<{ _value: string }>(flux, finalOrg, customUrl, customToken);
    const channels = rows.map(r => r._value).filter(Boolean).sort();

    return NextResponse.json({ ok: true, channels });
  } catch (error) {
    console.error("Failed to fetch Influx channels:", error);
    return NextResponse.json(
      { error: "Failed to fetch channels from Influx" },
      { status: 500 }
    );
  }
}
