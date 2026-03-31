import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Palette, CheckCircle, XCircle } from "lucide-react";

interface Company {
  id: string;
  name: string;
  slug: string;
  status: string;
}

interface WhiteLabelSettings {
  id: string;
  companyId: string;
  status: string;
  customDomain?: string;
  brandNameOverride?: string;
  logoUrl?: string;
  coverUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  customSupportEmail?: string;
  customSupportPhone?: string;
  notes?: string;
}

export default function WhiteLabelPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const { data: companies, isLoading: companiesLoading } = useQuery({
    queryKey: ["companies", search, "all", 1],
    queryFn: () => {
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (search) params.set("search", search);
      return api<{ items: Company[]; total: number }>(`/platform/companies?${params}`);
    },
  });

  const { data: wlSettings, isLoading: wlLoading } = useQuery({
    queryKey: ["white-label", selectedCompanyId],
    queryFn: () =>
      api<WhiteLabelSettings>(`/platform/companies/${selectedCompanyId}/white-label`),
    enabled: !!selectedCompanyId,
  });

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, string>) =>
      api(`/platform/companies/${selectedCompanyId}/white-label`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["white-label", selectedCompanyId] }),
  });

  const toggleMutation = useMutation({
    mutationFn: (enable: boolean) =>
      api(`/platform/companies/${selectedCompanyId}/white-label/${enable ? "enable" : "disable"}`, {
        method: "POST",
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["white-label", selectedCompanyId] }),
  });

  const openSettings = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setEditForm({});
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">White Label</h1>
        <p className="text-muted-foreground">Manage white-label settings for companies</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search companies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {companiesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(companies?.items || []).map((company) => (
                <div
                  key={company.id}
                  className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => openSettings(company.id)}
                >
                  <div className="flex items-center gap-3">
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{company.name}</p>
                      <p className="text-xs text-muted-foreground">{company.slug}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="capitalize">
                    {company.status}
                  </Badge>
                </div>
              ))}
              {companies?.items.length === 0 && (
                <p className="text-center py-8 text-muted-foreground">No companies found</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedCompanyId} onOpenChange={() => setSelectedCompanyId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>White Label Settings</DialogTitle>
          </DialogHeader>
          {wlLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : wlSettings ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={
                      wlSettings.status === "active"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }
                  >
                    {wlSettings.status}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleMutation.mutate(wlSettings.status !== "active")}
                    disabled={toggleMutation.isPending}
                  >
                    {wlSettings.status === "active" ? (
                      <>
                        <XCircle className="h-3 w-3 mr-1" /> Disable
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" /> Enable
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  updateMutation.mutate(editForm);
                }}
                className="space-y-3"
              >
                {[
                  { key: "customDomain", label: "Custom Domain", placeholder: "app.example.com" },
                  { key: "brandNameOverride", label: "Brand Name", placeholder: "Acme Rentals" },
                  { key: "logoUrl", label: "Logo URL", placeholder: "https://..." },
                  { key: "primaryColor", label: "Primary Color", placeholder: "#3B82F6" },
                  { key: "secondaryColor", label: "Secondary Color", placeholder: "#10B981" },
                  { key: "customSupportEmail", label: "Support Email", placeholder: "support@..." },
                  { key: "customSupportPhone", label: "Support Phone", placeholder: "+1..." },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      value={editForm[key] ?? (wlSettings as Record<string, unknown>)[key] as string ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                      placeholder={placeholder}
                    />
                  </div>
                ))}
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedCompanyId(null)}
                  >
                    Close
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </form>
            </div>
          ) : (
            <p className="text-muted-foreground py-4">
              White label not configured for this company. Enable it to get started.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
