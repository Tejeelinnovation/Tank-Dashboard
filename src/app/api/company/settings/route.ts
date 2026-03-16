import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/postgres";
import { getCompanySessionId } from "@/lib/companyAuth";
import { isAdminLoggedIn } from "@/lib/auth";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function numOrNull(value: unknown, fallback?: number) {
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  return fallback ?? null;
}

async function findCompanyBySlug(slug: string) {
  const res = await pool.query(
    `
    select id, slug
    from companies
    where slug = $1
    limit 1
    `,
    [slug]
  );
  return res.rows[0] ?? null;
}

async function resolveCompanyId(req: NextRequest, body?: any) {
  const url = new URL(req.url);
  const slugFromQuery = String(url.searchParams.get("slug") || "").trim();
  const slugFromBody = String(body?.slug || "").trim();
  const slug = slugFromQuery || slugFromBody;

  if (!slug) {
    return { error: "Company slug is required" as const };
  }

  const res = await pool.query(
    `
    select id, slug
    from companies
    where slug = $1
    limit 1
    `,
    [slug]
  );

  const company = res.rows[0];
  if (!company) {
    return { error: "Company not found" as const };
  }

  return {
    companyId: String(company.id),
    slug: String(company.slug),
  };
}

export async function GET(req: NextRequest) {
  try {
    const adminLoggedIn = await isAdminLoggedIn();
    const resolved = await resolveCompanyId(req);

    if (!resolved.companyId) {
      return NextResponse.json(
        { ok: false, error: resolved.error || "Unauthorized" },
        { status: resolved.error === "Company not found" ? 404 : 401 }
      );
    }

    // if slug is used, allow both admin and company view that exact company
    // if slug is absent, company session is used
    // admin without slug is not allowed
    if (adminLoggedIn && !resolved.slug) {
      return NextResponse.json(
        { ok: false, error: "Company slug is required for admin access" },
        { status: 400 }
      );
    }

    const companyId = resolved.companyId;

    const companyRes = await pool.query(
      `
      select id, name, slug, tanks_count, tank_capacities, data_mode
      from companies
      where id = $1
      limit 1
      `,
      [companyId]
    );

    const settingsRes = await pool.query(
      `
      select *
      from company_tank_settings
      where company_id = $1
      order by tank_key asc
      `,
      [companyId]
    );

    const alarmsRes = await pool.query(
      `
      select tank_key, min_volume_l, max_volume_l, min_temp_c, max_temp_c
      from tank_alarm_settings
      where company_id = $1
      order by tank_key asc
      `,
      [companyId]
    );

    const alarms: Record<
      string,
      {
        minVolumeL?: number;
        maxVolumeL?: number;
        minTempC?: number;
        maxTempC?: number;
      }
    > = {};

    for (const row of alarmsRes.rows) {
      alarms[row.tank_key] = {
        ...(row.min_volume_l != null ? { minVolumeL: Number(row.min_volume_l) } : {}),
        ...(row.max_volume_l != null ? { maxVolumeL: Number(row.max_volume_l) } : {}),
        ...(row.min_temp_c != null ? { minTempC: Number(row.min_temp_c) } : {}),
        ...(row.max_temp_c != null ? { maxTempC: Number(row.max_temp_c) } : {}),
      };
    }

    return NextResponse.json({
      ok: true,
      company: companyRes.rows[0] ?? null,
      tanks: settingsRes.rows,
      alarms,
    });
  } catch (error) {
    console.error("Load company settings error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to load settings" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const client = await pool.connect();

  try {
    const adminLoggedIn = await isAdminLoggedIn();
    const body = await req.json();
    const resolved = await resolveCompanyId(req, body);

    if (!resolved.companyId) {
      return NextResponse.json(
        { ok: false, error: resolved.error || "Unauthorized" },
        { status: resolved.error === "Company not found" ? 404 : 401 }
      );
    }

    if (adminLoggedIn && !resolved.slug) {
      return NextResponse.json(
        { ok: false, error: "Company slug is required for admin access" },
        { status: 400 }
      );
    }

    const companyId = resolved.companyId;

    const tanksCount = clamp(Number(body?.tanksCount || 1), 1, 20);
    const tanks = Array.isArray(body?.tanks) ? body.tanks : [];
    const alarms =
      body?.alarms && typeof body.alarms === "object" ? body.alarms : {};

    const tankCapacities = Array.isArray(body?.tankCapacities)
      ? body.tankCapacities
          .slice(0, tanksCount)
          .map((v: unknown) => {
            const n = Number(v);
            return Number.isFinite(n) ? clamp(n, 1, 1_000_000) : 1000;
          })
      : Array.from({ length: tanksCount }, (_, i) => {
          const n = Number(tanks?.[i]?.capacityLiters);
          return Number.isFinite(n) ? clamp(n, 1, 1_000_000) : 1000;
        });

    await client.query("BEGIN");

    await client.query(
      `
      update companies
      set
        tanks_count = $2,
        tank_capacities = $3::jsonb,
        updated_at = now()
      where id = $1
      `,
      [companyId, tanksCount, JSON.stringify(tankCapacities)]
    );

    await client.query(
      `delete from company_tank_settings where company_id = $1`,
      [companyId]
    );

    for (let i = 0; i < tanksCount; i++) {
      const tank = tanks[i] ?? {};
      const tankKey = `Tank ${i + 1}`;
      const tankName = String(tank?.name || tank?.tankName || tankKey).trim() || tankKey;

      const volumeMetric = Array.isArray(tank?.metrics) ? tank.metrics[0] ?? {} : {};
      const temperatureMetric = Array.isArray(tank?.metrics) ? tank.metrics[1] ?? {} : {};

      const volumeChannel = String(
        tank?.volumeChannel || volumeMetric?.channel || `CH${i * 2 + 1}`
      ).trim();

      const temperatureChannel = String(
        tank?.temperatureChannel || temperatureMetric?.channel || `CH${i * 2 + 2}`
      ).trim();

      const volumeUnit = String(
        tank?.volumeUnit || volumeMetric?.unit || "L"
      ).trim() || "L";

      const temperatureUnit = String(
        tank?.temperatureUnit || temperatureMetric?.unit || "°C"
      ).trim() || "°C";

      const capacityLiters = clamp(
        Number(tank?.capacityLiters || tankCapacities[i] || 1000),
        1,
        1_000_000
      );

      await client.query(
        `
        insert into company_tank_settings (
          company_id,
          tank_key,
          tank_name,
          volume_channel,
          temperature_channel,
          capacity_liters,
          volume_unit,
          temperature_unit,
          volume_min,
          volume_max,
          temperature_min,
          temperature_max,
          updated_at
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())
        `,
        [
          companyId,
          tankKey,
          tankName,
          volumeChannel,
          temperatureChannel,
          capacityLiters,
          volumeUnit,
          temperatureUnit,
          numOrNull(tank?.volumeMin, 0),
          numOrNull(tank?.volumeMax, 4000),
          numOrNull(tank?.temperatureMin, 0),
          numOrNull(tank?.temperatureMax, 100),
        ]
      );
    }

    await client.query(
      `delete from tank_alarm_settings where company_id = $1`,
      [companyId]
    );

    for (const [tankKey, limits] of Object.entries(alarms)) {
      const l = (limits ?? {}) as Record<string, unknown>;

      await client.query(
        `
        insert into tank_alarm_settings (
          company_id,
          tank_key,
          min_volume_l,
          max_volume_l,
          min_temp_c,
          max_temp_c,
          updated_at
        )
        values ($1,$2,$3,$4,$5,$6,now())
        `,
        [
          companyId,
          String(tankKey),
          numOrNull(l.minVolumeL),
          numOrNull(l.maxVolumeL),
          numOrNull(l.minTempC),
          numOrNull(l.maxTempC),
        ]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Save company settings error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to save settings" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}