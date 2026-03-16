/*import "server-only";

export function generateTankData(
  tanksCount: number,
  capacities: number[]
) {
  return Array.from({ length: tanksCount }).map((_, i) => {
    const cap = capacities[i] ?? 1000;

    return {
      id: `T${i + 1}`,
      name: `Tank ${i + 1}`,
      capacityLiters: cap,
      level: Math.round(Math.random() * cap),
      temperatureC: +(25 + Math.random() * 15).toFixed(1), // 25–40°C
    };
  });
}*/

import "server-only";

export function generateTankData() {
  return [];
}