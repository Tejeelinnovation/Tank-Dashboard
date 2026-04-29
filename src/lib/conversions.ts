/**
 * Tank Data Conversion Utilities
 */

export type VolumeUnit = "L" | "%" | "m³" | "ml" | "gal";
export type TemperatureUnit = "°C" | "°F";

/**
 * Converts mA reading to Liters based on tank capacity.
 * liters = ((mA - 4000) * capacityLiters) / 16000
 * Values below 4000mA are treated as 0.
 */
export function convertMaToLiters(mA: number, capacityLiters: number): number {
  if (mA < 4000) return 0;
  return ((mA - 4000) * capacityLiters) / 16000;
}

/**
 * Converts volume from Liters to the target unit.
 */
export function convertFromLiters(liters: number, unit: VolumeUnit, capacityLiters: number): number {
  switch (unit) {
    case "L":
      return liters;
    case "%":
      return capacityLiters > 0 ? (liters / capacityLiters) * 100 : 0;
    case "m³":
      return liters / 1000;
    case "ml":
      return liters * 1000;
    case "gal":
      return liters * 0.264172;
    default:
      return liters;
  }
}

/**
 * Converts volume from a source unit to Liters.
 */
export function convertToLiters(value: number, unit: VolumeUnit, capacityLiters: number): number {
  switch (unit) {
    case "L":
      return value;
    case "%":
      return (value / 100) * capacityLiters;
    case "m³":
      return value * 1000;
    case "ml":
      return value / 1000;
    case "gal":
      return value / 0.264172;
    default:
      return value;
  }
}

/**
 * Converts Celsius to Fahrenheit.
 */
export function convertCtoF(c: number): number {
  return (c * 9) / 5 + 32;
}

/**
 * Converts Fahrenheit to Celsius.
 */
export function convertFtoC(f: number): number {
  return ((f - 32) * 5) / 9;
}

/**
 * Generic temperature conversion.
 */
export function convertTemperature(value: number, from: TemperatureUnit, to: TemperatureUnit): number {
  if (from === to) return value;
  if (from === "°C" && to === "°F") return convertCtoF(value);
  if (from === "°F" && to === "°C") return convertFtoC(value);
  return value;
}
