import AsyncStorage from "@react-native-async-storage/async-storage";

export interface MapViewState {
  zoom: number;
  lat: number;
  lng: number;
}

const STORAGE_KEY = "@prefs/mapView";

const DEFAULT_ZOOM = 15;

let _view: MapViewState | null = null;

export function getCachedMapView(): MapViewState | null {
  return _view;
}

export function setMapView(state: MapViewState): void {
  _view = state;
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
}

export async function initMapView(): Promise<MapViewState | null> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as unknown;
      if (
        parsed !== null &&
        typeof parsed === "object" &&
        "zoom" in parsed &&
        "lat" in parsed &&
        "lng" in parsed &&
        typeof (parsed as MapViewState).zoom === "number" &&
        typeof (parsed as MapViewState).lat === "number" &&
        typeof (parsed as MapViewState).lng === "number"
      ) {
        _view = parsed as MapViewState;
        return _view;
      }
    }
  } catch {}
  return null;
}

export { DEFAULT_ZOOM };
