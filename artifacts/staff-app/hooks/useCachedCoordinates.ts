import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface CachedCoordinates {
  lat: number;
  lng: number;
  cachedAt: string;
}

function storageKey(assetId: string) {
  return `@fleet/coords:${assetId}`;
}

export function useCachedCoordinates(assetId: string | undefined) {
  const [cachedCoords, setCachedCoords] = useState<CachedCoordinates | null>(null);

  useEffect(() => {
    setCachedCoords(null);
    if (!assetId) return;
    AsyncStorage.getItem(storageKey(assetId))
      .then((raw) => {
        if (raw) setCachedCoords(JSON.parse(raw) as CachedCoordinates);
      })
      .catch(() => {});
  }, [assetId]);

  const saveCoords = useCallback(
    (lat: number, lng: number) => {
      if (!assetId) return;
      const entry: CachedCoordinates = { lat, lng, cachedAt: new Date().toISOString() };
      setCachedCoords(entry);
      AsyncStorage.setItem(storageKey(assetId), JSON.stringify(entry)).catch(() => {});
    },
    [assetId],
  );

  return { cachedCoords, saveCoords };
}
