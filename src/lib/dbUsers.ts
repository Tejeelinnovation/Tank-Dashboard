import { pool } from "./postgres";
import bcrypt from "bcryptjs";

export type CompanyUser = {
  id: string;
  companyId: string;
  username: string;
  passwordHash: string;
  fullName: string;
  role: "user";
};

export async function getCompanyUserByUsername(username: string): Promise<CompanyUser | null> {
  const res = await pool.query(
    `SELECT * FROM company_users WHERE username = $1 LIMIT 1`,
    [username.toLowerCase()]
  );

  const row = res.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    companyId: row.company_id,
    username: row.username,
    passwordHash: row.password_hash,
    fullName: row.full_name,
    role: row.role as "user",
  };
}

export async function createCompanyUser(user: {
  companyId: string;
  username: string;
  passwordRaw: string;
  fullName: string;
}) {
  const hash = await bcrypt.hash(user.passwordRaw, 10);
  const res = await pool.query(
    `INSERT INTO company_users (company_id, username, password_hash, full_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [user.companyId, user.username.toLowerCase(), hash, user.fullName]
  );
  return res.rows[0].id;
}

export async function getCompanyUsers(companyId: string) {
  const res = await pool.query(
    `SELECT id, username, full_name, role FROM company_users WHERE company_id = $1`,
    [companyId]
  );
  return res.rows;
}

export async function deleteCompanyUser(id: string) {
  await pool.query(`DELETE FROM company_users WHERE id = $1`, [id]);
}

export async function updateCompanyUser(id: string, data: { fullName?: string, passwordRaw?: string }) {
  if (data.passwordRaw) {
    const hash = await bcrypt.hash(data.passwordRaw, 10);
    await pool.query(
      `UPDATE company_users SET full_name = $1, password_hash = $2 WHERE id = $3`,
      [data.fullName || "", hash, id]
    );
  } else {
    await pool.query(
      `UPDATE company_users SET full_name = $1 WHERE id = $2`,
      [data.fullName || "", id]
    );
  }
}

export async function setUserPermissions(userId: string, permissions: { tankKey: string; accessLevel: "view" | "edit" }[]) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM user_tank_permissions WHERE user_id = $1`, [userId]);
    for (const p of permissions) {
      await client.query(
        `INSERT INTO user_tank_permissions (user_id, tank_key, access_level) VALUES ($1, $2, $3)`,
        [userId, p.tankKey, p.accessLevel]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getUserPermissions(userId: string) {
  const res = await pool.query(
    `SELECT tank_key as "tankKey", access_level as "accessLevel" FROM user_tank_permissions WHERE user_id = $1`,
    [userId]
  );
  return res.rows;
}
export async function getUserPermittedChannels(userId: string) {
  const res = await pool.query(
    `SELECT cts.volume_channel as "volumeChannel", cts.temperature_channel as "temperatureChannel"
     FROM user_tank_permissions utp
     JOIN company_tank_settings cts ON utp.tank_key = cts.tank_key
     JOIN companies c ON c.id = cts.company_id
     JOIN company_users u ON u.id = utp.user_id AND u.company_id = c.id
     WHERE utp.user_id = $1`,
    [userId]
  );
  const channels = new Set<string>();
  res.rows.forEach(r => {
    if (r.volumeChannel) channels.add(r.volumeChannel.trim());
    if (r.temperatureChannel) channels.add(r.temperatureChannel.trim());
  });
  return Array.from(channels);
}
