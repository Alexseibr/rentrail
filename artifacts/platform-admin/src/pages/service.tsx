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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Wrench, UserCheck, Search, AlertTriangle, Clock, CheckCircle, Loader2 } from "lucide-react";
import { useRolePermissions } from "@/hooks/use-role-permissions";

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

const REQUEST_TYPES = ["breakdown", "flat_tire", "brake_issue", "battery_issue", "electrical", "body_damage", "scheduled_maintenance", "inspection", "cleaning", "other"];
const PRIORITIES = ["low", "medium", "high", "urgent"];
const SR_STATUSES = ["new", "assigned", "in_progress", "on_hold", "completed", "canceled"];
const WO_TYPES = ["field_repair", "workshop_repair", "scheduled_maintenance", "inspection", "recovery", "cleaning"];

const KPI_SR = [
  { key: "new",         accent: "bg-blue-500",   icon: AlertTriangle },
  { key: "in_progress", accent: "bg-yellow-500", icon: Loader2 },
  { key: "on_hold",     accent: "bg-orange-500", icon: Clock },
  { key: "completed",   accent: "bg-green-500",  icon: CheckCircle },
] as const;

export default function ServicePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { canWriteService } = useRolePermissions();
  const companyId = user?.memberships?.[0]?.companyId;
  const companyHeaders: Record<string, string> = companyId ? { "x-company-id": companyId } : {};

  const [tab, setTab] = useState("requests");
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateWO, setShowCreateWO] = useState(false);
  const [assignDialog, setAssignDialog] = useState<any>(null);
  const [statusDialog, setStatusDialog] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedMechanic, setSelectedMechanic] = useState("");
  const [newStatus, setNewStatus] = useState("");

  const [srForm, setSrForm] = useState({
    branchId: "", assetId: "", requestType: "breakdown", priority: "medium", title: "", description: "",
  });
  const [woForm, setWoForm] = useState({
    branchId: "", assetId: "", orderType: "field_repair", priority: "medium", title: "", description: "", assignedToUserId: "", estimatedCost: "",
  });

  const requestsQuery = useQuery({
    queryKey: ["service-requests", companyId, statusFilter],
    queryFn: () => {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      return api<any>(`/service-requests${params}`, { headers: companyHeaders });
    },
    enabled: !!companyId,
  });

  const workOrdersQuery = useQuery({
    queryKey: ["work-orders", companyId],
    queryFn: () => api<any>("/work-orders", { headers: companyHeaders }),
    enabled: !!companyId,
  });

  const branchesQuery = useQuery({
    queryKey: ["branches", companyId],
    queryFn: () => api<any>("/branches", { headers: companyHeaders }),
    enabled: !!companyId,
  });

  const assetsQuery = useQuery({
    queryKey: ["assets-all", companyId],
    queryFn: () => api<any>("/assets", { headers: companyHeaders }),
    enabled: !!companyId && (showCreate || showCreateWO),
  });

  const mechanicsQuery = useQuery({
    queryKey: ["mechanics", companyId],
    queryFn: () => api<any>("/mechanics", { headers: companyHeaders }),
    enabled: !!companyId,
  });

  const branches = Array.isArray(branchesQuery.data) ? branchesQuery.data : [];
  const allAssets = assetsQuery.data ?? [];
  const mechanics = Array.isArray(mechanicsQuery.data) ? mechanicsQuery.data : [];
  const requests = Array.isArray(requestsQuery.data) ? requestsQuery.data : [];
  const workOrders = Array.isArray(workOrdersQuery.data) ? workOrdersQuery.data : [];

  const filteredRequests = search
    ? requests.filter((r: any) =>
        r.title?.toLowerCase().includes(search.toLowerCase()) ||
        r.assetCode?.toLowerCase().includes(search.toLowerCase())
      )
    : requests;

  const createSRMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/service-requests", { method: "POST", body: JSON.stringify(body), headers: companyHeaders }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-requests"] });
      setShowCreate(false);
      setSrForm({ branchId: "", assetId: "", requestType: "breakdown", priority: "medium", title: "", description: "" });
    },
  });

  const createWOMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/work-orders", { method: "POST", body: JSON.stringify(body), headers: companyHeaders }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      setShowCreateWO(false);
      setWoForm({ branchId: "", assetId: "", orderType: "field_repair", priority: "medium", title: "", description: "", assignedToUserId: "", estimatedCost: "" });
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      api(`/service-requests/${id}/assign`, { method: "POST", body: JSON.stringify({ assignedToUserId: userId }), headers: companyHeaders }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-requests"] });
      setAssignDialog(null);
      setSelectedMechanic("");
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, type }: { id: string; status: string; type: string }) =>
      api(`/${type}/${id}/status`, { method: "POST", body: JSON.stringify({ status }), headers: companyHeaders }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      setStatusDialog(null);
      setNewStatus("");
    },
  });

  function handleCreateSR(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { branchId: srForm.branchId, requestType: srForm.requestType, priority: srForm.priority, title: srForm.title };
    if (srForm.assetId) body.assetId = srForm.assetId;
    if (srForm.description) body.description = srForm.description;
    createSRMutation.mutate(body);
  }

  function handleCreateWO(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { branchId: woForm.branchId, orderType: woForm.orderType, priority: woForm.priority, title: woForm.title };
    if (woForm.assetId) body.assetId = woForm.assetId;
    if (woForm.description) body.description = woForm.description;
    if (woForm.assignedToUserId) body.assignedToUserId = woForm.assignedToUserId;
    if (woForm.estimatedCost) body.estimatedCost = woForm.estimatedCost;
    createWOMutation.mutate(body);
  }

  const countByStatus = (s: string) => requests.filter((r: any) => r.status === s).length;

  const urgentCount = requests.filter((r: any) => r.priority === "urgent" && r.status !== "completed" && r.status !== "canceled").length;

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("service.title", "Сервис")}</h1>
          <p className="text-muted-foreground mt-0.5">{t("service.subtitle", "Заявки на обслуживание и наряд-заказы")}</p>
        </div>
        {canWriteService && (
          <div className="flex gap-2">
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              {t("service.newRequest", "Заявка")}
            </Button>
            <Button variant="outline" onClick={() => setShowCreateWO(true)} className="gap-2">
              <Wrench className="h-4 w-4" />
              {t("service.newWorkOrder", "Наряд")}
            </Button>
          </div>
        )}
      </div>

      {urgentCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700">
            <span className="font-semibold">{urgentCount}</span>{" "}
            {t("service.urgentAlert", "срочных заявок требуют немедленного внимания")}
          </p>
        </div>
      )}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {KPI_SR.map(({ key, accent, icon: Icon }) => {
          const count = countByStatus(key);
          const isActive = statusFilter === key;
          return (
            <Card
              key={key}
              className={`relative overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${isActive ? "ring-2 ring-primary" : ""}`}
              onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}
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
                    <p className={`text-sm mt-0.5 ${isActive ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                      {String(t(`service.status.${key}`, key))}
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-muted">
                    <Icon className={`h-4 w-4 ${accent.replace("bg-", "text-")}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-0">
          <TabsTrigger value="requests">
            {t("service.requests", "Заявки")}
            <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">{requests.length}</span>
          </TabsTrigger>
          <TabsTrigger value="workorders">
            {t("service.workOrders", "Наряд-заказы")}
            <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">{workOrders.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3 flex-wrap">
                <CardTitle className="text-base font-semibold">{t("service.requests", "Заявки")}</CardTitle>
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
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("common.all")}</SelectItem>
                    {SR_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{String(t(`service.status.${s}`, s))}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {requestsQuery.isLoading ? (
                <div className="p-6 space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">{t("service.requestTitle", "Заявка")}</TableHead>
                      <TableHead className="text-xs">{t("service.requestTypeLabel", "Тип")}</TableHead>
                      <TableHead className="text-xs">{t("service.assetLabel", "Транспорт")}</TableHead>
                      <TableHead className="text-xs">{t("service.branchLabel", "Филиал")}</TableHead>
                      <TableHead className="text-xs">{t("service.priorityLabel", "Приоритет")}</TableHead>
                      <TableHead className="text-xs">{t("common.status")}</TableHead>
                      <TableHead className="text-xs">{t("service.assignee", "Мастер")}</TableHead>
                      {canWriteService && <TableHead className="text-xs">{t("common.actions")}</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((sr: any) => (
                      <TableRow key={sr.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium max-w-48 truncate text-sm">{sr.title}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{String(t(`service.type.${sr.requestType}`, sr.requestType))}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">{sr.assetCode || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{sr.branchCity || sr.branchName || "—"}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${PRIORITY_COLORS[sr.priority] || ""}`}>
                            {String(t(`service.priority.${sr.priority}`, sr.priority))}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${STATUS_COLORS[sr.status] || "bg-gray-100"}`}>
                            {String(t(`service.status.${sr.status}`, sr.status))}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{sr.assignedToName || "—"}</TableCell>
                        {canWriteService && (
                          <TableCell>
                            <div className="flex gap-1">
                              {sr.status === "new" && (
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAssignDialog(sr)}>
                                  <UserCheck className="h-3 w-3" />
                                  {t("service.assign", "Назначить")}
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setStatusDialog({ ...sr, type: "service-requests" })}>
                                {t("fleet.changeStatus", "Статус")}
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {filteredRequests.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-12 text-center">
                          <Wrench className="h-10 w-10 mx-auto mb-2 text-muted-foreground opacity-20" />
                          <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workorders" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">{t("service.workOrders", "Наряд-заказы")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {workOrdersQuery.isLoading ? (
                <div className="p-6 space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">{t("service.requestTitle", "Наряд")}</TableHead>
                      <TableHead className="text-xs">{t("service.orderTypeLabel", "Тип работ")}</TableHead>
                      <TableHead className="text-xs">{t("service.assetLabel", "Транспорт")}</TableHead>
                      <TableHead className="text-xs">{t("service.branchLabel", "Филиал")}</TableHead>
                      <TableHead className="text-xs">{t("service.priorityLabel", "Приоритет")}</TableHead>
                      <TableHead className="text-xs">{t("common.status")}</TableHead>
                      <TableHead className="text-xs">{t("service.assignee", "Мастер")}</TableHead>
                      {canWriteService && <TableHead className="text-xs">{t("common.actions")}</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workOrders.map((wo: any) => (
                      <TableRow key={wo.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium max-w-48 truncate text-sm">{wo.title}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{String(t(`service.orderType.${wo.orderType}`, wo.orderType))}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">{wo.assetCode || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{wo.branchCity || wo.branchName || "—"}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${PRIORITY_COLORS[wo.priority] || ""}`}>
                            {String(t(`service.priority.${wo.priority}`, wo.priority))}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${STATUS_COLORS[wo.status] || "bg-gray-100"}`}>
                            {String(t(`service.status.${wo.status}`, wo.status))}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{wo.assignedToName || "—"}</TableCell>
                        {canWriteService && (
                          <TableCell>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setStatusDialog({ ...wo, type: "work-orders" })}>
                              {t("fleet.changeStatus", "Статус")}
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {workOrders.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-12 text-center">
                          <Wrench className="h-10 w-10 mx-auto mb-2 text-muted-foreground opacity-20" />
                          <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
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

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("service.newRequest", "Новая заявка на обслуживание")}</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateSR} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("service.requestTitle", "Заголовок")} *</Label>
              <Input value={srForm.title} onChange={(e) => setSrForm({ ...srForm, title: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("service.branchLabel", "Филиал")} *</Label>
                <Select value={srForm.branchId} onValueChange={(v) => setSrForm({ ...srForm, branchId: v })}>
                  <SelectTrigger><SelectValue placeholder={t("fleet.selectBranch")} /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name} ({b.city})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("service.requestTypeLabel", "Тип неисправности")}</Label>
                <Select value={srForm.requestType} onValueChange={(v) => setSrForm({ ...srForm, requestType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REQUEST_TYPES.map((rt) => <SelectItem key={rt} value={rt}>{String(t(`service.type.${rt}`, rt))}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("service.priorityLabel", "Приоритет")}</Label>
                <Select value={srForm.priority} onValueChange={(v) => setSrForm({ ...srForm, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{String(t(`service.priority.${p}`, p))}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("service.assetLabel", "Транспорт")}</Label>
                <Select value={srForm.assetId} onValueChange={(v) => setSrForm({ ...srForm, assetId: v })}>
                  <SelectTrigger><SelectValue placeholder={t("rentals.selectAsset")} /></SelectTrigger>
                  <SelectContent>
                    {allAssets.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.internalCode} — {a.brand} {a.model}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("service.descriptionLabel", "Описание")}</Label>
              <Textarea value={srForm.description} onChange={(e) => setSrForm({ ...srForm, description: e.target.value })} rows={3} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={createSRMutation.isPending || !srForm.title || !srForm.branchId}>
                {createSRMutation.isPending ? t("common.saving") : t("common.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateWO} onOpenChange={setShowCreateWO}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("service.newWorkOrder", "Новый наряд-заказ")}</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateWO} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("service.requestTitle", "Заголовок")} *</Label>
              <Input value={woForm.title} onChange={(e) => setWoForm({ ...woForm, title: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("service.branchLabel", "Филиал")} *</Label>
                <Select value={woForm.branchId} onValueChange={(v) => setWoForm({ ...woForm, branchId: v })}>
                  <SelectTrigger><SelectValue placeholder={t("fleet.selectBranch")} /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name} ({b.city})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("service.orderTypeLabel", "Тип работ")}</Label>
                <Select value={woForm.orderType} onValueChange={(v) => setWoForm({ ...woForm, orderType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WO_TYPES.map((wt) => <SelectItem key={wt} value={wt}>{String(t(`service.orderType.${wt}`, wt))}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("service.priorityLabel", "Приоритет")}</Label>
                <Select value={woForm.priority} onValueChange={(v) => setWoForm({ ...woForm, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{String(t(`service.priority.${p}`, p))}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("service.assignee", "Мастер")}</Label>
                <Select value={woForm.assignedToUserId} onValueChange={(v) => setWoForm({ ...woForm, assignedToUserId: v })}>
                  <SelectTrigger><SelectValue placeholder={t("service.selectMechanic", "Выберите мастера")} /></SelectTrigger>
                  <SelectContent>
                    {mechanics.map((m: any) => <SelectItem key={m.userId} value={m.userId}>{m.fullName} ({m.phone})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("service.descriptionLabel", "Описание")}</Label>
              <Textarea value={woForm.description} onChange={(e) => setWoForm({ ...woForm, description: e.target.value })} rows={3} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateWO(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={createWOMutation.isPending || !woForm.title || !woForm.branchId}>
                {createWOMutation.isPending ? t("common.saving") : t("common.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assignDialog} onOpenChange={() => setAssignDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("service.assign", "Назначить мастера")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("service.assignee", "Мастер")}</Label>
              <Select value={selectedMechanic} onValueChange={setSelectedMechanic}>
                <SelectTrigger><SelectValue placeholder={t("service.selectMechanic")} /></SelectTrigger>
                <SelectContent>
                  {mechanics.map((m: any) => (
                    <SelectItem key={m.userId} value={m.userId}>{m.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignDialog(null)}>{t("common.cancel")}</Button>
              <Button
                disabled={!selectedMechanic || assignMutation.isPending}
                onClick={() => assignMutation.mutate({ id: assignDialog.id, userId: selectedMechanic })}
              >
                {assignMutation.isPending ? t("common.saving") : t("service.assign")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!statusDialog} onOpenChange={() => setStatusDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("fleet.changeStatus", "Сменить статус")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("common.status")}</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue placeholder={t("common.status")} /></SelectTrigger>
                <SelectContent>
                  {(statusDialog?.type === "service-requests" ? SR_STATUSES : ["new", "in_progress", "on_hold", "completed", "canceled"]).map((s) => (
                    <SelectItem key={s} value={s}>{String(t(`service.status.${s}`, s))}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStatusDialog(null)}>{t("common.cancel")}</Button>
              <Button
                disabled={!newStatus || statusMutation.isPending}
                onClick={() => statusMutation.mutate({ id: statusDialog.id, status: newStatus, type: statusDialog.type })}
              >
                {statusMutation.isPending ? t("common.saving") : t("common.save")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
