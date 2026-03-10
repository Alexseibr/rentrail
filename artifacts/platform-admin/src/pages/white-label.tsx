import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Palette, CheckCircle, XCircle, Globe } from "lucide-react";

interface Company {
  id: string;
  name: string;
  slug: string;
  status: string;
  whiteLabel?: {
    customDomain?: string;
    brandNameOverride?: string;
    status?: string;
  };
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
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    null,
  );
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const { data: companies, isLoading: companiesLoading } = useQuery({
    queryKey: ["companies", search, "all", 1],
    queryFn: () => {
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (search) params.set("search", search);
      return api<{
        items: Company[];
        pagination: { total: number; totalPages: number };
      }>(`/platform/companies?${params}`);
    },
  });

  const { data: wlSettings, isLoading: wlLoading } = useQuery({
    queryKey: ["white-label", selectedCompanyId],
    queryFn: () =>
      api<WhiteLabelSettings>(
        `/platform/companies/${selectedCompanyId}/white-label`,
      ),
    enabled: !!selectedCompanyId,
  });

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, string>) =>
      api(`/platform/companies/${selectedCompanyId}/white-label`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["white-label", selectedCompanyId],
      }),
  });

  const toggleMutation = useMutation({
    mutationFn: (enable: boolean) =>
      api(
        `/platform/companies/${selectedCompanyId}/white-label/${enable ? "enable" : "disable"}`,
        {
          method: "POST",
        },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["white-label", selectedCompanyId],
      }),
  });

  const openSettings = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setEditForm({});
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("whiteLabel.title")}
        </h1>
        <p className="text-muted-foreground">{t("whiteLabel.subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("whiteLabel.searchCompanies")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {companiesLoading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.company")}</TableHead>
                  <TableHead>{t("whiteLabel.brandName")}</TableHead>
                  <TableHead>{t("whiteLabel.customDomain")}</TableHead>
                  <TableHead>{t("whiteLabel.wlStatus")}</TableHead>
                  <TableHead>{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(companies?.items || []).map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Palette className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{company.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {company.slug}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {company.whiteLabel?.brandNameOverride || "-"}
                    </TableCell>
                    <TableCell>
                      {company.whiteLabel?.customDomain ? (
                        <div className="flex items-center gap-1">
                          <Globe className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">
                            {company.whiteLabel.customDomain}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {company.whiteLabel?.status ? (
                        <Badge
                          variant="secondary"
                          className={
                            company.whiteLabel.status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }
                        >
                          {company.whiteLabel.status}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          {t("whiteLabel.notConfigured")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => openSettings(company.id)}
                      >
                        {t("whiteLabel.configure")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {companies?.items.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {t("companies.noCompanies")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!selectedCompanyId}
        onOpenChange={() => setSelectedCompanyId(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("whiteLabel.settings")}</DialogTitle>
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
                <span className="text-sm font-medium">
                  {t("common.status")}
                </span>
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
                    onClick={() =>
                      toggleMutation.mutate(wlSettings.status !== "active")
                    }
                    disabled={toggleMutation.isPending}
                  >
                    {wlSettings.status === "active" ? (
                      <>
                        <XCircle className="h-3 w-3 mr-1" />{" "}
                        {t("common.disable")}
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />{" "}
                        {t("common.enable")}
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
                  {
                    key: "customDomain",
                    label: t("whiteLabel.customDomain"),
                    placeholder: "app.example.com",
                  },
                  {
                    key: "brandNameOverride",
                    label: t("whiteLabel.brandName"),
                    placeholder: "Acme Rentals",
                  },
                  {
                    key: "logoUrl",
                    label: t("whiteLabel.logoUrl"),
                    placeholder: "https://...",
                  },
                  {
                    key: "primaryColor",
                    label: t("whiteLabel.primaryColor"),
                    placeholder: "#3B82F6",
                  },
                  {
                    key: "secondaryColor",
                    label: t("whiteLabel.secondaryColor"),
                    placeholder: "#10B981",
                  },
                  {
                    key: "customSupportEmail",
                    label: t("whiteLabel.supportEmail"),
                    placeholder: "support@...",
                  },
                  {
                    key: "customSupportPhone",
                    label: t("whiteLabel.supportPhone"),
                    placeholder: "+1...",
                  },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      value={
                        editForm[key] ??
                        (wlSettings[
                          key as keyof WhiteLabelSettings
                        ] as string) ??
                        ""
                      }
                      onChange={(e) =>
                        setEditForm({ ...editForm, [key]: e.target.value })
                      }
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
                    {t("common.close")}
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending
                      ? t("common.saving")
                      : t("billing.saveChanges")}
                  </Button>
                </DialogFooter>
              </form>
            </div>
          ) : (
            <p className="text-muted-foreground py-4">
              {t("whiteLabel.notConfiguredMsg")}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
