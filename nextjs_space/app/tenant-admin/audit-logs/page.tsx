"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { Shield, ChevronLeft, ChevronRight, Filter } from "lucide-react";


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
  const { data: session } = useSession() || {};
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

  const getActionBadgeColor = (action: string) => {
    if (action.includes("created")) return "default";
    if (action.includes("updated")) return "secondary";
    if (action.includes("deleted")) return "destructive";
    if (action.includes("login")) return "default";
    return "secondary";
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Breadcrumbs */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="section-badge mb-4 inline-flex">
          <Shield className="h-4 w-4" />
          Security
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Audit Logs
        </h1>
        <p className="mt-3 text-muted-foreground mx-auto">
          Track all actions and changes in your dispensary.
        </p>
      </div>

      <Card className="bg-white rounded-2xl border border-slate-200/50 shadow-2xl overflow-hidden">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>
                {pagination.total} total events recorded
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="product.created">
                    Product Created
                  </SelectItem>
                  <SelectItem value="product.updated">
                    Product Updated
                  </SelectItem>
                  <SelectItem value="product.deleted">
                    Product Deleted
                  </SelectItem>
                  <SelectItem value="order.created">Order Created</SelectItem>
                  <SelectItem value="order.status_changed">
                    Order Status Changed
                  </SelectItem>
                  <SelectItem value="branding.updated">
                    Branding Updated
                  </SelectItem>
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading audit logs...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No audit logs found
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Entity
                      </TableHead>
                      <TableHead className="hidden md:table-cell">
                        User
                      </TableHead>
                      <TableHead className="hidden lg:table-cell">
                        IP Address
                      </TableHead>
                      <TableHead className="hidden lg:table-cell">
                        Details
                      </TableHead>
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
                            <Badge
                              variant={getActionBadgeColor(log.action) as any}
                            >
                              {log.action}
                            </Badge>
                            {/* Show entity inline on mobile */}
                            <span className="block sm:hidden text-xs text-muted-foreground mt-1">
                              {log.entityType}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {log.entityType}
                        </TableCell>
                        <TableCell className="text-sm hidden md:table-cell">
                          {log.userEmail || "System"}
                        </TableCell>
                        <TableCell className="font-mono text-xs hidden lg:table-cell">
                          {log.ipAddress || "N/A"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-[200px] hidden lg:table-cell">
                          {log.metadata
                            ? JSON.stringify(log.metadata)
                            : "No details"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                  {Math.min(
                    pagination.page * pagination.limit,
                    pagination.total,
                  )}{" "}
                  of {pagination.total} results
                </div>
                <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: prev.page - 1,
                      }))
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
                      setPagination((prev) => ({
                        ...prev,
                        page: prev.page + 1,
                      }))
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
        </CardContent>
      </Card>
    </div>
  );
}
