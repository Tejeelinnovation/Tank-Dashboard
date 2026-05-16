export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { queryInflux } from "@/lib/influx";
import { pool } from "@/lib/postgres";
import { recordAlarms } from "@/lib/alarmRecording";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/lib/constants";
import { verifyJWT } from "@/lib/jwt";
import { getUserPermittedChannels } from "@/lib/dbUsers";

const defaultBucket = process.env.INFLUX_BUCKET!;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const org = searchParams.get("org") || undefined;
    const bucket = searchParams.get("bucket") || defaultBucket;
    const slug = searchParams.get("slug");

    if (!bucket) {
      return NextResponse.json({ error: "Influx Bucket is required" }, { status: 400 });
    }

    let disabledChannels: string[] = [];
    let permittedChannels: string[] | null = null;

    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const session = token ? await verifyJWT(token) : null;
    const isSubUser = session?.role === "user";

    if (isSubUser && session?.userId) {
      permittedChannels = await getUserPermittedChannels(session.userId);
    }
    if (slug && pool) {
      try {
        const settings = await pool.query(
          `SELECT volume_channel, temperature_channel, disable_volume, disable_temperature, is_disabled
           FROM company_tank_settings cts
           JOIN companies c ON c.id = cts.company_id
           WHERE c.slug = $1`,
          [slug]
        );
        settings.rows.forEach(r => {
          if (r.is_disabled) {
            if (r.volume_channel) disabledChannels.push(r.volume_channel.trim());
            if (r.temperature_channel) disabledChannels.push(r.temperature_channel.trim());
            return;
          }
          if (r.disable_volume && r.volume_channel) disabledChannels.push(r.volume_channel.trim());
          if (r.disable_temperature && r.temperature_channel) disabledChannels.push(r.temperature_channel.trim());
        });
      } catch (dbErr) {
        console.error("DB check failed in latest API:", dbErr);
      }
    }

    const flux = `
from(bucket: "${bucket}")
  |> range(start: -365d)
  |> filter(fn: (r) => r._measurement == "tank_data")
  |> filter(fn: (r) => r._field == "value")
  |> group(columns: ["channel"])
  |> last()
  |> keep(columns: ["_time", "_value", "channel"])
  |> sort(columns: ["channel"])
`;

    let rows = await queryInflux<{
      _time: string;
      _value: number;
      channel: string;
    }>(flux, org);

    if (disabledChannels.length > 0) {
      rows = rows.filter(r => !disabledChannels.includes(r.channel.trim()));
    }

    if (permittedChannels !== null) {
      const allowed = new Set(permittedChannels);
      rows = rows.filter(r => allowed.has(r.channel.trim()));
    }

    if (slug && rows.length > 0) {
      // Record alarms
      await recordAlarms(slug, rows);
    }

    return NextResponse.json({ rows });
  } catch (error) {
    console.error("Failed to fetch latest Influx data:", error);
    return NextResponse.json(
      { error: "Failed to fetch latest Influx data" },
      { status: 500 }
    );
  }
}