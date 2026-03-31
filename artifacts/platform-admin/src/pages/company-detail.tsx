import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle, Ban, Pause, XCircle } from "lucide-react";
import { useState } from "react";

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  blocked: "bg-red-100 text-red-800",
  suspended: "bg-orange-100 text-orange-800",
  cancelled: "bg-gray-100 text-gray-800",
};

interface ModerationForm {
  action: string;
  reasonCode: string;
  reasonText: string;
}

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100);
}

export default function CompanyDetailPage() {
  const [, params] = useRoute("/companies/:id");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const companyId = params?.id;
  const [modForm, setModForm] = useState<ModerationForm | null>(null);
  const [showSetPlan, setShowSetPlan] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");

  const { data: company, isLoading } = useQuery({
    queryKey: ["company", companyId],
    queryFn: () => api<Record<string, unknown>>(`/platform/companies/${companyId}`),
    enabled: !!companyId,
  });

  const { data: usage } = useQuery({
    queryKey: ["company", companyId, "usage"],
    queryFn: () => api<Record<string, unknown>>(`/platform/companies/${companyId}/usage`),
    enabled: !!companyId,
  });

  const { data: health } = useQuery({
    queryKey: ["company", companyId, "health"],
    queryFn: () => api<Record<string, unknown>>(`/platform/companies/${companyId}/health`),
    enabled: !!companyId,
  });

  const { data: subscriptions } = useQuery({
    queryKey: ["company", companyId, "subscriptions"],
    queryFn: () =>
      api<{ items: Array<Record<string, unknown>>; pagination: { total: number; totalPages: number } }>(
        `/platform/billing/subscriptions?companyId=${companyId}`,
      ),
    enabled: !!companyId,
  });

  const { data: invoices } = useQuery({
    queryKey: ["company", companyId, "invoices"],
    queryFn: () =>
      api<{ items: Array<Record<string, unknown>>; pagination: { total: number; totalPages: number } }>(
        `/platform/billing/invoices?companyId=${companyId}&limit=10`,
      ),
    enabled: !!companyId,
  });

  const { data: auditData } = useQuery({
    queryKey: ["company", companyId, "audit"],
    queryFn: () =>
      api<{ items: Array<Record<string, unknown>>; pagination: Record<string, unknown> }>(
        `/platform/support/tenants/${companyId}/audit?limit=20`,
      ),
    enabled: !!companyId,
  });

  const { data: wlSettings } = useQuery({
    queryKey: ["company", companyId, "whitelabel"],
    queryFn: () =>
      api<Record<string, unknown>>(`/platform/companies/${companyId}/white-label`).catch(() => null),
    enabled: !!companyId,
  });

  const plans = useQuery({
    queryKey: ["billing", "plans-all"],
    queryFn: () => api<Array<Record<string, unknown>>>("/platform/billing/plans"),
  });

  const moderationMutation = useMutation({
    mutationFn: (form: ModerationForm) =>
      api(`/platform/companies/${companyId}/${form.action}`, {
        method: "POST",
        body: JSON.stringify({
          reasonCode: form.reasonCode,
          reasonText: form.reasonText,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", companyId] });
      setModForm(null);
    },
  });

  const setPlanMutation = useMutation({
    mutationFn: (planId: string) =>
      api(`/platform/companies/${companyId}/set-plan`, {
        method: "POST",
        body: JSON.stringify({ planId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", companyId] });
      setShowSetPlan(false);
      setSelectedPlanId("");
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Company not found</p>
      </div>
    );
  }

  const status = company.status as string;

  const moderationActions = [
    { action: "approve", label: "Approve", icon: CheckCircle, show: status === "pending", variant: "default" as const },
    { action: "block", label: "Block", icon: Ban, show: status === "active" || status === "pending", variant: "destructive" as const },
    { action: "suspend", label: "Suspend", icon: Pause, show: status === "active", variant: "outline" as const },
    { action: "unblock", label: "Unblock", icon: CheckCircle, show: status === "blocked" || status === "suspended", variant: "default" as const },
    { action: "cancel", label: "Cancel", icon: XCircle, show: status !== "cancelled", variant: "destructive" as const },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/companies")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{company.name as string}</h1>
            <Badge variant="secondary" className={statusColors[status] || ""}>
              {status}
            </Badge>
          </div>
          <p className="text-muted-foreground">{company.slug as string}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSetPlan(true)}>
            Set Plan
          </Button>
          {moderationActions
            .filter((a) => a.show)
            .map((a) => (
              <Button
                key={a.action}
                variant={a.variant}
                size="sm"
                onClick={() =>
                  setModForm({ action: a.action, reasonCode: "", reasonText: "" })
                }
              >
                <a.icon className="h-4 w-4 mr-1" />
                {a.label}
              </Button>
            ))}
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="whitelabel">White Label</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Company Information</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                {[
                  ["Name", company.name],
                  ["Slug", company.slug],
                  ["Legal Name", company.legalName],
                  ["Email", company.email],
                  ["Phone", company.phone],
                  ["Country", company.country],
                  ["Currency", company.currency],
                  ["Timezone", company.timezone],
                  ["Created", company.createdAt ? new Date(company.createdAt as string).toLocaleString() : null],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <dt className="text-muted-foreground">{label as string}</dt>
                    <dd className="font-medium mt-0.5">{(value as string) || "-"}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscription" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Subscriptions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Trial Ends</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(subscriptions?.items || []).map((sub) => (
                    <TableRow key={sub.id as string}>
                      <TableCell className="font-medium">{(sub.planName as string) || (sub.planId as string)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{sub.status as string}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {sub.currentPeriodStart
                          ? `${new Date(sub.currentPeriodStart as string).toLocaleDateString()} - ${new Date(sub.currentPeriodEnd as string).toLocaleDateString()}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {sub.trialEndsAt ? new Date(sub.trialEndsAt as string).toLocaleDateString() : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(subscriptions?.items || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                        No subscriptions
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Invoices</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(invoices?.items || []).map((inv) => (
                    <TableRow key={inv.id as string}>
                      <TableCell className="font-medium">
                        {formatCurrency(inv.amount as number, inv.currency as string)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{inv.status as string}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {inv.dueDate ? new Date(inv.dueDate as string).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {inv.createdAt ? new Date(inv.createdAt as string).toLocaleDateString() : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(invoices?.items || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                        No invoices
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Usage Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              {usage ? (
                <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {Object.entries(usage).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-muted-foreground capitalize">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </dt>
                      <dd className="text-lg font-semibold mt-0.5">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-muted-foreground">No usage data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Health Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {health ? (
                <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {Object.entries(health).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-muted-foreground capitalize">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </dt>
                      <dd className="text-lg font-semibold mt-0.5">
                        {typeof value === "object" ? JSON.stringify(value) : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-muted-foreground">No health data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whitelabel" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">White Label Settings</CardTitle>
            </CardHeader>
            <CardContent>
              {wlSettings ? (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  {Object.entries(wlSettings).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-muted-foreground capitalize">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </dt>
                      <dd className="font-medium mt-0.5">
                        {typeof value === "object" ? JSON.stringify(value) : String(value || "-")}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-muted-foreground">No white label settings configured</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audit Trail</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(auditData?.items || []).map((log) => (
                    <TableRow key={log.id as string}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {log.action as string}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.entityType as string}
                        {log.entityId ? ` #${(log.entityId as string).slice(0, 8)}` : ""}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {log.reasonText
                          ? (log.reasonText as string)
                          : log.after
                            ? "Data updated"
                            : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.createdAt
                          ? new Date(log.createdAt as string).toLocaleString()
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(auditData?.items || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                        No audit records
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!modForm} onOpenChange={() => setModForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">{modForm?.action} Company</DialogTitle>
          </DialogHeader>
          {modForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                moderationMutation.mutate(modForm);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Reason Code</Label>
                <Input
                  value={modForm.reasonCode}
                  onChange={(e) => setModForm({ ...modForm, reasonCode: e.target.value })}
                  placeholder="e.g. policy_violation"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Reason Text</Label>
                <Textarea
                  value={modForm.reasonText}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setModForm({ ...modForm, reasonText: e.target.value })}
                  placeholder="Describe the reason..."
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setModForm(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant={modForm.action === "approve" || modForm.action === "unblock" ? "default" : "destructive"}
                  disabled={moderationMutation.isPending}
                >
                  {moderationMutation.isPending ? "Processing..." : `Confirm ${modForm.action}`}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showSetPlan} onOpenChange={setShowSetPlan}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Plan for {company.name as string}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Plan</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a plan" />
                </SelectTrigger>
                <SelectContent>
                  {(plans.data || []).map((p) => (
                    <SelectItem key={p.id as string} value={p.id as string}>
                      {p.name as string}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSetPlan(false)}>
                Cancel
              </Button>
              <Button
                disabled={!selectedPlanId || setPlanMutation.isPending}
                onClick={() => setPlanMutation.mutate(selectedPlanId)}
              >
                {setPlanMutation.isPending ? "Setting..." : "Set Plan"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
