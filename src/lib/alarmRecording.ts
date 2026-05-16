import { pool } from "./postgres";
import { 
  convertMaToLiters, 
  convertTemperature 
} from "./conversions";
import { TankAlarmLimits } from "@/types/alarm";

type InfluxRow = {
  _time: string;
  _value: number;
  channel: string;
};

export async function recordAlarms(
  slug: string, 
  rows: InfluxRow[]
) {
  if (!pool) return;

  try {
    // 1. Fetch company and tank settings (Case-insensitive slug)
    const companyRes = await pool.query(
      `SELECT id FROM companies WHERE LOWER(slug) = LOWER($1) LIMIT 1`,
      [slug]
    );
    const company = companyRes.rows[0];
    if (!company) {
      console.warn(`[recordAlarms] Company not found for slug: ${slug}`);
      return;
    }

    const companyId = company.id;

    // Ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tank_alarm_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        tank_key TEXT NOT NULL,
        tank_name TEXT,
        metric TEXT NOT NULL,
        value DOUBLE PRECISION NOT NULL,
        threshold DOUBLE PRECISION NOT NULL,
        threshold_type TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `).catch(err => console.error("[recordAlarms] Table creation failed:", err));

    // 2. Fetch tank settings and alarm settings
    const [tanksRes, alarmsRes] = await Promise.all([
      pool.query(
        `SELECT * FROM company_tank_settings WHERE company_id = $1`,
        [companyId]
      ),
      pool.query(
        `SELECT * FROM tank_alarm_settings WHERE company_id = $1`,
        [companyId]
      )
    ]);

    const tanks = tanksRes.rows;
    const alarmMap: Record<string, any> = {};
    alarmsRes.rows.forEach(r => {
      // Normalize key
      alarmMap[String(r.tank_key).trim().toLowerCase()] = r;
    });

    console.log(`[recordAlarms] Found ${tanks.length} tanks for company ${slug}`);
    
    for (const row of rows) {
      const channel = String(row.channel || "").trim();
      if (!channel) continue;
      const rawValue = row._value;

      for (const tank of tanks) {
        const tVolChan = String(tank.volume_channel || "").trim().toLowerCase();
        const tTempChan = String(tank.temperature_channel || "").trim().toLowerCase();
        const rowChan = channel.toLowerCase();

        const isVol = tVolChan === rowChan;
        const isTemp = tTempChan === rowChan;

        if (!isVol && !isTemp) continue;

        const tankKey = String(tank.tank_key).trim();
        const limits = alarmMap[tankKey.toLowerCase()];
        
        if (!limits) {
          continue;
        }

        let currentValue: number;
        let threshold: number | null = null;
        let thresholdType: string | null = null;
        let metric: string;

        if (isVol && !tank.disable_volume && !tank.is_disabled) {
          metric = "volume";
          const capacity = Number(tank.capacity_liters || 1000);
          let liters = convertMaToLiters(rawValue, capacity, tank.volume_mode);
          liters = (liters * Number(tank.volume_m ?? 1.0)) + Number(tank.volume_c ?? 0.0);
          currentValue = liters;

          if (limits.min_volume_l != null && liters < Number(limits.min_volume_l)) {
            threshold = Number(limits.min_volume_l);
            thresholdType = "min";
          } else if (limits.max_volume_l != null && liters > Number(limits.max_volume_l)) {
            threshold = Number(limits.max_volume_l);
            thresholdType = "max";
          }
        } else if (isTemp && !tank.disable_temperature && !tank.is_disabled) {
          metric = "temperature";
          let tempC = 0;
          const unit = tank.temperature_unit || "°C";
          if (tank.temperature_mode === "percent") tempC = rawValue;
          else if (tank.temperature_mode === "inverted") tempC = 100 - rawValue;
          else tempC = convertTemperature(rawValue, unit, "°C");
          
          tempC = (tempC * Number(tank.temperature_m ?? 1.0)) + Number(tank.temperature_c ?? 0.0);
          currentValue = tempC;

          if (limits.min_temp_c != null && tempC < Number(limits.min_temp_c)) {
            threshold = Number(limits.min_temp_c);
            thresholdType = "min";
          } else if (limits.max_temp_c != null && tempC > Number(limits.max_temp_c)) {
            threshold = Number(limits.max_temp_c);
            thresholdType = "max";
          }
        } else {
          continue;
        }

        if (threshold !== null) {
          console.log(`[recordAlarms] MATCH: ${tankKey} ${metric} ${thresholdType} (Val: ${currentValue.toFixed(2)}, Limit: ${threshold})`);
          
          // Deduplication
          const recent = await pool.query(
            `SELECT id FROM tank_alarm_history 
             WHERE company_id = $1 AND tank_key = $2 AND metric = $3 AND threshold_type = $4
             AND created_at > now() - interval '5 minutes' LIMIT 1`,
            [companyId, tankKey, metric, thresholdType]
          );

          if (recent.rows.length === 0) {
            console.log(`[recordAlarms] INSERTING...`);
            await pool.query(
              `INSERT INTO tank_alarm_history (
                company_id, tank_key, tank_name, metric, value, threshold, threshold_type
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [companyId, tankKey, tank.tank_name || tankKey, metric, currentValue, threshold, thresholdType]
            );
          } else {
            console.log(`[recordAlarms] SKIP (Recent log exists)`);
          }
        }
      }
    }
  } catch (err) {
    console.error("[recordAlarms] FATAL ERROR:", err);
  }
}
