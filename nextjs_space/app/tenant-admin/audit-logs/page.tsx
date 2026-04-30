"use client";

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { Shield, ChevronLeft, ChevronRight, Activity } from "lucide-react";
import { AdminPageHeader, AdminListCard, RowPill } from "@/components/admin/shared";
import type { RowPillTone } from "@/components/admin/shared";


interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  userEmail?: string;
  metadata?: any;
  ipAddress?: string;
  createdAt: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function TenantAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>("");
  const [entityFilter, setEntityFilter] = useState<string>("");

  useEffect(() => {
    fetchLogs();
  }, [pagination.page, actionFilter, entityFilter]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (actionFilter) params.append("action", actionFilter);
      if (entityFilter) params.append("entityType", entityFilter);

      const response = await fetch(`/api/tenant-admin/audit-logs?${params}`);
      const data = await response.json();

      if (response.ok) {
        setLogs(data.logs);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActionTone = (action: string): RowPillTone => {
    if (action.includes("deleted")) return "red";
    if (action.includes("created")) return "emerald";
    if (action.includes("updated")) return "blue";
    if (action.includes("login")) return "purple";
    return "slate";
  };

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Security"
        eyebrowIcon={Shield}
        title="Audit Logs"
        subtitle="Track all actions and changes in your dispensary."
      />

      <AdminListCard
        title="Activity Log"
        titleIcon={Activity}
        count={pagination.total}
        filters={
          <>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="product.created">Product Created</SelectItem>
                <SelectItem value="product.updated">Product Updated</SelectItem>
                <SelectItem value="product.deleted">Product Deleted</SelectItem>
                <SelectItem value="order.created">Order Created</SelectItem>
                <SelectItem value="order.status_changed">Order Status Changed</SelectItem>
                <SelectItem value="branding.updated">Branding Updated</SelectItem>
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                <SelectItem value="Product">Product</SelectItem>
                <SelectItem value="Order">Order</SelectItem>
                <SelectItem value="Branding">Branding</SelectItem>
                <SelectItem value="Webhook">Webhook</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      >
        <div>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading audit logs...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No audit logs found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead className="hidden sm:table-cell">Entity</TableHead>
                      <TableHead className="hidden md:table-cell">User</TableHead>
                      <TableHead className="hidden lg:table-cell">IP Address</TableHead>
                      <TableHead className="hidden lg:table-cell">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">
                          {format(new Date(log.createdAt), "MMM dd, HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <div>
                            <RowPill tone={getActionTone(log.action)}>
                              {log.action}
                            </RowPill>
                            <span className="block sm:hidden text-xs text-muted-foreground mt-1">
                              {log.entityType}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{log.entityType}</TableCell>
                        <TableCell className="text-sm hidden md:table-cell">
                          {log.userEmail || "System"}
                        </TableCell>
                        <TableCell className="font-mono text-xs hidden lg:table-cell">
                          {log.ipAddress || "N/A"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-[200px] hidden lg:table-cell">
                          {log.metadata ? JSON.stringify(log.metadata) : "No details"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-5 py-4 border-t border-white/5">
                <div className="text-sm text-muted-foreground">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                  {pagination.total} results
                </div>
                <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                    }
                    disabled={pagination.page === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="flex items-center px-3 text-sm">
                    Page {pagination.page} of {pagination.totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                    }
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </AdminListCard>
    </div>
  );
}
