import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import WebView from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { getAccessToken, getCompanyId } from "@/services/api";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessTab } from "@/utils/permissions";
import {
  writeCoordsToCache,
  readManyCoordsFromCache,
} from "@/services/coordsCache";
import { CachedCoordinates } from "@/hooks/useCachedCoordinates";

const FAST_POLL_MS = 5000;
const SLOW_POLL_MS = 30000;

const FLEET_MAP_VIEW_KEY = "@prefs/fleetMapView";

interface FleetMapView {
  lat: number;
  lng: number;
  zoom: number;
}

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

interface AssetItem {
  id: string;
  assetType: string;
  brand: string | null;
  model: string | null;
  internalCode: string | null;
  status: string;
}

interface TelemetryResult {
  lat: number | null;
  lng: number | null;
  recordedAt: string | null;
}

interface PinData {
  id: string;
  lat: number;
  lng: number;
  label: string;
  isLive: boolean;
  cachedAt?: string;
  status: string;
  assetType: string;
}

async function fetchAllAssets(): Promise<AssetItem[]> {
  const token = await getAccessToken();
  const companyId = await getCompanyId();
  if (!token || !companyId) return [];
  const res = await fetch(`${BASE_URL}/api/assets`, {
    headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId },
  });
  if (!res.ok) return [];
  const { data } = await res.json();
  return Array.isArray(data) ? data : [];
}

async function fetchTelemetry(id: string): Promise<TelemetryResult | null> {
  const token = await getAccessToken();
  const companyId = await getCompanyId();
  if (!token || !companyId) return null;
  try {
    const res = await fetch(`${BASE_URL}/api/telemetry/assets/${id}/latest`, {
      headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId },
    });
    if (!res.ok) return null;
    const { data } = await res.json();
    return data as TelemetryResult;
  } catch {
    return null;
  }
}

