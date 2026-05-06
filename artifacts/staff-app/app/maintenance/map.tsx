import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import WebView from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import { useColors } from "@/hooks/useColors";
import { getMapLayer, setMapLayer, initMapLayer, type MapLayer } from "@/store/mapLayerStore";
import { readManyCoordsFromCache } from "@/services/coordsCache";
import { getAccessToken } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSnackbar } from "@/contexts/SnackbarContext";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

interface AssetPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  isPrimary: boolean;
  status: string;
}

async function fetchAllAssetIds(companyId: string): Promise<{ id: string; internalCode: string | null; brand: string | null; model: string | null; status: string }[]> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/api/assets`, {
    headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId },
  });
  if (!res.ok) return [];
  const { data } = await res.json();
  return Array.isArray(data) ? data : [];
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `~${Math.round(meters)} m`;
  }
  return `~${(meters / 1000).toFixed(1)} km`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function buildMapHtml(pins: AssetPin[], layer: MapLayer, navigateLabel: string): string {
  const tileUrl =
    layer === "satellite"
      ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  const attribution =
    layer === "satellite"
      ? "© Esri, Maxar, Earthstar Geographics"
      : "© OpenStreetMap contributors";

  const serialized = JSON.stringify(
    pins.map((p) => ({ ...p, label: escapeHtml(p.label), status: escapeHtml(p.status) })),
  );
  const escapedNavLabel = escapeHtml(navigateLabel);

  const primary = pins.find((p) => p.isPrimary);
  const centerLat = primary?.lat ?? (pins[0]?.lat ?? 48.8566);
  const centerLng = primary?.lng ?? (pins[0]?.lng ?? 2.3522);

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body,#map{width:100%;height:100%;background:#1a1a1a;}
  .primary-pin{
    background:#F5C518;border:3px solid #1a1a1a;border-radius:50%;
    width:20px;height:20px;box-shadow:0 2px 10px rgba(245,197,24,0.6);
  }
  .fleet-pin{
    background:#888;border:2px dashed #555;border-radius:50%;
    width:12px;height:12px;opacity:0.65;
  }
  .my-location-dot{
    background:#2563EB;border:3px solid #fff;border-radius:50%;
    width:18px;height:18px;box-shadow:0 2px 10px rgba(37,99,235,0.6);
  }
  .leaflet-popup-content{font-family:system-ui,sans-serif;font-size:13px;line-height:1.5;}
  .popup-code{font-weight:700;font-size:14px;margin-bottom:4px;}
  .popup-nav-btn{
    display:block;width:100%;margin-top:8px;padding:7px 10px;
    background:#F5C518;color:#1a1a1a;border:none;border-radius:8px;
    font-size:12px;font-weight:700;cursor:pointer;text-align:center;
    font-family:system-ui,sans-serif;
  }
  .popup-nav-btn:active{background:#d4a800;}
  .leaflet-control-attribution{font-size:8px!important;}
</style>
</head>
<body>
<div id="map"></div>
<script>
(function(){
  function sendNavigate(lat,lng){
    var msg=JSON.stringify({type:'navigate',lat:lat,lng:lng});
    if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(msg);}
    else{window.parent.postMessage(msg,'*');}
  }

  var pins=${serialized};
  var map=L.map('map',{zoomControl:true,attributionControl:true}).setView([${centerLat},${centerLng}],15);
  L.tileLayer('${tileUrl}',{maxZoom:19,attribution:'${attribution}'}).addTo(map);

  pins.forEach(function(p){
    var icon;
    if(p.isPrimary){
      icon=L.divIcon({className:'',html:'<div class="primary-pin"></div>',iconSize:[20,20],iconAnchor:[10,10],popupAnchor:[0,-12]});
    } else {
      icon=L.divIcon({className:'',html:'<div class="fleet-pin"></div>',iconSize:[12,12],iconAnchor:[6,6],popupAnchor:[0,-8]});
    }
    var popupHtml='<div class="popup-code">'+p.label+'</div>'
      +'<button class="popup-nav-btn" onclick="sendNavigate('+p.lat+','+p.lng+')">${escapedNavLabel}</button>';
    L.marker([p.lat,p.lng],{icon:icon}).bindPopup(popupHtml,{minWidth:160}).addTo(map);
  });

  var primary=pins.find(function(p){return p.isPrimary;});
  if(primary){map.setView([primary.lat,primary.lng],15);}

  var myLocationMarker=null;
  window.setMyLocation=function(lat,lng){
    var icon=L.divIcon({className:'',html:'<div class="my-location-dot"></div>',iconSize:[18,18],iconAnchor:[9,9]});
    if(myLocationMarker){
      myLocationMarker.setLatLng([lat,lng]);
    } else {
      myLocationMarker=L.marker([lat,lng],{icon:icon,zIndexOffset:500}).addTo(map);
    }
    map.setView([lat,lng],15,{animate:true});
  };

  window.addEventListener('message',function(e){
    try{
      var msg=typeof e.data==='string'?JSON.parse(e.data):e.data;
      if(msg.type==='setMyLocation'&&typeof msg.lat==='number'&&typeof msg.lng==='number'){
        window.setMyLocation(msg.lat,msg.lng);
      }
    }catch(err){}
  });
})();
</script>
</body>
</html>`;
}

