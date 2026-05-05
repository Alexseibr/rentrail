import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { coordsCacheKey, writeCoordsToCache } from "@/services/coordsCache";

export interface CachedCoordinates {
  lat: number;
  lng: number;
  cachedAt: string;
}

export function useCachedCoordinates(assetId: string | undefined) {
  const [cachedCoords, setCachedCoords] = useState<CachedCoordinates | null>(null);

  useEffect(() => {
    setCachedCoords(null);
    if (!assetId) return;
    AsyncStorage.getItem(coordsCacheKey(assetId))
      .then((raw) => {
        if (raw) setCachedCoords(JSON.parse(raw) as CachedCoordinates);
      })
      .catch(() => {});
  }, [assetId]);

  const saveCoords = useCallback(
    (lat: number, lng: number) => {
      if (!assetId) return;
      setCachedCoords({ lat, lng, cachedAt: new Date().toISOString() });
      writeCoordsToCache(assetId, lat, lng);
    },
    [assetId],
  );

  return { cachedCoords, saveCoords };
}