function assetLabel(asset: AssetItem): string {
  return (
    (asset.internalCode ??
      `${asset.brand ?? ""} ${asset.model ?? ""}`.trim()) ||
    asset.id.slice(0, 6)
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function buildFleetMapHtml(
  pins: PinData[],
  openInMapsLabel: string,
  initialView?: FleetMapView,
): string {
  const serialized = JSON.stringify(
    pins.map((p) => ({
      ...p,
      label: escapeHtml(p.label),
      status: escapeHtml(p.status),
    })),
  );

  const statusColors: Record<string, string> = {
    available: "#22C55E",
    rented: "#3B82F6",
    maintenance: "#F97316",
    blocked: "#EF4444",
    draft: "#8c8c8c",
    retired: "#8c8c8c",
  };

  const colorsJson = JSON.stringify(statusColors);
  const escapedLabel = escapeHtml(openInMapsLabel);

  const avgLat =
    pins.length > 0
      ? pins.reduce((s, p) => s + p.lat, 0) / pins.length
      : 48.8566;
  const avgLng =
    pins.length > 0
      ? pins.reduce((s, p) => s + p.lng, 0) / pins.length
      : 2.3522;
  const initLat = initialView?.lat ?? avgLat;
  const initLng = initialView?.lng ?? avgLng;
  const initZoom = initialView?.zoom ?? (pins.length > 0 ? 13 : 10);
  const hasInitialView = initialView != null;

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body,#map{width:100%;height:100%;background:#1a1a1a;}
  .live-pin{
    background:#F5C518;border:2.5px solid #1a1a1a;border-radius:50%;
    width:16px;height:16px;box-shadow:0 2px 8px rgba(0,0,0,0.5);
  }
  .stale-pin{
    background:#888;border:2px dashed #555;border-radius:50%;
    width:14px;height:14px;opacity:0.65;box-shadow:0 1px 4px rgba(0,0,0,0.4);
  }
  .stale-pin-wrap{position:relative;display:inline-block;}
  .clock-badge{
    position:absolute;top:-5px;right:-5px;
    background:#555;border-radius:50%;width:10px;height:10px;
    display:flex;align-items:center;justify-content:center;
    font-size:7px;color:#ccc;border:1px solid #333;
  }
  .leaflet-popup-content{font-family:system-ui,sans-serif;font-size:13px;line-height:1.5;}
  .popup-code{font-weight:700;font-size:14px;margin-bottom:2px;}
  .popup-status{font-size:11px;padding:2px 6px;border-radius:10px;display:inline-block;margin-bottom:4px;}
  .popup-cached{font-size:10px;color:#888;margin-top:2px;}
  .popup-live{font-size:10px;color:#16a34a;font-weight:600;}
  .popup-nav-btn{
    display:block;width:100%;margin-top:8px;padding:6px 10px;
    background:#F5C518;color:#1a1a1a;border:none;border-radius:8px;
    font-size:12px;font-weight:700;cursor:pointer;text-align:center;
    font-family:system-ui,sans-serif;
  }
  .popup-nav-btn:active{background:#d4a800;}
</style>
</head>
<body>
<div id="map"></div>
<script>
(function(){
  function sendNavigate(lat,lng){
    var msg=JSON.stringify({type:'navigate',lat:lat,lng:lng});
    if(window.ReactNativeWebView){
      window.ReactNativeWebView.postMessage(msg);
    } else {
      window.parent.postMessage(msg,'*');
    }
  }

  var pins=${serialized};
  var statusColors=${colorsJson};
  var defaultLat=${initLat};
  var defaultLng=${initLng};
  var defaultZoom=${initZoom};
  var hasInitialView=${hasInitialView};
  function sendMsg(obj){var s=JSON.stringify(obj);if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(s);}else{window.parent.postMessage(s,'*');}}
  var map=L.map('map',{zoomControl:true,attributionControl:false}).setView([defaultLat,defaultLng],defaultZoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);

  map.on('click',function(){
    map.closePopup();
  });
  map.on('movestart',function(){
    map.closePopup();
  });
  map.on('zoomstart',function(){
    map.closePopup();
  });

  var initialBounds=null;
  var group=[];

  window.recenterMap=function(){
    if(initialBounds&&group.length>1){
      map.flyToBounds(initialBounds,{padding:[40,40],duration:0.8});
    } else if(group.length===1){
      map.flyTo([group[0].getLatLng().lat,group[0].getLatLng().lng],15,{duration:0.8});
    } else {
      map.flyTo([defaultLat,defaultLng],defaultZoom,{duration:0.8});
    }
  };

  window.closeMapPopup=function(){
    map.closePopup();
  };

  window.addEventListener('message',function(e){
    try{
      var msg=typeof e.data==='string'?JSON.parse(e.data):e.data;
      if(msg&&msg.type==='recenter'){window.recenterMap();}
      else if(msg&&msg.type==='closePopup'){map.closePopup();}
    }catch(err){}
  });

  if(pins.length===0) return;


  pins.forEach(function(p){
    var icon;
    if(p.isLive){
      icon=L.divIcon({
        className:'',
        html:'<div class="live-pin"></div>',
        iconSize:[16,16],iconAnchor:[8,8],popupAnchor:[0,-10]
      });
    } else {
      icon=L.divIcon({
        className:'',
        html:'<div class="stale-pin-wrap"><div class="stale-pin"></div><div class="clock-badge">&#x23F0;</div></div>',
        iconSize:[18,18],iconAnchor:[7,7],popupAnchor:[0,-10]
      });
    }

    var sc=statusColors[p.status]||'#888';
    var popupHtml='<div class="popup-code">'+p.label+'</div>'
      +'<span class="popup-status" style="background:'+sc+'22;color:'+sc+'">'+p.status+'</span><br/>'
      +(p.isLive
        ?'<span class="popup-live">&#x2022; Live</span>'
        :'<span class="popup-cached">&#x23F0; Last known'+(p.cachedAt?' &middot; '+new Date(p.cachedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'')+'</span>')
      +'<button class="popup-nav-btn" onclick="sendNavigate('+p.lat+','+p.lng+')">${escapedLabel}</button>';

    var marker=L.marker([p.lat,p.lng],{icon:icon});
    marker.bindPopup(popupHtml,{minWidth:160});
    marker.addTo(map);
    group.push(marker);
  });

  if(!hasInitialView){
    if(group.length>1){
      initialBounds=L.featureGroup(group).getBounds();
      map.fitBounds(initialBounds,{padding:[40,40]});
    } else if(group.length===1){
      map.setView([pins[0].lat,pins[0].lng],15);
    }
  }

  map.on('moveend',function(){
    var c=map.getCenter();
    sendMsg({type:'mapview',lat:c.lat,lng:c.lng,zoom:map.getZoom()});
  });
  map.on('zoomend',function(){
    var c=map.getCenter();
    sendMsg({type:'mapview',lat:c.lat,lng:c.lng,zoom:map.getZoom()});
  });
})();
</script>
</body>
</html>`;
}

export default function FleetMapScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, companyId } = useAuth();
  const queryClient = useQueryClient();

  const memberships = user?.memberships || user?.companies;
  const roleCode =
    memberships?.find((c: { companyId: string }) => c.companyId === companyId)
      ?.roleCode || memberships?.[0]?.roleCode;
  const hasAccess = canAccessTab(roleCode, "map");

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const webViewRef = useRef<InstanceType<typeof WebView> | null>(null);
  const recenterScaleAnim = useRef(new Animated.Value(1)).current;
  const tooltipOpacity = useRef(new Animated.Value(0)).current;
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [loading, setLoading] = useState(true);
  const [pins, setPins] = useState<PinData[]>([]);
  const [liveCount, setLiveCount] = useState(0);
  const [cachedCount, setCachedCount] = useState(0);
  const [noLocationCount, setNoLocationCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const [savedView, setSavedView] = useState<FleetMapView | null>(null);
  const [fastPollUntil, setFastPollUntil] = useState<number>(() => {
    const cached = queryClient.getQueryData<number>(["fleet-fast-poll-until"]);
    return cached && cached > Date.now() ? cached : 0;
  });

  useEffect(() => {
    const cached = queryClient.getQueryData<number>(["fleet-fast-poll-until"]);
    if (cached && cached > Date.now()) {
      setFastPollUntil(cached);
    }

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type === "updated" &&
        Array.isArray(event.query.queryKey) &&
        event.query.queryKey[0] === "fleet-fast-poll-until"
      ) {
        const until = queryClient.getQueryData<number>([
          "fleet-fast-poll-until",
        ]);
        if (until && until > Date.now()) {
          setFastPollUntil(until);
        }
      }
    });
    return unsubscribe;
  }, [queryClient]);

  const isFastPolling = Date.now() < fastPollUntil;

  useEffect(() => {
    if (!isFastPolling) return;
    const remaining = fastPollUntil - Date.now();
    const timer = setTimeout(() => setFastPollUntil(0), remaining);
    return () => clearTimeout(timer);
  }, [fastPollUntil, isFastPolling]);

  useEffect(() => {
    AsyncStorage.getItem(FLEET_MAP_VIEW_KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (
          parsed !== null &&
          typeof parsed === "object" &&
          "lat" in parsed &&
          "lng" in parsed &&
          "zoom" in parsed &&
          typeof (parsed as FleetMapView).lat === "number" &&
          typeof (parsed as FleetMapView).lng === "number" &&
          typeof (parsed as FleetMapView).zoom === "number"
        ) {
          setSavedView(parsed as FleetMapView);
        }
      } catch {}
    });
  }, []);

  const loadMap = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const assets = await fetchAllAssets();
      if (assets.length === 0) {
        setPins([]);
        setLiveCount(0);
        setCachedCount(0);
        setNoLocationCount(0);
        return;
      }

      const telemetryResults = await Promise.all(
        assets.map((a) => fetchTelemetry(a.id)),
      );

      const assetsWithoutLive: AssetItem[] = [];
      assets.forEach((a, i) => {
        const tel = telemetryResults[i];
        if (!(tel?.lat != null && tel?.lng != null)) {
          assetsWithoutLive.push(a);
        }
      });

      const cachedEntries: Record<string, CachedCoordinates> =
        await readManyCoordsFromCache(assetsWithoutLive.map((a) => a.id));

      await Promise.all(
        assets.map(async (a, i) => {
          const tel = telemetryResults[i];
          if (tel?.lat != null && tel?.lng != null) {
            await writeCoordsToCache(
              a.id,
              tel.lat,
              tel.lng,
              tel.recordedAt ?? undefined,
            );
          }
        }),
      );

      const newPins: PinData[] = [];
      let live = 0;
      let cached = 0;
      let noLoc = 0;

      assets.forEach((a, i) => {
        const tel = telemetryResults[i];
        const hasLive = tel?.lat != null && tel?.lng != null;

        if (hasLive) {
          newPins.push({
            id: a.id,
            lat: tel!.lat!,
            lng: tel!.lng!,
            label: assetLabel(a),
            isLive: true,
            status: a.status,
            assetType: a.assetType,
          });
          live++;
        } else {
          const entry = cachedEntries[a.id];
          if (entry) {
            newPins.push({
              id: a.id,
              lat: entry.lat,
              lng: entry.lng,
              label: assetLabel(a),
              isLive: false,
              cachedAt: entry.cachedAt,
              status: a.status,
              assetType: a.assetType,
            });
            cached++;
          } else {
            noLoc++;
          }
        }
      });

      setPins(newPins);
      setLiveCount(live);
      setCachedCount(cached);
      setNoLocationCount(noLoc);
      setMapKey((k) => k + 1);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMap(false);
  }, [loadMap]);

  useEffect(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    const interval = isFastPolling ? FAST_POLL_MS : SLOW_POLL_MS;
    pollTimerRef.current = setInterval(() => {
      loadMap(false);
    }, interval);
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isFastPolling, loadMap]);

  const openInMapsLabel = t("fleetMap.openInMaps");
  const mapHtml = useMemo(
    () => buildFleetMapHtml(pins, openInMapsLabel, savedView ?? undefined),
    [pins, openInMapsLabel, savedView],
  );

  const isWeb = Platform.OS === "web";

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (isWeb) {
          try {
            iframeRef.current?.contentWindow?.postMessage(
              JSON.stringify({ type: "closePopup" }),
              "*",
            );
          } catch {}
        } else {
          webViewRef.current?.injectJavaScript(
            "window.closeMapPopup && window.closeMapPopup(); true;",
          );
        }
      };
    }, [isWeb]),
  );

  useEffect(() => {
    const iframe = iframeRef.current;
    const webView = webViewRef.current;
    return () => {
      if (isWeb) {
        try {
          iframe?.contentWindow?.postMessage(
            JSON.stringify({ type: "closePopup" }),
            "*",
          );
        } catch {}
      } else {
        webView?.injectJavaScript(
          "window.closeMapPopup && window.closeMapPopup(); true;",
        );
      }
    };
  }, [isWeb]);

  const showTooltip = useCallback(() => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    Animated.timing(tooltipOpacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
    tooltipTimerRef.current = setTimeout(() => {
      Animated.timing(tooltipOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, 1500);
  }, [tooltipOpacity]);

  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    };
  }, []);

  const handleRecenter = useCallback(() => {
    Animated.sequence([
      Animated.timing(recenterScaleAnim, {
        toValue: 0.88,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(recenterScaleAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    showTooltip();

    if (isWeb) {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ type: "recenter" }),
          "*",
        );
      } catch {}
    } else {
      webViewRef.current?.injectJavaScript(
        "window.recenterMap && window.recenterMap(); true;",
      );
    }
  }, [isWeb, recenterScaleAnim, showTooltip]);

  const handleNavigate = useCallback((lat: number, lng: number) => {
    const url = Platform.select({
      ios: `maps://maps.apple.com/?daddr=${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(Vehicle)`,
      default: `https://maps.google.com/maps?daddr=${lat},${lng}`,
    });
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://maps.google.com/maps?daddr=${lat},${lng}`);
    });
  }, []);

  const handleWebViewMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (
          msg.type === "navigate" &&
          typeof msg.lat === "number" &&
          typeof msg.lng === "number"
        ) {
          handleNavigate(msg.lat, msg.lng);
        } else if (
          msg.type === "mapview" &&
          typeof msg.lat === "number" &&
          typeof msg.lng === "number" &&
          typeof msg.zoom === "number"
        ) {
          const view: FleetMapView = {
            lat: msg.lat,
            lng: msg.lng,
            zoom: msg.zoom,
          };
          setSavedView(view);
          AsyncStorage.setItem(FLEET_MAP_VIEW_KEY, JSON.stringify(view)).catch(
            () => {},
          );
        }
      } catch {}
    },
    [handleNavigate],
  );

  useEffect(() => {
    if (!isWeb) return;
    const listener = (event: MessageEvent) => {
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow)
        return;
      try {
        const msg =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (
          msg.type === "navigate" &&
          typeof msg.lat === "number" &&
          typeof msg.lng === "number"
        ) {
          handleNavigate(msg.lat, msg.lng);
        } else if (
          msg.type === "mapview" &&
          typeof msg.lat === "number" &&
          typeof msg.lng === "number" &&
          typeof msg.zoom === "number"
        ) {
          const view: FleetMapView = {
            lat: msg.lat,
            lng: msg.lng,
            zoom: msg.zoom,
          };
          setSavedView(view);
          AsyncStorage.setItem(FLEET_MAP_VIEW_KEY, JSON.stringify(view)).catch(
            () => {},
          );
        }
      } catch {}
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [isWeb, handleNavigate]);

  if (!hasAccess) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            { backgroundColor: colors.dark, paddingTop: insets.top + 8 },
          ]}
        >
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("fleetMap.title")}</Text>
          <View style={styles.refreshBtn} />
        </View>
        <View style={styles.emptyContainer}>
          <Feather name="lock" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {t("common.error")}
          </Text>
          <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
            {t("fleetMap.noAccess")}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: colors.dark, paddingTop: insets.top + 8 },
        ]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("fleetMap.title")}</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => loadMap(true)}
          disabled={refreshing || loading}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#F5C518" />
          ) : (
            <Feather name="refresh-cw" size={20} color="#F5C518" />
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            {t("fleetMap.loading")}
          </Text>
        </View>
      ) : pins.length === 0 && noLocationCount === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="map" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {t("fleetMap.noData")}
          </Text>
          <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
            {t("fleetMap.noDataHint")}
          </Text>
        </View>
      ) : (
        <View style={styles.mapWrapper}>
          {isWeb ? (
            <iframe
              key={mapKey}
              ref={iframeRef}
              srcDoc={mapHtml}
              style={
                {
                  width: "100%",
                  height: "100%",
                  border: "none",
                } as React.CSSProperties
              }
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

          <Animated.View
            style={[
              styles.recenterTooltip,
              { backgroundColor: colors.dark, opacity: tooltipOpacity },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.recenterTooltipText}>
              {t("fleetMap.recenter")}
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.recenterBtn,
              {
                backgroundColor: colors.card,
                transform: [{ scale: recenterScaleAnim }],
              },
            ]}
          >
            <TouchableOpacity
              onPress={handleRecenter}
              activeOpacity={0.85}
              style={styles.recenterBtnInner}
              accessibilityLabel={t("fleetMap.recenter")}
            >
              <Feather name="crosshair" size={18} color={colors.primary} />
            </TouchableOpacity>
          </Animated.View>

          <View style={[styles.legend, { backgroundColor: colors.card }]}>
            {liveCount > 0 && (
              <View style={styles.legendRow}>
                <View style={styles.liveDot} />
                <Text style={[styles.legendText, { color: colors.foreground }]}>
                  {t("fleetMap.live", { count: liveCount })}
                </Text>
              </View>
            )}
            {cachedCount > 0 && (
              <View style={styles.legendRow}>
                <View style={styles.cachedDot} />
                <Text
                  style={[styles.legendText, { color: colors.mutedForeground }]}
                >
                  {t("fleetMap.cached", { count: cachedCount })}
                </Text>
              </View>
            )}
            {noLocationCount > 0 && (
              <View style={styles.legendRow}>
                <Feather
                  name="help-circle"
                  size={10}
                  color={colors.mutedForeground}
                />
                <Text
                  style={[styles.legendText, { color: colors.mutedForeground }]}
                >
                  {t("fleetMap.noLocation", { count: noLocationCount })}
                </Text>
              </View>
            )}
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
  refreshBtn: { padding: 4 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptyHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  mapWrapper: { flex: 1, position: "relative" },
  webview: { flex: 1 },
  recenterTooltip: {
    position: "absolute",
    bottom: 70,
    right: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  recenterTooltipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#fff",
  },
  recenterBtn: {
    position: "absolute",
    bottom: 20,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
    overflow: "hidden",
  },
  recenterBtnInner: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  legend: {
    position: "absolute",
    bottom: 20,
    left: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    minWidth: 140,
  },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  liveDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#F5C518",
    borderWidth: 1.5,
    borderColor: "#1a1a1a",
  },
  cachedDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#888",
    borderWidth: 1.5,
    borderColor: "#555",
    opacity: 0.65,
  },
});
