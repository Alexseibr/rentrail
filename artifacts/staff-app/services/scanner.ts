export interface ScanResult {
  rawValue: string;
  type: "qr" | "barcode" | "unknown";
}

export function normalizeScanValue(raw: string): string {
  let value = raw.trim();
  const prefixes = ["ASSET:", "DEVICE:", "QR:", "CODE:"];
  for (const prefix of prefixes) {
    if (value.toUpperCase().startsWith(prefix)) {
      value = value.slice(prefix.length).trim();
      break;
    }
  }
  return value;
}

export function classifyScanType(raw: string): "qr" | "barcode" | "unknown" {
  const trimmed = raw.trim();
  if (trimmed.startsWith("http") || trimmed.length > 50) return "qr";
  if (/^\d{8,}$/.test(trimmed)) return "barcode";
  return "unknown";
}

export function parseScanResult(rawValue: string): ScanResult {
  return {
    rawValue: normalizeScanValue(rawValue),
    type: classifyScanType(rawValue),
  };
}
