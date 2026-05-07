import AsyncStorage from "@react-native-async-storage/async-storage";
import { CachedCoordinates } from "@/hooks/useCachedCoordinates";

export function coordsCacheKey(assetId: string): string {
  return `@fleet/coords:${assetId}`;
}

export async function writeCoordsToCache(
  assetId: string,
  lat: number,
  lng: number,
  cachedAt?: string,
): Promise<void> {
  const entry: CachedCoordinates = {
    lat,
    lng,
    cachedAt: cachedAt ?? new Date().toISOString(),
  };
  await AsyncStorage.setItem(
    coordsCacheKey(assetId),
    JSON.stringify(entry),
  ).catch(() => {});
}

export async function readCoordsFromCache(
  assetId: string,
): Promise<CachedCoordinates | null> {
  try {
    const raw = await AsyncStorage.getItem(coordsCacheKey(assetId));
    if (raw) return JSON.parse(raw) as CachedCoordinates;
  } catch {}
  return null;
}

export async function readManyCoordsFromCache(
  assetIds: string[],
): Promise<Record<string, CachedCoordinates>> {
  if (assetIds.length === 0) return {};
  try {
    const keys = assetIds.map(coordsCacheKey);
    const pairs = await AsyncStorage.multiGet(keys);
    const result: Record<string, CachedCoordinates> = {};
    pairs.forEach(([key, value]) => {
      if (value) {
        const id = key.replace("@fleet/coords:", "");
        try {
          result[id] = JSON.parse(value) as CachedCoordinates;
        } catch {}
      }
    });
    return result;
  } catch {
    return {};
  }
}
