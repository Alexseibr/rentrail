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
import { getCachedMapView, setMapView, initMapView, DEFAULT_ZOOM, type MapViewState } from "@/store/mapViewStore";
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

function buildMapHtml(
  pins: AssetPin[],
  layer: MapLayer,
  navigateLabel: string,
  initialView: { zoom: number; lat: number; lng: number },
): string {
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
  function send(msg){
    var s=JSON.stringify(msg);
    if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(s);}
    else{window.parent.postMessage(s,'*');}
  }

  function sendNavigate(lat,lng){send({type:'navigate',lat:lat,lng:lng});}

  var pins=${serialized};
  var map=L.map('map',{zoomControl:true,attributionControl:true}).setView([${initialView.lat},${initialView.lng}],${initialView.zoom});
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

  map.on('movestart zoomstart popupopen',function(){
    send({type:'mapinteraction'});
  });

  var saveTimer=null;
  map.on('moveend zoomend',function(){
    clearTimeout(saveTimer);
    saveTimer=setTimeout(function(){
      var c=map.getCenter();
      send({type:'viewchange',zoom:map.getZoom(),lat:c.lat,lng:c.lng});
    },400);
  });

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

  window.jumpToAsset=function(lat,lng){
    map.setView([lat,lng],15,{animate:true});
  };

  window.closeMapPopup=function(){
    map.closePopup();
  };

  window.addEventListener('message',function(e){
    try{
      var msg=typeof e.data==='string'?JSON.parse(e.data):e.data;
      if(msg.type==='setMyLocation'&&typeof msg.lat==='number'&&typeof msg.lng==='number'){
        window.setMyLocation(msg.lat,msg.lng);
      } else if(msg.type==='jumpToAsset'&&typeof msg.lat==='number'&&typeof msg.lng==='number'){
        window.jumpToAsset(msg.lat,msg.lng);
      } else if(msg.type==='closePopup'){
        map.closePopup();
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
  const lat = parseFloat(params.lat ?? "");
  const lng = parseFloat(params.lng ?? "");
  const label = params.label ?? t("maintenanceMap.asset");
  const hasPrimaryPin = !isNaN(lat) && !isNaN(lng);

  const [layer, setLayerState] = useState<MapLayer>(getMapLayer);
  const userToggledRef = useRef(false);
  const [jumpTooltipVisible, setJumpTooltipVisible] = useState(false);
  const jumpTooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jumpLongPressedRef = useRef(false);

  const primaryFallback = { zoom: DEFAULT_ZOOM, lat: hasPrimaryPin ? lat : 55.751244, lng: hasPrimaryPin ? lng : 37.618423 };
  const cached = getCachedMapView();
  const [initialView, setInitialView] = useState<{ zoom: number; lat: number; lng: number }>(
    cached ?? primaryFallback,
  );
  const initialViewLoadedRef = useRef(!!cached);

  const isWeb = Platform.OS === "web";

  useEffect(() => {
    return () => {
      if (jumpTooltipTimerRef.current) clearTimeout(jumpTooltipTimerRef.current);
    };
  }, []);

  const handleShowJumpTooltip = useCallback(() => {
    jumpLongPressedRef.current = true;
    setJumpTooltipVisible(true);
    if (jumpTooltipTimerRef.current) clearTimeout(jumpTooltipTimerRef.current);
    jumpTooltipTimerRef.current = setTimeout(() => setJumpTooltipVisible(false), 3000);
    if (isWeb) {
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ type: "closePopup" }), "*");
    } else {
      webViewRef.current?.injectJavaScript(`window.closeMapPopup(); true;`);
    }
  }, [isWeb]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([initMapLayer(), initMapView()]).then(([persistedLayer, persistedView]) => {
      if (cancelled) return;
      if (!userToggledRef.current) {
        setLayerState(persistedLayer);
      }
      if (!initialViewLoadedRef.current && persistedView) {
        initialViewLoadedRef.current = true;
        setInitialView(persistedView);
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

  const primaryPin: AssetPin | null = useMemo(() => {
    if (!hasPrimaryPin) return null;
    return { id: "primary", lat, lng, label, isPrimary: true, status: "maintenance" };
  }, [hasPrimaryPin, lat, lng, label]);

  const loadFleetPins = useCallback(async () => {
    const basePins: AssetPin[] = primaryPin ? [primaryPin] : [];
    if (!companyId) {
      setPins(basePins);
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
      setPins([...basePins, ...fleetPins]);
    } catch {
      setPins(basePins);
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
    setJumpTooltipVisible(false);
    if (jumpTooltipTimerRef.current) {
      clearTimeout(jumpTooltipTimerRef.current);
      jumpTooltipTimerRef.current = null;
    }
    const next: MapLayer = layer === "street" ? "satellite" : "street";
    setMapLayer(next);
    setLayerState(next);
  }

  const handleMyLocation = useCallback(async () => {
    setJumpTooltipVisible(false);
    if (jumpTooltipTimerRef.current) {
      clearTimeout(jumpTooltipTimerRef.current);
      jumpTooltipTimerRef.current = null;
    }
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

  const handleJumpToAsset = useCallback(() => {
    if (!hasPrimaryPin) return;
    if (jumpLongPressedRef.current) {
      jumpLongPressedRef.current = false;
      return;
    }
    if (isWeb) {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ type: "jumpToAsset", lat, lng }),
        "*",
      );
    } else {
      webViewRef.current?.injectJavaScript(
        `window.jumpToAsset(${lat},${lng}); true;`,
      );
    }
  }, [hasPrimaryPin, isWeb, lat, lng]);

  const navigateLabel = t("maintenanceMap.navigateBtn");
  const mapHtml = useMemo(
    () => buildMapHtml(pins, layer, navigateLabel, initialView),
    [pins, layer, navigateLabel, initialView],
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

  const handleMapMessage = useCallback(
    (msg: Record<string, unknown>) => {
      if (msg.type === "mapinteraction") {
        if (jumpTooltipTimerRef.current) {
          clearTimeout(jumpTooltipTimerRef.current);
          jumpTooltipTimerRef.current = null;
        }
        setJumpTooltipVisible(false);
      } else if (msg.type === "navigate" && typeof msg.lat === "number" && typeof msg.lng === "number") {
        handleNavigate(msg.lat, msg.lng);
      } else if (
        msg.type === "viewchange" &&
        typeof msg.zoom === "number" &&
        typeof msg.lat === "number" &&
        typeof msg.lng === "number"
      ) {
        const zoom = Math.min(Math.max(Math.round(msg.zoom), 1), 19);
        const lat = Math.min(Math.max(msg.lat, -90), 90);
        const lng = Math.min(Math.max(msg.lng, -180), 180);
        const view = { zoom, lat, lng };
        setMapView(view);
        setInitialView(view);
      }
    },
    [handleNavigate],
  );

  const handleWebViewMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        handleMapMessage(msg);
      } catch {}
    },
    [handleMapMessage],
  );

  useEffect(() => {
    if (!isWeb) return;
    const listener = (event: MessageEvent) => {
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return;
      try {
        const msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        handleMapMessage(msg);
      } catch {}
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [isWeb, handleMapMessage]);

  const distanceBadge = useMemo(() => {
    if (!userLocation || !hasPrimaryPin) return null;
    const meters = haversineDistance(userLocation.lat, userLocation.lng, lat, lng);
    return formatDistance(meters);
  }, [userLocation, hasPrimaryPin, lat, lng]);

  const isSatellite = layer === "satellite";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity
        style={[styles.header, { backgroundColor: colors.dark, paddingTop: insets.top + 8 }]}
        activeOpacity={1}
        onPress={() => setJumpTooltipVisible(false)}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => { setJumpTooltipVisible(false); router.back(); }}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{label}</Text>
        {hasPrimaryPin && (
          <View style={styles.jumpBtnWrapper}>
            <TouchableOpacity
              style={styles.jumpBtn}
              onPress={handleJumpToAsset}
              onLongPress={handleShowJumpTooltip}
              delayLongPress={350}
              activeOpacity={0.8}
              accessibilityLabel={t("maintenanceMap.jumpToAsset")}
            >
              <Feather name="target" size={16} color="#fff" />
            </TouchableOpacity>
            {jumpTooltipVisible && (
              <TouchableOpacity
                style={styles.jumpTooltip}
                activeOpacity={0.9}
                onPress={() => setJumpTooltipVisible(false)}
              >
                <Text style={styles.jumpTooltipLabel} numberOfLines={1}>{label}</Text>
                <Text style={styles.jumpTooltipCoordsLabel}>{t("maintenanceMap.jumpTooltipCoords")}</Text>
                <Text style={styles.jumpTooltipCoords}>
                  {lat.toFixed(5)}, {lng.toFixed(5)}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
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
      </TouchableOpacity>

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

          {jumpTooltipVisible && (
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject}
              activeOpacity={1}
              onPress={() => setJumpTooltipVisible(false)}
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

          {hasPrimaryPin && (
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
          )}
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
  jumpBtnWrapper: {
    position: "relative",
  },
  jumpBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  jumpTooltip: {
    position: "absolute",
    top: 38,
    right: 0,
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 160,
    maxWidth: 220,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    zIndex: 999,
  },
  jumpTooltipLabel: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#F5C518",
    marginBottom: 3,
  },
  jumpTooltipCoordsLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.45)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 1,
  },
  jumpTooltipCoords: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 0.2,
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
