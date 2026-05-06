import AsyncStorage from "@react-native-async-storage/async-storage";

export type MapLayer = "street" | "satellite";

const STORAGE_KEY = "@prefs/mapLayer";

let _layer: MapLayer = "street";

export function getMapLayer(): MapLayer {
  return _layer;
}

export function setMapLayer(layer: MapLayer): void {
  _layer = layer;
  AsyncStorage.setItem(STORAGE_KEY, layer).catch(() => {});
}

export async function initMapLayer(): Promise<MapLayer> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored === "street" || stored === "satellite") {
      _layer = stored;
    }
  } catch {
  }
  return _layer;
}
