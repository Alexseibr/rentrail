import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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

export default function CompanyDetailPage() {
  const [, params] = useRoute("/companies/:id");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const companyId = params?.id;
  const [modForm, setModForm] = useState<ModerationForm | null>(null);

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
    {
      action: "approve",
      label: "Approve",
      icon: CheckCircle,
      show: status === "pending",
      variant: "default" as const,
    },
    {
      action: "block",
      label: "Block",
      icon: Ban,
      show: status === "active" || status === "pending",
      variant: "destructive" as const,
    },
    {
      action: "suspend",
      label: "Suspend",
      icon: Pause,
      show: status === "active",
      variant: "outline" as const,
    },
    {
      action: "unblock",
      label: "Unblock",
      icon: CheckCircle,
      show: status === "blocked" || status === "suspended",
      variant: "default" as const,
    },
    {
      action: "cancel",
      label: "Cancel",
      icon: XCircle,
      show: status !== "cancelled",
      variant: "destructive" as const,
    },
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
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
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
    </div>
  );
}
