import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function BlacklistPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    actionType: "ban",
    reasonCode: "",
    reasonText: "",
    fullNameSnapshot: "",
    phoneSnapshot: "",
    emailSnapshot: "",
    documentSnapshot: "",
  });
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["blacklist", search, activeFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set("search", search);
      if (activeFilter !== "all") params.set("active", activeFilter);
      return api<BlacklistEntry[]>(`/platform/blacklist?${params}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/platform/blacklist", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blacklist"] });
      setShowCreate(false);
      setForm({
        actionType: "ban",
        reasonCode: "",
        reasonText: "",
        fullNameSnapshot: "",
        phoneSnapshot: "",
        emailSnapshot: "",
        documentSnapshot: "",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enable }: { id: string; enable: boolean }) =>
      api(`/platform/blacklist/${id}/${enable ? "enable" : "disable"}`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["blacklist"] }),
  });

  const entries = Array.isArray(data) ? data : [];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Global Blacklist</h1>
          <p className="text-muted-foreground">Manage platform-wide blacklist entries</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
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
                      <Badge variant="outline" className="capitalize">
                        {entry.actionType}
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          toggleMutation.mutate({
                            id: entry.id,
                            enable: !entry.isActive,
                          })
                        }
                        disabled={toggleMutation.isPending}
                      >
                        {entry.isActive ? "Disable" : "Enable"}
                      </Button>
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
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Blacklist Entry</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const body: Record<string, unknown> = {
                actionType: form.actionType,
                reasonCode: form.reasonCode,
              };
              if (form.reasonText) body.reasonText = form.reasonText;
              if (form.fullNameSnapshot) body.fullNameSnapshot = form.fullNameSnapshot;
              if (form.phoneSnapshot) body.phoneSnapshot = form.phoneSnapshot;
              if (form.emailSnapshot) body.emailSnapshot = form.emailSnapshot;
              if (form.documentSnapshot) body.documentSnapshot = form.documentSnapshot;
              createMutation.mutate(body);
            }}
            className="space-y-4"
          >
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
                    <SelectItem value="ban">Ban</SelectItem>
                    <SelectItem value="flag">Flag</SelectItem>
                    <SelectItem value="restrict">Restrict</SelectItem>
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
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Adding..." : "Add Entry"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
