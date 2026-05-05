export type MapLayer = "street" | "satellite";

let _layer: MapLayer = "street";

export function getMapLayer(): MapLayer {
  return _layer;
}

export function setMapLayer(layer: MapLayer): void {
  _layer = layer;
}
