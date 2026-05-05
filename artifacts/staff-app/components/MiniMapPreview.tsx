import React, { useState } from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { type MapLayer, getMapLayer, setMapLayer } from "@/store/mapLayerStore";

interface MiniMapPreviewProps {
  lat: number;
  lng: number;
  isLastKnown?: boolean;
  label: string;
  onPress: () => void;
  onCopy: () => void;
}

function buildMapHtml(lat: number, lng: number, layer: MapLayer): string {
  const tileUrl =
    layer === "satellite"
      ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  const attribution =
    layer === "satellite"
      ? "© Esri, Maxar, Earthstar Geographics"
      : "© OpenStreetMap contributors";

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; overflow: hidden; }
    .leaflet-control-zoom { display: none; }
    .leaflet-control-attribution {
      font-size: 8px !important;
      padding: 1px 4px !important;
      background: rgba(255,255,255,0.7) !important;
      border-radius: 2px 0 0 0 !important;
      line-height: 1.4 !important;
    }
    .leaflet-control-attribution a { color: #444 !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      center: [${lat}, ${lng}],
      zoom: 15,
      zoomControl: false,
      attributionControl: true,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      keyboard: false,
      tap: false
    });
    L.tileLayer('${tileUrl}', {
      maxZoom: 19,
      attribution: '${attribution}'
    }).addTo(map);
    var icon = L.divIcon({
      className: '',
      html: '<div style="width:14px;height:14px;background:#F59E0B;border:2.5px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.35);"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
    L.marker([${lat}, ${lng}], { icon: icon }).addTo(map);
  </script>
</body>
</html>`;
}

export function MiniMapPreview({ lat, lng, isLastKnown, label, onPress, onCopy }: MiniMapPreviewProps) {
  const colors = useColors();
  const [layer, setLayerState] = useState<MapLayer>(getMapLayer);

  const html = buildMapHtml(lat, lng, layer);

  function toggleLayer() {
    const next: MapLayer = layer === "street" ? "satellite" : "street";
    setMapLayer(next);
    setLayerState(next);
  }

  const isSatellite = layer === "satellite";

  return (
    <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={styles.mapWrapper}>
        <WebView
          source={{ html }}
          style={styles.map}
          scrollEnabled={false}
          javaScriptEnabled
          originWhitelist={["*"]}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        />
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={onPress}
          activeOpacity={0.85}
        />
        <TouchableOpacity
          style={[
            styles.layerToggle,
            isSatellite ? styles.layerToggleSatellite : styles.layerToggleStreet,
          ]}
          onPress={toggleLayer}
          activeOpacity={0.8}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Feather
            name={isSatellite ? "map" : "globe"}
            size={11}
            color={isSatellite ? "#fff" : "#1a1a1a"}
          />
          <Text style={[styles.layerToggleText, { color: isSatellite ? "#fff" : "#1a1a1a" }]}>
            {isSatellite ? "Street" : "Satellite"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.bottomRow, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={styles.coordsArea}
          onPress={onPress}
          onLongPress={onCopy}
          activeOpacity={0.7}
        >
          <Feather
            name="map-pin"
            size={13}
            color={isLastKnown ? colors.mutedForeground : colors.primary}
          />
          <View style={styles.coordsBody}>
            <Text style={[styles.locationLabel, { color: colors.mutedForeground }]}>
              {label}
            </Text>
            <Text style={[styles.coordsText, { color: isLastKnown ? colors.mutedForeground : colors.foreground }]}>
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </Text>
          </View>
          <Feather name="external-link" size={13} color={colors.mutedForeground} />
        </TouchableOpacity>

        <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} />

        <TouchableOpacity
          style={styles.copyBtn}
          onPress={onCopy}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.6}
        >
          <Feather name="copy" size={13} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  mapWrapper: {
    height: 150,
    position: "relative",
  },
  map: {
    flex: 1,
    backgroundColor: "#E8E8E8",
  },
  layerToggle: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  layerToggleStreet: {
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  layerToggleSatellite: {
    backgroundColor: "rgba(30,30,30,0.82)",
  },
  layerToggleText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.1,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
  },
  coordsArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  coordsBody: {
    flex: 1,
    gap: 1,
  },
  locationLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  coordsText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  verticalDivider: {
    width: 1,
    alignSelf: "stretch",
  },
  copyBtn: {
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
});
