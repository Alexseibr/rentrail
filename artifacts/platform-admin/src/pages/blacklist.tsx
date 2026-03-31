import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, ChevronLeft, ChevronRight } from "lucide-react";

interface BlacklistEntry {
  id: string;
  actionType: string;
  reasonCode: string;
  reasonText?: string;
  fullNameSnapshot?: string;
  phoneSnapshot?: string;
  emailSnapshot?: string;
  documentSnapshot?: string;
  startsAt?: string;
  endsAt?: string;
  isActive: boolean;
  createdAt: string;
}

interface ToggleConfirm {
  id: string;
  name: string;
  enable: boolean;
}

const ACTION_TYPES = [
  { value: "warning", label: "Warning" },
  { value: "manual_approval_only", label: "Manual Approval Only" },
  { value: "increased_deposit", label: "Increased Deposit" },
  { value: "restricted_access", label: "Restricted Access" },
  { value: "blocked_branch", label: "Blocked (Branch)" },
  { value: "blocked_company", label: "Blocked (Company)" },
  { value: "blocked_global", label: "Blocked (Global)" },
];

const emptyForm = {
  actionType: "blocked_global",
  reasonCode: "",
  reasonText: "",
  fullNameSnapshot: "",
  phoneSnapshot: "",
  emailSnapshot: "",
  documentSnapshot: "",
};

export default function BlacklistPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editEntry, setEditEntry] = useState<BlacklistEntry | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [toggleConfirm, setToggleConfirm] = useState<ToggleConfirm | null>(null);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["blacklist", search, activeFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set("search", search);
      if (activeFilter !== "all") params.set("active", activeFilter);
      return api<{ items: BlacklistEntry[]; pagination: { total: number; totalPages: number } }>(
        `/platform/blacklist?${params}`,
      );
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/platform/blacklist", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blacklist"] });
      setShowCreate(false);
      setEditEntry(null);
      setForm({ ...emptyForm });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api(`/platform/blacklist/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blacklist"] });
      setEditEntry(null);
      setForm({ ...emptyForm });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enable }: { id: string; enable: boolean }) =>
      api(`/platform/blacklist/${id}/${enable ? "enable" : "disable"}`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blacklist"] });
      setToggleConfirm(null);
    },
  });

  const entries = data?.items || [];
  const totalPages = data?.pagination?.totalPages || 0;
  const total = data?.pagination?.total || 0;

  function openEdit(entry: BlacklistEntry) {
    setEditEntry(entry);
    setShowCreate(false);
    setForm({
      actionType: entry.actionType,
      reasonCode: entry.reasonCode,
      reasonText: entry.reasonText || "",
      fullNameSnapshot: entry.fullNameSnapshot || "",
      phoneSnapshot: entry.phoneSnapshot || "",
      emailSnapshot: entry.emailSnapshot || "",
      documentSnapshot: entry.documentSnapshot || "",
    });
  }

  function buildBody() {
    const body: Record<string, unknown> = {
      actionType: form.actionType,
      reasonCode: form.reasonCode,
    };
    if (form.reasonText) body.reasonText = form.reasonText;
    if (form.fullNameSnapshot) body.fullNameSnapshot = form.fullNameSnapshot;
    if (form.phoneSnapshot) body.phoneSnapshot = form.phoneSnapshot;
    if (form.emailSnapshot) body.emailSnapshot = form.emailSnapshot;
    if (form.documentSnapshot) body.documentSnapshot = form.documentSnapshot;
    return body;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editEntry) {
      updateMutation.mutate({ id: editEntry.id, body: buildBody() });
    } else {
      createMutation.mutate(buildBody());
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Global Blacklist</h1>
          <p className="text-muted-foreground">Manage platform-wide blacklist entries</p>
        </div>
        <Button onClick={() => { setShowCreate(true); setEditEntry(null); setForm({ ...emptyForm }); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Entry
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={activeFilter}
              onValueChange={(v) => {
                setActiveFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Identity</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div className="space-y-0.5">
                          {entry.fullNameSnapshot && (
                            <div className="font-medium">{entry.fullNameSnapshot}</div>
                          )}
                          {entry.emailSnapshot && (
                            <div className="text-xs text-muted-foreground">{entry.emailSnapshot}</div>
                          )}
                          {entry.phoneSnapshot && (
                            <div className="text-xs text-muted-foreground">{entry.phoneSnapshot}</div>
                          )}
                          {entry.documentSnapshot && (
                            <div className="text-xs text-muted-foreground">
                              Doc: {entry.documentSnapshot}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {entry.actionType.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="text-sm font-medium">{entry.reasonCode}</span>
                          {entry.reasonText && (
                            <p className="text-xs text-muted-foreground truncate max-w-48">
                              {entry.reasonText}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            entry.isActive
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }
                        >
                          {entry.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => openEdit(entry)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() =>
                              setToggleConfirm({
                                id: entry.id,
                                name: entry.fullNameSnapshot || entry.emailSnapshot || entry.id,
                                enable: !entry.isActive,
                              })
                            }
                          >
                            {entry.isActive ? "Disable" : "Enable"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {entries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No blacklist entries found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">{total} total</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">Page {page} of {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreate || !!editEntry} onOpenChange={() => { setShowCreate(false); setEditEntry(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editEntry ? "Edit Blacklist Entry" : "Add Blacklist Entry"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Action Type</Label>
                <Select
                  value={form.actionType}
                  onValueChange={(v) => setForm({ ...form, actionType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map((at) => (
                      <SelectItem key={at.value} value={at.value}>
                        {at.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reason Code</Label>
                <Input
                  value={form.reasonCode}
                  onChange={(e) => setForm({ ...form, reasonCode: e.target.value })}
                  placeholder="e.g. fraud"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason Text</Label>
              <Input
                value={form.reasonText}
                onChange={(e) => setForm({ ...form, reasonText: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={form.fullNameSnapshot}
                  onChange={(e) => setForm({ ...form, fullNameSnapshot: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={form.emailSnapshot}
                  onChange={(e) => setForm({ ...form, emailSnapshot: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={form.phoneSnapshot}
                  onChange={(e) => setForm({ ...form, phoneSnapshot: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Document ID</Label>
                <Input
                  value={form.documentSnapshot}
                  onChange={(e) => setForm({ ...form, documentSnapshot: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowCreate(false); setEditEntry(null); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : editEntry ? "Save Changes" : "Add Entry"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toggleConfirm} onOpenChange={() => setToggleConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {toggleConfirm?.enable ? "Enable" : "Disable"} Blacklist Entry
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to {toggleConfirm?.enable ? "enable" : "disable"} the blacklist
              entry for <strong>{toggleConfirm?.name}</strong>?
              {toggleConfirm?.enable
                ? " This will block matching identities across all tenants."
                : " This will allow matching identities to use the platform again."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToggleConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant={toggleConfirm?.enable ? "destructive" : "default"}
              disabled={toggleMutation.isPending}
              onClick={() => {
                if (toggleConfirm) {
                  toggleMutation.mutate({ id: toggleConfirm.id, enable: toggleConfirm.enable });
                }
              }}
            >
              {toggleMutation.isPending
                ? "Processing..."
                : toggleConfirm?.enable
                  ? "Enable (Block)"
                  : "Disable (Allow)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
