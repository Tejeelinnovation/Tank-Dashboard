import "server-only";
import { pool } from "@/lib/postgres";

export type TankAlarmLimits = {
  minVolumeL?: number;
  maxVolumeL?: number;
  minTempC?: number;
  maxTempC?: number;
};

export type AlarmMap = Record<string, TankAlarmLimits>;

function normalizeAlarmRow(row: any): TankAlarmLimits {
  return {
    minVolumeL:
      row.min_volume_l == null ? undefined : Number(row.min_volume_l),
    maxVolumeL:
      row.max_volume_l == null ? undefined : Number(row.max_volume_l),
    minTempC:
      row.min_temp_c == null ? undefined : Number(row.min_temp_c),
    maxTempC:
      row.max_temp_c == null ? undefined : Number(row.max_temp_c),
  };
}

export async function loadAlarmMap(companyId: string): Promise<AlarmMap> {
  const res = await pool.query(
    `select * from tank_alarm_settings where company_id = $1`,
    [companyId]
  );

  const map: AlarmMap = {};
  for (const row of res.rows) {
    map[row.tank_key] = normalizeAlarmRow(row);
  }

  return map;
}

export async function saveAlarmMap(companyId: string, map: AlarmMap) {
  await pool.query(`delete from tank_alarm_settings where company_id = $1`, [
    companyId,
  ]);

  for (const [tankKey, limits] of Object.entries(map)) {
    await pool.query(
      `
      insert into tank_alarm_settings (
        company_id, tank_key,
        min_volume_l, max_volume_l,
        min_temp_c, max_temp_c,
        updated_at
      )
      values ($1,$2,$3,$4,$5,$6,now())
      `,
      [
        companyId,
        tankKey,
        limits.minVolumeL ?? null,
        limits.maxVolumeL ?? null,
        limits.minTempC ?? null,
        limits.maxTempC ?? null,
      ]
    );
  }
}