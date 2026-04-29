import { NextRequest, NextResponse } from "next/server";
import { queryInflux } from "@/lib/influx";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const org = searchParams.get("org") || undefined;
  const bucket = searchParams.get("bucket");

  if (!bucket) {
    return NextResponse.json({ error: "Bucket is required" }, { status: 400 });
  }

  try {
    // Query unique channel values from the specified bucket
    const flux = `
import "influxdata/influxdb/schema"
schema.tagValues(
  bucket: "${bucket}",
  tag: "channel",
  start: -365d
)
`;

    const rows = await queryInflux<{ _value: string }>(flux, org);
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
