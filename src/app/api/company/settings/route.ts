export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/postgres";
import { getCompanySessionId } from "@/lib/companyAuth";
import { isAdminLoggedIn } from "@/lib/auth";
import { verifyJWT } from "@/lib/jwt";
import { AUTH_COOKIE_NAME } from "@/lib/constants";
import { getUserPermissions } from "@/lib/dbUsers";
import { cookies } from "next/headers";

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

    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const session = token ? await verifyJWT(token) : null;
    const isSubUser = session?.role === "user";
    const userId = session?.userId;

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
      select id, name, slug, logo_url, tanks_count, tank_capacities, data_mode, influx_org, influx_bucket, pwd_reset_requested, pwd_reset_approved
      from companies
      where id = $1
      limit 1
      `,
      [companyId]
    );

    const rawCompany = companyRes.rows[0];
    const company = rawCompany
      ? {
          id: rawCompany.id,
          name: rawCompany.name,
          slug: rawCompany.slug,
          logoUrl: rawCompany.logo_url,
          tanksCount: Number(rawCompany.tanks_count ?? 0),
          tankCapacities: Array.isArray(rawCompany.tank_capacities)
            ? rawCompany.tank_capacities.map(Number)
            : [],
          dataMode: rawCompany.data_mode,
          influxOrg: rawCompany.influx_org,
          influxBucket: rawCompany.influx_bucket,
          pwdResetRequested: !!rawCompany.pwd_reset_requested,
          pwdResetApproved: !!rawCompany.pwd_reset_approved,
        }
      : null;

    const settingsRes = await pool.query(
      `
      select *
      from company_tank_settings
      where company_id = $1
      order by tank_key asc
      `,
      [companyId]
    );

    const tanks = settingsRes.rows.map((row) => ({
      id: row.id,
      tankKey: row.tank_key,
      tankName: row.tank_name,
      volumeChannel: row.volume_channel,
      temperatureChannel: row.temperature_channel,
      capacityLiters: Number(row.capacity_liters),
      volumeUnit: row.volume_unit,
      temperatureUnit: row.temperature_unit,
      fluidColor: row.fluid_color ?? null,
      tempColor: row.temp_color ?? null,
      disableVolume: !!row.disable_volume,
      disableTemperature: !!row.disable_temperature,
      volumeMin: row.volume_min != null ? Number(row.volume_min) : null,
      volumeMax: row.volume_max != null ? Number(row.volume_max) : null,
      temperatureMin: row.temperature_min != null ? Number(row.temperature_min) : null,
      temperatureMax: row.temperature_max != null ? Number(row.temperature_max) : null,
      volumeMode: row.volume_mode || "default",
      temperatureMode: row.temperature_mode || "default",
      volumeM: row.volume_m != null ? Number(row.volume_m) : 1.0,
      volumeC: row.volume_c != null ? Number(row.volume_c) : 0.0,
      temperatureM: row.temperature_m != null ? Number(row.temperature_m) : 1.0,
      temperatureC_factor: row.temperature_c != null ? Number(row.temperature_c) : 0.0, // using temperatureC_factor to avoid confusion with current temp
      isDisabled: !!row.is_disabled,
    }));

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

    let userPermissions = null;
    if (isSubUser && userId) {
      userPermissions = await getUserPermissions(userId);
    }

    let filteredTanks = isSubUser ? [] : tanks;
    let filteredAlarms = isSubUser ? {} : alarms;

    if (isSubUser && userPermissions) {
      const allowedKeys = new Set(userPermissions.map(p => String(p.tankKey).trim().toLowerCase()));
      filteredTanks = tanks.filter(t => allowedKeys.has(String(t.tankKey).trim().toLowerCase()));
      
      filteredAlarms = {};
      for (const key in alarms) {
        if (allowedKeys.has(key.trim().toLowerCase())) {
          filteredAlarms[key] = alarms[key];
        }
      }
    }

    return NextResponse.json({
      ok: true,
      company,
      tanks: filteredTanks,
      alarms: filteredAlarms,
      userPermissions,
      role: session?.role || null,
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
    
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const session = token ? await verifyJWT(token) : null;

    if (session?.role === "user") {
      // For now, sub-users are not allowed to change global settings or add/remove tanks.
      // If the user wants granular per-tank editing, we can implement that.
      // But usually 'edit' access means editing specific tank names/capacities in the dashboard,
      // not the whole company configuration.
      return NextResponse.json({ ok: false, error: "Sub-users cannot update company settings" }, { status: 403 });
    }

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

      const fluidColor = typeof tank?.fluidColor === "string" && tank.fluidColor
        ? tank.fluidColor.trim().slice(0, 9)
        : null;

      const tempColor = typeof tank?.tempColor === "string" && tank.tempColor
        ? tank.tempColor.trim().slice(0, 9)
        : null;

      const disableVolume = !!tank?.disableVolume;
      const disableTemperature = !!tank?.disableTemperature;
      const is_disabled = !!tank?.isDisabled;

      // Ensure column exists
      await client.query(`
        ALTER TABLE company_tank_settings ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT FALSE;
      `);

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
          fluid_color,
          temp_color,
          volume_min,
          volume_max,
          temperature_min,
          temperature_max,
          disable_volume,
          disable_temperature,
          volume_mode,
          temperature_mode,
          volume_m,
          volume_c,
          temperature_m,
          temperature_c,
          is_disabled,
          updated_at
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,now())
        on conflict (company_id, tank_key) do update set
          tank_name = excluded.tank_name,
          volume_channel = excluded.volume_channel,
          temperature_channel = excluded.temperature_channel,
          capacity_liters = excluded.capacity_liters,
          volume_unit = excluded.volume_unit,
          temperature_unit = excluded.temperature_unit,
          fluid_color = excluded.fluid_color,
          temp_color = excluded.temp_color,
          volume_min = excluded.volume_min,
          volume_max = excluded.volume_max,
          temperature_min = excluded.temperature_min,
          temperature_max = excluded.temperature_max,
          disable_volume = excluded.disable_volume,
          disable_temperature = excluded.disable_temperature,
          volume_mode = excluded.volume_mode,
          temperature_mode = excluded.temperature_mode,
          volume_m = excluded.volume_m,
          volume_c = excluded.volume_c,
          temperature_m = excluded.temperature_m,
          temperature_c = excluded.temperature_c,
          is_disabled = excluded.is_disabled,
          updated_at = now()
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
          fluidColor,
          tempColor,
          numOrNull(tank?.volumeMin, 0),
          numOrNull(tank?.volumeMax, 4000),
          numOrNull(tank?.temperatureMin, 0),
          numOrNull(tank?.temperatureMax, 100),
          disableVolume,
          disableTemperature,
          tank?.volumeMode || "default",
          tank?.temperatureMode || "default",
          tank?.volumeM != null ? Number(tank.volumeM) : 1.0,
          tank?.volumeC != null ? Number(tank.volumeC) : 0.0,
          tank?.temperatureM != null ? Number(tank.temperatureM) : 1.0,
          tank?.temperatureC_factor != null ? Number(tank.temperatureC_factor) : 0.0,
          is_disabled
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

    // Cleanup: Remove tanks that are no longer in the configuration
    const validKeys = Array.from({ length: tanksCount }, (_, i) => `Tank ${i + 1}`);
    await client.query(
      `delete from company_tank_settings 
       where company_id = $1 and tank_key not in (select unnest($2::text[]))`,
      [companyId, validKeys]
    );

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