import { useState, useEffect } from "react";
import { readManyCoordsFromCache } from "@/services/coordsCache";
import { CachedCoordinates } from "./useCachedCoordinates";

export function useFleetCoordinates(assetIds: string[]) {
  const [cachedMap, setCachedMap] = useState<Record<string, CachedCoordinates>>({});

  const key = assetIds.slice().sort().join(",");

  useEffect(() => {
    if (assetIds.length === 0) {
      setCachedMap({});
      return;
    }
    readManyCoordsFromCache(assetIds).then(setCachedMap).catch(() => {});
  }, [key]);

  return { cachedMap };
}
