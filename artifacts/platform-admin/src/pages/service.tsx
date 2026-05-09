import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Wrench,
  UserCheck,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle,
  Loader2,
  Package,
  FileText,
  Calendar,
  TrendingDown,
  DollarSign,
  CalendarClock,
} from "lucide-react";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { useRolePermissions } from "@/hooks/use-role-permissions";
import { toast } from "@/hooks/use-toast";

interface _ServiceRequest {
  id: string;
  title?: string;
  requestType?: string;
  assetCode?: string;
  branchCity?: string;
  branchName?: string;
  priority?: string;
  status: string;
  assignedToName?: string;
}

interface _ServiceWorkOrder {
  id: string;
  title?: string;
  orderType?: string;
  assetCode?: string;
  branchCity?: string;
  branchName?: string;
  priority?: string;
  status: string;
  assignedToName?: string;
  actualCost?: string;
  estimatedCost?: string;
}

interface _ServiceSparePart {
  id: string;
  name?: string;
  sku?: string;
  category?: string;
  branchName?: string;
  qtyInStock: string;
  minQtyAlert: string;
  unit?: string;
  costPrice?: string;
  location?: string;
}

interface _ServiceMaintenanceLog {
  id: string;
  logType?: string;
  assetCode?: string;
  performedAt: string;
  performedByName?: string;
  odometerKm?: number;
  cost?: string;
  notes?: string;
}

interface _ServiceSchedule {
  id: string;
  name?: string;
  assetCode?: string;
  intervalDays?: number;
  intervalKm?: number;
  lastDoneAt?: string;
  nextDueAt?: string | null;
}

interface _ServiceMechanic {
  userId: string;
  fullName?: string;
  phone?: string;
}

interface _ServiceBranch {
  id: string;
  name?: string;
  city?: string;
}

interface _ServiceAsset {
  id: string;
  internalCode?: string;
  brand?: string;
  model?: string;
}

interface _ServiceStats {
  monthCost?: number;
  lowStockCount?: number;
  overdueSchedules?: number;
}

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  assigned: "bg-sky-100 text-sky-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  on_hold: "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
  canceled: "bg-gray-200 text-gray-600",
  draft: "bg-gray-50 text-gray-600",
  en_route: "bg-indigo-100 text-indigo-800",
  waiting_parts: "bg-orange-100 text-orange-800",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

const LOG_TYPE_LABELS: Record<string, string> = {
  general_service: "Общее ТО",
  tire_change: "Замена шин",
  brake_service: "Тормоза",
  battery_replacement: "Батарея",
  chain_lubrication: "Цепь",
  cable_adjustment: "Тросы",
  bearing_replacement: "Подшипники",
  body_repair: "Кузов",
  electrical_repair: "Электрика",
  cleaning: "Чистка",
  inspection: "Осмотр",
  other: "Прочее",
};

const REQUEST_TYPES = [
  "breakdown",
  "flat_tire",
  "brake_issue",
  "battery_issue",
  "electrical",
  "body_damage",
  "scheduled_maintenance",
  "inspection",
  "cleaning",
  "other",
];
const PRIORITIES = ["low", "medium", "high", "urgent"];
const SR_STATUSES = [
  "new",
  "assigned",
  "in_progress",
  "on_hold",
  "completed",
  "canceled",
];
const WO_TYPES = [
  "field_repair",
  "workshop_repair",
  "scheduled_maintenance",
  "inspection",
  "recovery",
  "cleaning",
];

