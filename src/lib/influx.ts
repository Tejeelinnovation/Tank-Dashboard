import "server-only";
import { InfluxDB } from "@influxdata/influxdb-client";

const url = process.env.INFLUX_URL;
const token = process.env.INFLUX_TOKEN;
const org = process.env.INFLUX_ORG;

if (!url || !token || !org) {
  throw new Error("Missing INFLUX_URL, INFLUX_TOKEN, or INFLUX_ORG");
}

const client = new InfluxDB({ url, token });
const queryApi = client.getQueryApi(org);

export async function queryInflux<T = Record<string, any>>(query: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const rows: T[] = [];

    queryApi.queryRows(query, {
      next(row, tableMeta) {
        rows.push(tableMeta.toObject(row) as T);
      },
      error(error) {
        console.error("Influx query failed:\n", query);
        console.error("Influx error:", error);
        reject(error);
      },
      complete() {
        resolve(rows);
      },
    });
  });
}