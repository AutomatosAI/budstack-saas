"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { RowPill, type RowPillTone } from "@/components/admin/shared/RowPill";


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
  const { user } = useUser();
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
    if (
      action.includes("created") ||
      action.includes("login") ||
      action.includes("success")
    )
      return "emerald";
    if (action.includes("deleted") || action.includes("failed"))
      return "red";
    if (action.includes("updated") || action.includes("changed"))
      return "blue";
    if (action.includes("warn")) return "amber";
    return "slate";
  };

  return (
    <div className="space-y-8">
      <div className="bs-page-header-centered">
        <div className="bs-eyebrow">Security</div>
        <h1
          className="bs-page-title"
          style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
        >
          Audit Logs
        </h1>
        <p className="bs-page-subtitle">
          Track all actions and changes in your dispensary.
        </p>
      </div>

      <section className="bs-card overflow-hidden">
        <div className="bs-card-pad border-b border-bs-border-100">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2
                className="text-[22px] font-semibold text-bs-fg"
                style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
              >
                Activity Log
              </h2>
              <p className="text-sm text-bs-fg-muted mt-1">
                <span className="font-mono tabular-nums text-bs-fg">{pagination.total}</span>{" "}
                total events recorded
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value === "all" ? "" : e.target.value)}
                className="bs-select w-full sm:w-[200px]"
                aria-label="Filter by action"
              >
                <option value="all">All Actions</option>
                <option value="product.created">Product Created</option>
                <option value="product.updated">Product Updated</option>
                <option value="product.deleted">Product Deleted</option>
                <option value="order.created">Order Created</option>
                <option value="order.status_changed">Order Status Changed</option>
                <option value="branding.updated">Branding Updated</option>
              </select>
              <select
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value === "all" ? "" : e.target.value)}
                className="bs-select w-full sm:w-[180px]"
                aria-label="Filter by entity"
              >
                <option value="all">All Entities</option>
                <option value="Product">Product</option>
                <option value="Order">Order</option>
                <option value="Branding">Branding</option>
                <option value="Webhook">Webhook</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          {loading ? (
            <div className="text-center py-12 text-bs-fg-muted">
              Loading audit logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-bs-fg-muted">
              No audit logs found
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="bs-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Action</th>
                      <th className="hidden sm:table-cell">Entity</th>
                      <th className="hidden md:table-cell">User</th>
                      <th className="hidden lg:table-cell">IP Address</th>
                      <th className="hidden lg:table-cell">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-bs-card-2">
                        <td className="font-mono text-xs text-bs-fg-muted">
                          {format(new Date(log.createdAt), "MMM dd, HH:mm:ss")}
                        </td>
                        <td>
                          <div>
                            <RowPill tone={getActionTone(log.action)}>
                              {log.action}
                            </RowPill>
                            <span className="block sm:hidden text-xs text-bs-fg-muted mt-1">
                              {log.entityType}
                            </span>
                          </div>
                        </td>
                        <td className="hidden sm:table-cell text-bs-fg">
                          {log.entityType}
                        </td>
                        <td className="hidden md:table-cell font-mono text-xs text-bs-fg-muted">
                          {log.userEmail || "System"}
                        </td>
                        <td className="hidden lg:table-cell font-mono text-xs text-bs-fg-muted">
                          {log.ipAddress || "N/A"}
                        </td>
                        <td className="hidden lg:table-cell text-sm text-bs-fg-muted truncate max-w-[200px]">
                          {log.metadata
                            ? JSON.stringify(log.metadata)
                            : "No details"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bs-card-2 border-t border-bs-border-100 px-6 py-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="text-sm text-bs-fg-muted">
                    Showing{" "}
                    <span className="font-mono tabular-nums text-bs-fg">
                      {(pagination.page - 1) * pagination.limit + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-mono tabular-nums text-bs-fg">
                      {Math.min(
                        pagination.page * pagination.limit,
                        pagination.total,
                      )}
                    </span>{" "}
                    of{" "}
                    <span className="font-mono tabular-nums text-bs-fg">
                      {pagination.total}
                    </span>{" "}
                    results
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-end items-center">
                    <button
                      type="button"
                      onClick={() =>
                        setPagination((prev) => ({
                          ...prev,
                          page: prev.page - 1,
                        }))
                      }
                      disabled={pagination.page === 1}
                      className="bs-btn bs-btn-ghost bs-btn-sm disabled:opacity-50"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" aria-hidden="true" />
                      Previous
                    </button>
                    <div className="flex items-center px-3 text-sm text-bs-fg-muted">
                      Page{" "}
                      <span className="font-mono tabular-nums text-bs-fg mx-1">
                        {pagination.page}
                      </span>{" "}
                      of{" "}
                      <span className="font-mono tabular-nums text-bs-fg ml-1">
                        {pagination.totalPages}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setPagination((prev) => ({
                          ...prev,
                          page: prev.page + 1,
                        }))
                      }
                      disabled={pagination.page >= pagination.totalPages}
                      className="bs-btn bs-btn-ghost bs-btn-sm disabled:opacity-50"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
