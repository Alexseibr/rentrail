import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const STATUS_COLORS: Record<string, string> = {
  available: "#22c55e",
  rented: "#3b82f6",
  maintenance: "#f59e0b",
  charging: "#8b5cf6",
  reserved: "#06b6d4",
  blocked: "#ef4444",
  lost: "#6b7280",
  stolen: "#dc2626",
  retired: "#9ca3af",
};

interface FleetMapItem {
  id: string;
  internalCode: string;
  assetType: string;
  status: string;
  brand: string;
  model: string;
  branchId: string;
  lat: number | null;
  lng: number | null;
  batteryPercent: number | null;
  speed: number | null;
  lockState: string | null;
  lastSeen: string | null;
}

export default function FleetMapPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const companyId = user?.memberships?.[0]?.companyId;
  const companyHeaders: Record<string, string> = companyId
    ? { "x-company-id": companyId }
    : {};
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data, isLoading } = useQuery<FleetMapItem[]>({
    queryKey: ["fleet-map", companyId],
    queryFn: () =>
      api<FleetMapItem[]>("/fleet-map", { headers: companyHeaders }),
    enabled: !!companyId,
    refetchInterval: 30000,
  });

  const items = data || [];
  const withCoords = items.filter((i) => i.lat != null && i.lng != null);
  const filtered = withCoords.filter((i) => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    if (typeFilter !== "all" && i.assetType !== typeFilter) return false;
    return true;
  });

  const statuses = [...new Set(items.map((i) => i.status))];
  const types = [...new Set(items.map((i) => i.assetType))];

  const totalOnMap = withCoords.length;
  const totalOffline = items.length - totalOnMap;
  const avgBattery =
    withCoords
      .filter((i) => i.batteryPercent != null)
      .reduce((s, i) => s + (i.batteryPercent || 0), 0) /
    (withCoords.filter((i) => i.batteryPercent != null).length || 1);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [55.751244, 37.618423],
      zoom: 11,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !markersRef.current) return;
    markersRef.current.clearLayers();

    if (filtered.length === 0) return;

    filtered.forEach((item) => {
      const color = STATUS_COLORS[item.status] || "#6b7280";
      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="
          width: 28px; height: 28px; border-radius: 50%;
          background: ${color}; border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; color: white; font-weight: 700;
        ">${item.batteryPercent != null ? item.batteryPercent : "?"}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const batteryBar =
        item.batteryPercent != null
          ? `<div style="margin-top:6px;background:#e5e7eb;border-radius:4px;height:8px;width:100%"><div style="background:${item.batteryPercent > 20 ? "#22c55e" : "#ef4444"};height:8px;border-radius:4px;width:${item.batteryPercent}%"></div></div>`
          : "";

      const popup = `
        <div style="min-width:180px;font-family:sans-serif">
          <div style="font-weight:700;font-size:14px;margin-bottom:4px">${escapeHtml(item.internalCode)}</div>
          <div style="font-size:12px;color:#6b7280">${escapeHtml(t(`assetType.${item.assetType}`, item.assetType))} — ${escapeHtml(item.brand)} ${escapeHtml(item.model)}</div>
          <div style="margin-top:6px;font-size:12px">
            <b>${t("common.status")}:</b> ${t(`status.${item.status}`, item.status)}<br/>
            ${item.batteryPercent != null ? `<b>${t("map.battery", "Батарея")}:</b> ${item.batteryPercent}%` : ""}
            ${item.lockState ? `<br/><b>${t("map.lock", "Замок")}:</b> ${item.lockState === "locked" ? "🔒" : "🔓"}` : ""}
            ${item.speed != null ? `<br/><b>${t("map.speed", "Скорость")}:</b> ${item.speed} км/ч` : ""}
            ${item.lastSeen ? `<br/><b>${t("map.lastSeen", "Последнее обновление")}:</b> ${new Date(item.lastSeen).toLocaleString()}` : ""}
          </div>
          ${batteryBar}
        </div>
      `;

      L.marker([item.lat!, item.lng!], { icon })
        .bindPopup(popup)
        .addTo(markersRef.current!);
    });

    const bounds = L.latLngBounds(
      filtered.map((i) => [i.lat!, i.lng!] as [number, number]),
    );
    mapInstanceRef.current.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 14,
    });
  }, [filtered, t]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("map.title", "Карта транспорта")}
          </h1>
          <p className="text-muted-foreground">
            {t(
              "map.subtitle",
              "Местоположение и состояние транспорта в реальном времени",
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`status.${s}`, s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {types.map((tp) => (
                <SelectItem key={tp} value={tp}>
                  {t(`assetType.${tp}`, tp)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="text-2xl font-bold">{items.length}</div>
            <p className="text-xs text-muted-foreground">
              {t("map.totalVehicles", "Всего транспорта")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="text-2xl font-bold text-green-600">
              {totalOnMap}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("map.onMap", "На карте")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="text-2xl font-bold text-gray-400">
              {totalOffline}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("map.offline", "Без координат")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="text-2xl font-bold text-purple-600">
              {Math.round(avgBattery)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {t("map.avgBattery", "Средний заряд")}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0 relative">
          {isLoading && (
            <Skeleton className="absolute inset-0 h-[500px] w-full rounded-xl z-10" />
          )}
          <div
            ref={mapRef}
            className="h-[500px] w-full rounded-xl"
            style={{ zIndex: 0 }}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        {Object.entries(STATUS_COLORS).map(([status, color]) => {
          const count = withCoords.filter((i) => i.status === status).length;
          if (count === 0) return null;
          return (
            <div key={status} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-full"
                style={{ background: color }}
              />
              <span>
                {t(`status.${status}`, status)}: {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