export default function MaintenanceMapModal() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { companyId } = useAuth();
  const { showSnackbar } = useSnackbar();

  const params = useLocalSearchParams<{ lat: string; lng: string; label: string }>();
  const lat = parseFloat(params.lat ?? "0");
  const lng = parseFloat(params.lng ?? "0");
  const label = params.label ?? t("maintenanceMap.asset");

  const [layer, setLayerState] = useState<MapLayer>(getMapLayer);
  const userToggledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    initMapLayer().then((persisted) => {
      if (!cancelled && !userToggledRef.current) {
        setLayerState(persisted);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const [pins, setPins] = useState<AssetPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapKey, setMapKey] = useState(0);
  const [locating, setLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const webViewRef = useRef<WebView | null>(null);

  const isWeb = Platform.OS === "web";

  const primaryPin: AssetPin = useMemo(() => ({
    id: "primary",
    lat,
    lng,
    label,
    isPrimary: true,
    status: "maintenance",
  }), [lat, lng, label]);

  const loadFleetPins = useCallback(async () => {
    if (!companyId) {
      setPins([primaryPin]);
      setLoading(false);
      return;
    }
    try {
      const assets = await fetchAllAssetIds(companyId);
      const otherIds = assets.map((a) => a.id);
      const cached = otherIds.length > 0 ? await readManyCoordsFromCache(otherIds) : {};
      const fleetPins: AssetPin[] = assets
        .filter((a) => cached[a.id])
        .map((a) => {
          const c = cached[a.id]!;
          const assetLabel = (a.internalCode ?? `${a.brand ?? ""} ${a.model ?? ""}`.trim()) || a.id.slice(0, 6);
          return {
            id: a.id,
            lat: c.lat,
            lng: c.lng,
            label: assetLabel,
            isPrimary: false,
            status: a.status,
          };
        });
      setPins([primaryPin, ...fleetPins]);
    } catch {
      setPins([primaryPin]);
    } finally {
      setLoading(false);
    }
  }, [companyId, primaryPin]);

  useEffect(() => {
    loadFleetPins();
  }, [loadFleetPins]);

  useEffect(() => {
    if (!loading) setMapKey((k) => k + 1);
  }, [layer, loading]);

  function toggleLayer() {
    userToggledRef.current = true;
    const next: MapLayer = layer === "street" ? "satellite" : "street";
    setMapLayer(next);
    setLayerState(next);
  }

  const handleMyLocation = useCallback(async () => {
    if (locating) return;
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        showSnackbar(t("maintenanceMap.locationDenied"), "error");
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = position.coords;
      setUserLocation({ lat: latitude, lng: longitude });
      if (isWeb) {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ type: "setMyLocation", lat: latitude, lng: longitude }),
          "*",
        );
      } else {
        webViewRef.current?.injectJavaScript(
          `window.setMyLocation(${latitude},${longitude}); true;`,
        );
      }
    } catch {
      showSnackbar(t("maintenanceMap.locationError"), "error");
    } finally {
      setLocating(false);
    }
  }, [locating, isWeb, t, showSnackbar]);

  const navigateLabel = t("maintenanceMap.navigateBtn");
  const mapHtml = useMemo(
    () => buildMapHtml(pins, layer, navigateLabel),
    [pins, layer, navigateLabel],
  );

  const handleNavigate = useCallback((navLat: number, navLng: number) => {
    const url = Platform.select({
      ios: `maps://maps.apple.com/?daddr=${navLat},${navLng}`,
      android: `geo:${navLat},${navLng}?q=${navLat},${navLng}(Vehicle)`,
      default: `https://maps.google.com/maps?daddr=${navLat},${navLng}`,
    });
    Linking.openURL(url!).catch(() => {
      Linking.openURL(`https://maps.google.com/maps?daddr=${navLat},${navLng}`);
    });
  }, []);

  const handleWebViewMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.type === "navigate" && typeof msg.lat === "number" && typeof msg.lng === "number") {
          handleNavigate(msg.lat, msg.lng);
        }
      } catch {}
    },
    [handleNavigate],
  );

  useEffect(() => {
    if (!isWeb) return;
    const listener = (event: MessageEvent) => {
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return;
      try {
        const msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (msg.type === "navigate" && typeof msg.lat === "number" && typeof msg.lng === "number") {
          handleNavigate(msg.lat, msg.lng);
        }
      } catch {}
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [isWeb, handleNavigate]);

  const distanceBadge = useMemo(() => {
    if (!userLocation) return null;
    const meters = haversineDistance(userLocation.lat, userLocation.lng, lat, lng);
    return formatDistance(meters);
  }, [userLocation, lat, lng]);

  const isSatellite = layer === "satellite";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.dark, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{label}</Text>
        <TouchableOpacity
          style={[styles.layerToggle, isSatellite ? styles.layerSatellite : styles.layerStreet]}
          onPress={toggleLayer}
          activeOpacity={0.8}
        >
          <Feather name={isSatellite ? "map" : "globe"} size={13} color={isSatellite ? "#fff" : "#1a1a1a"} />
          <Text style={[styles.layerLabel, { color: isSatellite ? "#fff" : "#1a1a1a" }]}>
            {isSatellite ? t("maintenanceMap.layerStreet") : t("maintenanceMap.layerSatellite")}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={styles.mapWrapper}>
          {isWeb ? (
            <iframe
              key={mapKey}
              ref={iframeRef}
              srcDoc={mapHtml}
              style={{ width: "100%", height: "100%", border: "none" } as React.CSSProperties}
            />
          ) : (
            <WebView
              key={mapKey}
              ref={webViewRef}
              source={{ html: mapHtml }}
              style={styles.webview}
              originWhitelist={["*"]}
              javaScriptEnabled={true}
              scrollEnabled={false}
              onMessage={handleWebViewMessage}
            />
          )}

          <TouchableOpacity
            style={styles.myLocationBtn}
            onPress={handleMyLocation}
            activeOpacity={0.85}
            accessibilityLabel={t("maintenanceMap.myLocation")}
          >
            {locating ? (
              <ActivityIndicator size="small" color="#1a1a1a" />
            ) : (
              <Feather name="crosshair" size={20} color="#1a1a1a" />
            )}
          </TouchableOpacity>

          <View style={styles.navArea}>
            {distanceBadge !== null && (
              <View style={styles.distanceBadge}>
                <Feather name="map-pin" size={11} color="#1a1a1a" />
                <Text style={styles.distanceBadgeText}>{distanceBadge}</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => handleNavigate(lat, lng)}
              activeOpacity={0.85}
            >
              <Feather name="navigation" size={16} color="#1a1a1a" />
              <Text style={styles.navBtnText}>{t("maintenanceMap.navigateBtn")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  layerToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  layerStreet: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  layerSatellite: {
    backgroundColor: "rgba(245,197,24,0.25)",
  },
  layerLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  mapWrapper: { flex: 1, position: "relative" },
  webview: { flex: 1 },
  myLocationBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  navArea: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    alignItems: "center",
    gap: 6,
  },
  distanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(245,197,24,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  distanceBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#1a1a1a",
  },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F5C518",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  navBtnText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#1a1a1a",
  },
});
