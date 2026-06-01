import "server-only";
import { InfluxDB } from "@influxdata/influxdb-client";

const url = process.env.INFLUX_URL;
const token = process.env.INFLUX_TOKEN;
const defaultOrg = process.env.INFLUX_ORG;

if (!url || !token) {
  throw new Error("Missing INFLUX_URL or INFLUX_TOKEN");
}

const client = new InfluxDB({ url, token });

export async function queryInflux<T = Record<string, any>>(
  query: string, 
  customOrg?: string,
  customUrl?: string,
  customToken?: string
): Promise<T[]> {
  const urlToUse = customUrl || url;
  const tokenToUse = customToken || token;
  const orgToUse = customOrg || defaultOrg;

  if (!urlToUse || !tokenToUse) {
    throw new Error("Missing INFLUX_URL or INFLUX_TOKEN");
  }
  if (!orgToUse) throw new Error("No Influx Organization specified");

  const clientToUse = (customUrl || customToken)
    ? new InfluxDB({ url: urlToUse, token: tokenToUse })
    : client;

  const queryApi = clientToUse.getQueryApi(orgToUse);
  
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