const KPI_SR = [
  { key: "new", accent: "bg-blue-500", icon: AlertTriangle },
  { key: "in_progress", accent: "bg-yellow-500", icon: Loader2 },
  { key: "on_hold", accent: "bg-orange-500", icon: Clock },
  { key: "completed", accent: "bg-green-500", icon: CheckCircle },
] as const;

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  return Math.ceil(
    (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
}

export default function ServicePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { canWriteService } = useRolePermissions();
  const companyId = user?.memberships?.[0]?.companyId;
  const companyHeaders: Record<string, string> = companyId
    ? { "x-company-id": companyId }
    : {};

  const [tab, setTab] = useState("requests");
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateWO, setShowCreateWO] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [assignDialog, setAssignDialog] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [statusDialog, setStatusDialog] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedMechanic, setSelectedMechanic] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [partsSearch, setPartsSearch] = useState("");
  const [logsSearch, setLogsSearch] = useState("");

  const [srForm, setSrForm] = useState({
    branchId: "",
    assetId: "",
    requestType: "breakdown",
    priority: "medium",
    title: "",
    description: "",
  });
  const [woForm, setWoForm] = useState({
    branchId: "",
    assetId: "",
    orderType: "field_repair",
    priority: "medium",
    title: "",
    description: "",
    assignedToUserId: "",
    estimatedCost: "",
  });

  const requestsQuery = useQuery({
    queryKey: ["service-requests", companyId, statusFilter],
    queryFn: () => {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      return api<ServiceRequest[]>(`/service-requests${params}`, {
        headers: companyHeaders,
      });
    },
    enabled: !!companyId,
  });

  const workOrdersQuery = useQuery({
    queryKey: ["work-orders", companyId],
    queryFn: () =>
      api<ServiceWorkOrder[]>("/work-orders", { headers: companyHeaders }),
    enabled: !!companyId,
  });

  const branchesQuery = useQuery({
    queryKey: ["branches", companyId],
    queryFn: () =>
      api<ServiceBranch[]>("/branches", { headers: companyHeaders }),
    enabled: !!companyId,
  });

  const assetsQuery = useQuery({
    queryKey: ["assets-all", companyId],
    queryFn: () => api<ServiceAsset[]>("/assets", { headers: companyHeaders }),
    enabled: !!companyId && (showCreate || showCreateWO),
  });

  const mechanicsQuery = useQuery({
    queryKey: ["mechanics", companyId],
    queryFn: () =>
      api<ServiceMechanic[]>("/mechanics", { headers: companyHeaders }),
    enabled: !!companyId,
  });

  const sparePartsQuery = useQuery({
    queryKey: ["spare-parts", companyId],
    queryFn: () =>
      api<ServiceSparePart[]>("/spare-parts", { headers: companyHeaders }),
    enabled: !!companyId && tab === "spareParts",
  });

  const maintenanceLogsQuery = useQuery({
    queryKey: ["maintenance-logs", companyId],
    queryFn: () =>
      api<ServiceMaintenanceLog[]>("/maintenance-logs?limit=100", {
        headers: companyHeaders,
      }),
    enabled: !!companyId && tab === "logs",
  });

  const schedulesQuery = useQuery({
    queryKey: ["maintenance-schedules", companyId],
    queryFn: () =>
      api<ServiceSchedule[]>("/maintenance-schedules", {
        headers: companyHeaders,
      }),
    enabled: !!companyId && tab === "schedules",
  });

  const overdueQuery = useQuery({
    queryKey: ["maintenance-schedules-overdue", companyId],
    queryFn: () =>
      api<ServiceSchedule[]>("/maintenance-schedules/overdue", {
        headers: companyHeaders,
      }),
    enabled: !!companyId,
  });

  const serviceStatsQuery = useQuery({
    queryKey: ["service-stats", companyId],
    queryFn: () =>
      api<ServiceStats>("/service-stats", { headers: companyHeaders }),
    enabled: !!companyId,
  });

  const branches = Array.isArray(branchesQuery.data) ? branchesQuery.data : [];
  const allAssets = assetsQuery.data ?? [];
  const mechanics = Array.isArray(mechanicsQuery.data)
    ? mechanicsQuery.data
    : [];
  const requests = Array.isArray(requestsQuery.data) ? requestsQuery.data : [];
  const workOrders = Array.isArray(workOrdersQuery.data)
    ? workOrdersQuery.data
    : [];
  const spareParts = Array.isArray(sparePartsQuery.data)
    ? sparePartsQuery.data
    : [];
  const maintenanceLogs = Array.isArray(maintenanceLogsQuery.data)
    ? maintenanceLogsQuery.data
    : [];
  const schedules = Array.isArray(schedulesQuery.data)
    ? schedulesQuery.data
    : [];
  const overdue = Array.isArray(overdueQuery.data) ? overdueQuery.data : [];
  const stats = serviceStatsQuery.data;

  const lowStockParts = spareParts.filter(
    (p) => parseFloat(p.qtyInStock) <= parseFloat(p.minQtyAlert),
  );

  const filteredRequests = search
    ? requests.filter(
        (r) =>
          r.title?.toLowerCase().includes(search.toLowerCase()) ||
          r.assetCode?.toLowerCase().includes(search.toLowerCase()),
      )
    : requests;

  const filteredParts = partsSearch
    ? spareParts.filter(
        (p) =>
          p.name?.toLowerCase().includes(partsSearch.toLowerCase()) ||
          p.sku?.toLowerCase().includes(partsSearch.toLowerCase()),
      )
    : spareParts;

  const filteredLogs = logsSearch
    ? maintenanceLogs.filter(
        (l) =>
          l.assetCode?.toLowerCase().includes(logsSearch.toLowerCase()) ||
          l.notes?.toLowerCase().includes(logsSearch.toLowerCase()),
      )
    : maintenanceLogs;

  const createSRMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/service-requests", {
        method: "POST",
        body: JSON.stringify(body),
        headers: companyHeaders,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-requests"] });
      setShowCreate(false);
      setSrForm({
        branchId: "",
        assetId: "",
        requestType: "breakdown",
        priority: "medium",
        title: "",
        description: "",
      });
      toast({ title: t("toast.requestCreated") });
    },
    onError: () => {
      toast({
        title: t("toast.error"),
        description: t("toast.saveFailed"),
        variant: "destructive",
      });
    },
  });

  const createWOMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/work-orders", {
        method: "POST",
        body: JSON.stringify(body),
        headers: companyHeaders,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      setShowCreateWO(false);
      setWoForm({
        branchId: "",
        assetId: "",
        orderType: "field_repair",
        priority: "medium",
        title: "",
        description: "",
        assignedToUserId: "",
        estimatedCost: "",
      });
      toast({ title: t("toast.workOrderCreated") });
    },
    onError: () => {
      toast({
        title: t("toast.error"),
        description: t("toast.saveFailed"),
        variant: "destructive",
      });
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      api(`/service-requests/${id}/assign`, {
        method: "POST",
        body: JSON.stringify({ assignedToUserId: userId }),
        headers: companyHeaders,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-requests"] });
      setAssignDialog(null);
      setSelectedMechanic("");
      toast({ title: t("toast.mechanicAssigned") });
    },
    onError: () => {
      toast({
        title: t("toast.error"),
        description: t("toast.actionFailed"),
        variant: "destructive",
      });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({
      id,
      status,
      type,
    }: {
      id: string;
      status: string;
      type: string;
    }) =>
      api(`/${type}/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
        headers: companyHeaders,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      setStatusDialog(null);
      setNewStatus("");
      toast({ title: t("toast.statusChanged") });
    },
    onError: () => {
      toast({
        title: t("toast.error"),
        description: t("toast.actionFailed"),
        variant: "destructive",
      });
    },
  });

  function handleCreateSR(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {
      branchId: srForm.branchId,
      requestType: srForm.requestType,
      priority: srForm.priority,
      title: srForm.title,
    };
    if (srForm.assetId) body.assetId = srForm.assetId;
    if (srForm.description) body.description = srForm.description;
    createSRMutation.mutate(body);
  }

  function handleCreateWO(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {
      branchId: woForm.branchId,
      orderType: woForm.orderType,
      priority: woForm.priority,
      title: woForm.title,
    };
    if (woForm.assetId) body.assetId = woForm.assetId;
    if (woForm.description) body.description = woForm.description;
    if (woForm.assignedToUserId)
      body.assignedToUserId = woForm.assignedToUserId;
    if (woForm.estimatedCost) body.estimatedCost = woForm.estimatedCost;
    createWOMutation.mutate(body);
  }

  const countByStatus = (s: string) =>
    requests.filter((r) => r.status === s).length;
  const urgentCount = requests.filter(
    (r) =>
      r.priority === "urgent" &&
      r.status !== "completed" &&
      r.status !== "canceled",
  ).length;

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("service.title", "Сервис")}
          </h1>
          <p className="text-muted-foreground mt-0.5">
            {t("service.subtitle", "Заявки, наряды, ТО и запасные части")}
          </p>
        </div>
        {canWriteService && (
          <div className="flex gap-2">
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              {t("service.newRequest", "Заявка")}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowCreateWO(true)}
              className="gap-2"
            >
              <Wrench className="h-4 w-4" />
              {t("service.newWorkOrder", "Наряд")}
            </Button>
          </div>
        )}
      </div>

      {/* Alert banners */}
      {urgentCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700">
            <span className="font-semibold">{urgentCount}</span>{" "}
            {t(
              "service.urgentAlert",
              "срочных заявок требуют немедленного внимания",
            )}
          </p>
        </div>
      )}
      {overdue.length > 0 && (
        <button
          type="button"
          className="flex items-center gap-3 rounded-xl bg-orange-50 border border-orange-200 px-4 py-3 cursor-pointer hover:bg-orange-100 transition-colors w-full text-left"
          onClick={() => setTab("schedules")}
        >
          <CalendarClock className="h-4 w-4 text-orange-600 shrink-0" />
          <p className="text-sm text-orange-700">
            <span className="font-semibold">{overdue.length}</span>{" "}
            {t("service.overdueSchedules", "графиков ТО просрочено")}
          </p>
        </button>
      )}

      {/* KPI cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {KPI_SR.map(({ key, accent, icon: Icon }) => {
          const count = countByStatus(key);
          const isActive = statusFilter === key;
          return (
            <Card
              key={key}
              className={`relative overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${isActive ? "ring-2 ring-primary" : ""}`}
              onClick={() =>
                setStatusFilter(statusFilter === key ? "all" : key)
              }
            >
              <div className={`absolute inset-y-0 left-0 w-1 ${accent}`} />
              <CardContent className="pt-4 pl-5">
                <div className="flex items-center justify-between">
                  <div>
                    {requestsQuery.isLoading ? (
                      <Skeleton className="h-7 w-8" />
                    ) : (
                      <div className="text-2xl font-bold">{count}</div>
                    )}
                    <p
                      className={`text-sm mt-0.5 ${isActive ? "font-semibold text-primary" : "text-muted-foreground"}`}
                    >
                      {String(t(`service.status.${key}`, key))}
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-muted">
                    <Icon
                      className={`h-4 w-4 ${accent.replace("bg-", "text-")}`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Service stats row */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-green-50">
                  <DollarSign className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("service.statsMonthCost", "Расходы за месяц")}
                  </p>
                  <p className="text-lg font-bold">
                    {Number(stats.monthCost ?? 0).toLocaleString("ru-RU")} ₽
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-orange-50">
                  <TrendingDown className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("service.statsLowStock", "Низкий остаток запчастей")}
                  </p>
                  <p className="text-lg font-bold">
                    {stats.lowStockCount ?? 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-red-50">
                  <CalendarClock className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("service.statsOverdue", "Просроченных ТО")}
                  </p>
                  <p className="text-lg font-bold">
                    {stats.overdueSchedules ?? overdue.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-0">
          <TabsTrigger value="requests">
            {t("service.requests", "Заявки")}
            <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">
              {requests.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="workorders">
            {t("service.workOrders", "Наряд-заказы")}
            <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">
              {workOrders.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="spareParts">
            <Package className="h-3.5 w-3.5 mr-1" />
            {t("service.spareParts", "Запчасти")}
            {lowStockParts.length > 0 && (
              <span className="ml-1.5 text-xs bg-orange-100 text-orange-700 rounded-full px-1.5 py-0.5">
                {lowStockParts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="logs">
            <FileText className="h-3.5 w-3.5 mr-1" />
            {t("service.maintenanceLogs", "История ТО")}
          </TabsTrigger>
          <TabsTrigger value="schedules">
            <Calendar className="h-3.5 w-3.5 mr-1" />
            {t("service.schedules", "Планировщик ТО")}
            {overdue.length > 0 && (
              <span className="ml-1.5 text-xs bg-red-100 text-red-700 rounded-full px-1.5 py-0.5">
                {overdue.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Заявки ── */}
        <TabsContent value="requests" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3 flex-wrap">
                <CardTitle className="text-base font-semibold">
                  {t("service.requests", "Заявки")}
                </CardTitle>
                <div className="flex-1" />
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t("common.search")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 w-48"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("common.all")}</SelectItem>
                    {SR_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {String(t(`service.status.${s}`, s))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {requestsQuery.isLoading ? (
                <div className="p-6 space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">
                        {t("service.requestTitle", "Заявка")}
                      </TableHead>
                      <TableHead className="text-xs">
                        {t("service.requestTypeLabel", "Тип")}
                      </TableHead>
                      <TableHead className="text-xs">
                        {t("service.assetLabel", "Транспорт")}
                      </TableHead>
                      <TableHead className="text-xs">
                        {t("service.branchLabel", "Филиал")}
                      </TableHead>
                      <TableHead className="text-xs">
                        {t("service.priorityLabel", "Приоритет")}
                      </TableHead>
                      <TableHead className="text-xs">
                        {t("common.status")}
                      </TableHead>
                      <TableHead className="text-xs">
                        {t("service.assignee", "Мастер")}
                      </TableHead>
                      {canWriteService && (
                        <TableHead className="text-xs">
                          {t("common.actions")}
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((sr) => (
                      <TableRow key={sr.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium max-w-48 truncate text-sm">
                          {sr.title}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {String(
                            t(
                              `service.type.${sr.requestType}`,
                              sr.requestType ?? "",
                            ),
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {sr.assetCode || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {sr.branchCity || sr.branchName || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`text-xs ${PRIORITY_COLORS[sr.priority ?? ""] || ""}`}
                          >
                            {String(
                              t(
                                `service.priority.${sr.priority}`,
                                sr.priority ?? "",
                              ),
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`text-xs ${STATUS_COLORS[sr.status] || "bg-gray-100"}`}
                          >
                            {String(
                              t(`service.status.${sr.status}`, sr.status),
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {sr.assignedToName || "—"}
                        </TableCell>
                        {canWriteService && (
                          <TableCell>
                            <div className="flex gap-1">
                              {sr.status === "new" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => setAssignDialog(sr)}
                                >
                                  <UserCheck className="h-3 w-3" />
                                  {t("service.assign", "Назначить")}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={() =>
                                  setStatusDialog({
                                    ...sr,
                                    type: "service-requests",
                                  })
                                }
                              >
                                {t("fleet.changeStatus", "Статус")}
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {filteredRequests.length === 0 && requests.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-6">
                          <Empty className="border-0">
                            <EmptyHeader>
                              <EmptyMedia variant="icon">
                                <Wrench className="h-5 w-5" />
                              </EmptyMedia>
                              <EmptyTitle>
                                {t("service.emptyRequests")}
                              </EmptyTitle>
                              <EmptyDescription>
                                {t("service.emptyRequestsDesc")}
                              </EmptyDescription>
                            </EmptyHeader>
                          </Empty>
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredRequests.length === 0 && requests.length > 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-6">
                          <Empty className="border-0">
                            <EmptyHeader>
                              <EmptyMedia variant="icon">
                                <Search className="h-5 w-5" />
                              </EmptyMedia>
                              <EmptyTitle>{t("common.noResults")}</EmptyTitle>
                              <EmptyDescription>
                                {t("common.noResultsDescription")}
                              </EmptyDescription>
                            </EmptyHeader>
                          </Empty>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Наряд-заказы ── */}
        <TabsContent value="workorders" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                {t("service.workOrders", "Наряд-заказы")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {workOrdersQuery.isLoading ? (
                <div className="p-6 space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">
                        {t("service.requestTitle", "Наряд")}
                      </TableHead>
                      <TableHead className="text-xs">
                        {t("service.orderTypeLabel", "Тип работ")}
                      </TableHead>
                      <TableHead className="text-xs">
                        {t("service.assetLabel", "Транспорт")}
                      </TableHead>
                      <TableHead className="text-xs">
                        {t("service.branchLabel", "Филиал")}
                      </TableHead>
                      <TableHead className="text-xs">
                        {t("service.priorityLabel", "Приоритет")}
                      </TableHead>
                      <TableHead className="text-xs">
                        {t("common.status")}
                      </TableHead>
                      <TableHead className="text-xs">
                        {t("service.assignee", "Мастер")}
                      </TableHead>
                      <TableHead className="text-xs">
                        {t("service.costLabel", "Стоимость")}
                      </TableHead>
                      {canWriteService && (
                        <TableHead className="text-xs">
                          {t("common.actions")}
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workOrders.map((wo) => (
                      <TableRow key={wo.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium max-w-48 truncate text-sm">
                          {wo.title}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {String(
                            t(
                              `service.orderType.${wo.orderType}`,
                              wo.orderType ?? "",
                            ),
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {wo.assetCode || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {wo.branchCity || wo.branchName || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`text-xs ${PRIORITY_COLORS[wo.priority ?? ""] || ""}`}
                          >
                            {String(
                              t(
                                `service.priority.${wo.priority}`,
                                wo.priority ?? "",
                              ),
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`text-xs ${STATUS_COLORS[wo.status] || "bg-gray-100"}`}
                          >
                            {String(
                              t(`service.status.${wo.status}`, wo.status),
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {wo.assignedToName || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {wo.actualCost ? (
                            <span className="font-medium text-foreground">
                              {Number(wo.actualCost).toLocaleString("ru-RU")} ₽
                            </span>
                          ) : wo.estimatedCost ? (
                            <span className="text-muted-foreground">
                              ~
                              {Number(wo.estimatedCost).toLocaleString("ru-RU")}{" "}
                              ₽
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        {canWriteService && (
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() =>
                                setStatusDialog({ ...wo, type: "work-orders" })
                              }
                            >
                              {t("fleet.changeStatus", "Статус")}
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {workOrders.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="py-6">
                          <Empty className="border-0">
                            <EmptyHeader>
                              <EmptyMedia variant="icon">
                                <Wrench className="h-5 w-5" />
                              </EmptyMedia>
                              <EmptyTitle>
                                {t("service.emptyWorkOrders")}
                              </EmptyTitle>
                              <EmptyDescription>
                                {t("service.emptyWorkOrdersDesc")}
                              </EmptyDescription>
                            </EmptyHeader>
                          </Empty>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Запчасти ── */}
        <TabsContent value="spareParts" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base font-semibold">
                  {t("service.spareParts", "Склад запчастей")}
                </CardTitle>
                {lowStockParts.length > 0 && (
                  <Badge
                    variant="outline"
                    className="text-orange-700 border-orange-300 bg-orange-50 gap-1"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {lowStockParts.length}{" "}
                    {t("service.lowStock", "низкий остаток")}
                  </Badge>
                )}
                <div className="flex-1" />
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t(
                      "service.searchParts",
                      "Поиск по названию или SKU...",
                    )}
                    value={partsSearch}
                    onChange={(e) => setPartsSearch(e.target.value)}
                    className="pl-9 w-56"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {sparePartsQuery.isLoading ? (
                <div className="p-6 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">
                        {t("service.partName", "Запчасть")}
                      </TableHead>
                      <TableHead className="text-xs">SKU</TableHead>
                      <TableHead className="text-xs">
                        {t("service.category", "Категория")}
                      </TableHead>
                      <TableHead className="text-xs">
                        {t("service.branch", "Склад/Филиал")}
                      </TableHead>
                      <TableHead className="text-xs text-right">
                        {t("service.inStock", "В наличии")}
                      </TableHead>
                      <TableHead className="text-xs text-right">
                        {t("service.minAlert", "Мин. остаток")}
                      </TableHead>
                      <TableHead className="text-xs text-right">
                        {t("service.costPrice", "Цена/ед")}
                      </TableHead>
                      <TableHead className="text-xs">
                        {t("service.location", "Место хранения")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredParts.map((p) => {
                      const isLow =
                        parseFloat(p.qtyInStock) <= parseFloat(p.minQtyAlert);
                      return (
                        <TableRow
                          key={p.id}
                          className={`hover:bg-muted/30 ${isLow ? "bg-orange-50/50" : ""}`}
                        >
                          <TableCell className="font-medium text-sm">
                            <div className="flex items-center gap-2">
                              {isLow && (
                                <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                              )}
                              {p.name}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {p.sku || "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground capitalize">
                            {p.category}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {p.branchName || "—"}
                          </TableCell>
                          <TableCell
                            className={`text-right font-bold text-sm ${isLow ? "text-orange-600" : "text-green-600"}`}
                          >
                            {parseFloat(p.qtyInStock).toLocaleString("ru-RU")}{" "}
                            {p.unit}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {parseFloat(p.minQtyAlert).toLocaleString("ru-RU")}{" "}
                            {p.unit}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {p.costPrice
                              ? `${Number(p.costPrice).toLocaleString("ru-RU")} ₽`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {p.location || "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredParts.length === 0 && spareParts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-6">
                          <Empty className="border-0">
                            <EmptyHeader>
                              <EmptyMedia variant="icon">
                                <Package className="h-5 w-5" />
                              </EmptyMedia>
                              <EmptyTitle>{t("service.emptyParts")}</EmptyTitle>
                              <EmptyDescription>
                                {t("service.emptyPartsDesc")}
                              </EmptyDescription>
                            </EmptyHeader>
                          </Empty>
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredParts.length === 0 && spareParts.length > 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-6">
                          <Empty className="border-0">
                            <EmptyHeader>
                              <EmptyMedia variant="icon">
                                <Search className="h-5 w-5" />
                              </EmptyMedia>
                              <EmptyTitle>{t("common.noResults")}</EmptyTitle>
                              <EmptyDescription>
                                {t("common.noResultsDescription")}
                              </EmptyDescription>
                            </EmptyHeader>
                          </Empty>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── История ТО ── */}
        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base font-semibold">
                  {t("service.maintenanceLogs", "История обслуживания")}
                </CardTitle>
                <div className="flex-1" />
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t(
                      "service.searchLogs",
                      "Поиск по транспорту или заметкам...",
                    )}
                    value={logsSearch}
                    onChange={(e) => setLogsSearch(e.target.value)}
                    className="pl-9 w-56"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {maintenanceLogsQuery.isLoading ? (
                <div className="p-6 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">
                        {t("service.logType", "Тип работы")}
                      </TableHead>
                      <TableHead className="text-xs">
                        {t("service.assetLabel", "Транспорт")}
                      </TableHead>
                      <TableHead className="text-xs">
                        {t("service.performedAt", "Дата")}
                      </TableHead>
                      <TableHead className="text-xs">
                        {t("service.mechanic", "Механик")}
                      </TableHead>
                      <TableHead className="text-xs text-right">
                        {t("service.odometerKm", "Пробег (км)")}
                      </TableHead>
                      <TableHead className="text-xs text-right">
                        {t("service.costLabel", "Стоимость")}
                      </TableHead>
                      <TableHead className="text-xs">
                        {t("service.notes", "Заметки")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((l) => (
                      <TableRow key={l.id} className="hover:bg-muted/30">
                        <TableCell className="text-sm font-medium">
                          {LOG_TYPE_LABELS[l.logType ?? ""] ?? l.logType}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {l.assetCode || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(l.performedAt).toLocaleDateString("ru-RU")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {l.performedByName || "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {l.odometerKm
                            ? Number(l.odometerKm).toLocaleString("ru-RU")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {l.cost && Number(l.cost) > 0
                            ? `${Number(l.cost).toLocaleString("ru-RU")} ₽`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-48 truncate">
                          {l.notes || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredLogs.length === 0 &&
                      maintenanceLogs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="py-6">
                            <Empty className="border-0">
                              <EmptyHeader>
                                <EmptyMedia variant="icon">
                                  <FileText className="h-5 w-5" />
                                </EmptyMedia>
                                <EmptyTitle>
                                  {t("service.emptyLogs")}
                                </EmptyTitle>
                                <EmptyDescription>
                                  {t("service.emptyLogsDesc")}
                                </EmptyDescription>
                              </EmptyHeader>
                            </Empty>
                          </TableCell>
                        </TableRow>
                      )}
                    {filteredLogs.length === 0 &&
                      maintenanceLogs.length > 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="py-6">
                            <Empty className="border-0">
                              <EmptyHeader>
                                <EmptyMedia variant="icon">
                                  <Search className="h-5 w-5" />
                                </EmptyMedia>
                                <EmptyTitle>{t("common.noResults")}</EmptyTitle>
                                <EmptyDescription>
                                  {t("common.noResultsDescription")}
                                </EmptyDescription>
                              </EmptyHeader>
                            </Empty>
                          </TableCell>
                        </TableRow>
                      )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Планировщик ТО ── */}
        <TabsContent value="schedules" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base font-semibold">
                  {t("service.schedules", "Планировщик ТО")}
                </CardTitle>
                {overdue.length > 0 && (
                  <Badge
                    variant="outline"
                    className="text-red-700 border-red-300 bg-red-50 gap-1"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {overdue.length} {t("service.overdue", "просрочено")}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {schedulesQuery.isLoading ? (
                <div className="p-6 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">
                        {t("service.scheduleName", "Наименование")}
                      </TableHead>
                      <TableHead className="text-xs">
                        {t("service.assetLabel", "Транспорт")}
                      </TableHead>
                      <TableHead className="text-xs">
                        {t("service.interval", "Интервал")}
                      </TableHead>
                      <TableHead className="text-xs">
                        {t("service.lastDone", "Последнее ТО")}
                      </TableHead>
                      <TableHead className="text-xs">
                        {t("service.nextDue", "Плановая дата")}
                      </TableHead>
                      <TableHead className="text-xs">
                        {t("service.status", "Статус")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedules.map((s) => {
                      const days = daysUntil(s.nextDueAt);
                      const isOverdue = days !== null && days < 0;
                      const isSoon = days !== null && days >= 0 && days <= 7;
                      return (
                        <TableRow
                          key={s.id}
                          className={`hover:bg-muted/30 ${isOverdue ? "bg-red-50/40" : isSoon ? "bg-orange-50/40" : ""}`}
                        >
                          <TableCell className="font-medium text-sm">
                            {s.name}
                          </TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">
                            {s.assetCode || "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {s.intervalDays ? `${s.intervalDays} дн.` : ""}
                            {s.intervalKm
                              ? ` / ${Number(s.intervalKm).toLocaleString("ru-RU")} км`
                              : ""}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {s.lastDoneAt
                              ? new Date(s.lastDoneAt).toLocaleDateString(
                                  "ru-RU",
                                )
                              : "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {s.nextDueAt
                              ? new Date(s.nextDueAt).toLocaleDateString(
                                  "ru-RU",
                                )
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {isOverdue ? (
                              <Badge className="text-xs bg-red-100 text-red-700 gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {Math.abs(days!)} д. назад
                              </Badge>
                            ) : isSoon ? (
                              <Badge className="text-xs bg-orange-100 text-orange-700">
                                через {days} д.
                              </Badge>
                            ) : days !== null ? (
                              <Badge className="text-xs bg-green-100 text-green-700">
                                через {days} д.
                              </Badge>
                            ) : (
                              <Badge className="text-xs bg-gray-100 text-gray-600">
                                —
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {schedules.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-6">
                          <Empty className="border-0">
                            <EmptyHeader>
                              <EmptyMedia variant="icon">
                                <Calendar className="h-5 w-5" />
                              </EmptyMedia>
                              <EmptyTitle>
                                {t("service.emptySchedules")}
                              </EmptyTitle>
                              <EmptyDescription>
                                {t("service.emptySchedulesDesc")}
                              </EmptyDescription>
                            </EmptyHeader>
                          </Empty>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Диалог: Новая заявка ── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("service.newRequest", "Новая заявка на обслуживание")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSR} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("service.requestTitle", "Заголовок")} *</Label>
              <Input
                value={srForm.title}
                onChange={(e) =>
                  setSrForm({ ...srForm, title: e.target.value })
                }
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("service.branchLabel", "Филиал")} *</Label>
                <Select
                  value={srForm.branchId}
                  onValueChange={(v) => setSrForm({ ...srForm, branchId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("fleet.selectBranch")} />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} ({b.city})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  {t("service.requestTypeLabel", "Тип неисправности")}
                </Label>
                <Select
                  value={srForm.requestType}
                  onValueChange={(v) =>
                    setSrForm({ ...srForm, requestType: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUEST_TYPES.map((rt) => (
                      <SelectItem key={rt} value={rt}>
                        {String(t(`service.type.${rt}`, rt))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("service.priorityLabel", "Приоритет")}</Label>
                <Select
                  value={srForm.priority}
                  onValueChange={(v) => setSrForm({ ...srForm, priority: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {String(t(`service.priority.${p}`, p))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("service.assetLabel", "Транспорт")}</Label>
                <Select
                  value={srForm.assetId}
                  onValueChange={(v) => setSrForm({ ...srForm, assetId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("rentals.selectAsset")} />
                  </SelectTrigger>
                  <SelectContent>
                    {allAssets.map(
                      (a: {
                        id: string;
                        internalCode?: string;
                        brand?: string;
                        model?: string;
                      }) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.internalCode} — {a.brand} {a.model}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("service.descriptionLabel", "Описание")}</Label>
              <Textarea
                value={srForm.description}
                onChange={(e) =>
                  setSrForm({ ...srForm, description: e.target.value })
                }
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreate(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={
                  createSRMutation.isPending ||
                  !srForm.title ||
                  !srForm.branchId
                }
              >
                {createSRMutation.isPending
                  ? t("common.saving")
                  : t("common.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Диалог: Новый наряд ── */}
      <Dialog open={showCreateWO} onOpenChange={setShowCreateWO}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("service.newWorkOrder", "Новый наряд-заказ")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateWO} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("service.requestTitle", "Заголовок")} *</Label>
              <Input
                value={woForm.title}
                onChange={(e) =>
                  setWoForm({ ...woForm, title: e.target.value })
                }
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("service.branchLabel", "Филиал")} *</Label>
                <Select
                  value={woForm.branchId}
                  onValueChange={(v) => setWoForm({ ...woForm, branchId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("fleet.selectBranch")} />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} ({b.city})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("service.orderTypeLabel", "Тип работ")}</Label>
                <Select
                  value={woForm.orderType}
                  onValueChange={(v) => setWoForm({ ...woForm, orderType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WO_TYPES.map((wt) => (
                      <SelectItem key={wt} value={wt}>
                        {String(t(`service.orderType.${wt}`, wt))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("service.priorityLabel", "Приоритет")}</Label>
                <Select
                  value={woForm.priority}
                  onValueChange={(v) => setWoForm({ ...woForm, priority: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {String(t(`service.priority.${p}`, p))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("service.assignee", "Мастер")}</Label>
                <Select
                  value={woForm.assignedToUserId}
                  onValueChange={(v) =>
                    setWoForm({ ...woForm, assignedToUserId: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t(
                        "service.selectMechanic",
                        "Выберите мастера",
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {mechanics.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.fullName} ({m.phone})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("service.descriptionLabel", "Описание")}</Label>
              <Textarea
                value={woForm.description}
                onChange={(e) =>
                  setWoForm({ ...woForm, description: e.target.value })
                }
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateWO(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={
                  createWOMutation.isPending ||
                  !woForm.title ||
                  !woForm.branchId
                }
              >
                {createWOMutation.isPending
                  ? t("common.saving")
                  : t("common.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Диалог: Назначить мастера ── */}
      <Dialog open={!!assignDialog} onOpenChange={() => setAssignDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("service.assignMechanic", "Назначить мастера")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {assignDialog?.title}
            </p>
            <div className="space-y-2">
              <Label>{t("service.selectMechanic", "Выберите мастера")}</Label>
              <Select
                value={selectedMechanic}
                onValueChange={setSelectedMechanic}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t(
                      "service.selectMechanic",
                      "Выберите мастера",
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {mechanics.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.fullName} ({m.phone})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() =>
                assignMutation.mutate({
                  id: assignDialog?.id ?? "",
                  userId: selectedMechanic,
                })
              }
              disabled={!selectedMechanic || assignMutation.isPending}
            >
              {assignMutation.isPending
                ? t("common.saving")
                : t("service.assign", "Назначить")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Диалог: Сменить статус ── */}
      <Dialog
        open={!!statusDialog}
        onOpenChange={() => {
          setStatusDialog(null);
          setNewStatus("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("fleet.changeStatus", "Изменить статус")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {statusDialog?.title}
            </p>
            <div className="space-y-2">
              <Label>{t("common.status")}</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("common.selectStatus", "Выберите статус")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {(statusDialog?.type === "service-requests"
                    ? SR_STATUSES
                    : [
                        "draft",
                        "assigned",
                        "en_route",
                        "in_progress",
                        "waiting_parts",
                        "completed",
                        "canceled",
                      ]
                  ).map((s) => (
                    <SelectItem key={s} value={s}>
                      {String(t(`service.status.${s}`, s))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setStatusDialog(null);
                setNewStatus("");
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() =>
                statusMutation.mutate({
                  id: statusDialog?.id ?? "",
                  status: newStatus,
                  type: statusDialog?.type ?? "",
                })
              }
              disabled={!newStatus || statusMutation.isPending}
            >
              {statusMutation.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
