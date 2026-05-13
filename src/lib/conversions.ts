/**
 * Tank Data Conversion Utilities
 */

export type VolumeUnit =
  | "L"
  | "l"
  | "liter"
  | "liters"
  | "ml"
  | "mL"
  | "gal"
  | "gallon"
  | "gallons"
  | "m³"
  | "%";

export type TemperatureUnit = "°C" | "°F" | "C" | "F";
export type MetricMode = "default" | "percent" | "inverted";

/**
 * Converts mA or raw reading to Liters based on tank capacity and mode.
 * default: liters = ((mA - 4000) * capacityLiters) / 16000
 * percent: liters = (raw / 100) * capacityLiters
 * inverted: liters = ((100 - raw) / 100) * capacityLiters
 */
export function convertMaToLiters(
  value: number,
  capacityLiters: number,
  mode: MetricMode = "default"
): number {
  if (mode === "percent") {
    return (value / 100) * capacityLiters;
  }
  if (mode === "inverted") {
    return ((100 - value) / 100) * capacityLiters;
  }

  // Default mA logic
  // Handle both uA (4000-20000) and mA (4.0-20.0) scales
  const normalizedMA = value < 100 ? value * 1000 : value;
  if (normalizedMA < 4000) return 0;
  return ((normalizedMA - 4000) * capacityLiters) / 16000;
}

/**
 * Converts volume from Liters to the target unit.
 */
export function convertFromLiters(liters: number, unit: VolumeUnit, capacityLiters: number): number {
  switch (unit) {
    case "L":
    case "l":
    case "liter":
    case "liters":
      return liters;
    case "%":
      return capacityLiters > 0 ? (liters / capacityLiters) * 100 : 0;
    case "m³":
      return liters / 1000;
    case "ml":
    case "mL":
      return liters * 1000;
    case "gal":
    case "gallon":
    case "gallons":
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
    case "l":
    case "liter":
    case "liters":
      return value;
    case "%":
      return (value / 100) * capacityLiters;
    case "m³":
      return value * 1000;
    case "ml":
    case "mL":
      return value / 1000;
    case "gal":
    case "gallon":
    case "gallons":
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

  const fromNorm = (from === "°C" || from === "C") ? "°C" : "°F";
  const toNorm = (to === "°C" || to === "C") ? "°C" : "°F";

  if (fromNorm === toNorm) return value;
  if (fromNorm === "°C" && toNorm === "°F") return convertCtoF(value);
  if (fromNorm === "°F" && toNorm === "°C") return convertFtoC(value);

  return value;
}
