import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, apiValidationError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import {
  addCustomerTag,
  listCustomerTags,
  removeCustomerTag,
} from "@/lib/customers/customer-tags";
import { tagSchema } from "@/lib/customers/tag-format";
import { requirePermissionParams } from "@/lib/permissions/require-permission";
import { parseJsonBody } from "@/lib/validation/body";
import { parseUuid } from "@/lib/validation/parse-uuid";

const POST_ROUTE = "POST /api/tenant-admin/customers/[id]/tags";
const DELETE_ROUTE = "DELETE /api/tenant-admin/customers/[id]/tags";

const CUSTOMER_NOT_FOUND = "Customer not found";

/** `tag` arrives normalised (trimmed, lowercased) out of the schema. */
const addTagSchema = z.object({ tag: tagSchema }).strict();

/**
 * The tenant-ownership gate both mutations run BEFORE writing: the id must be
 * one of THIS tenant's customers, not an admin/team row and not another
 * tenant's user. A miss is answered 404 — indistinguishable from a customer
 * that never existed, so the endpoint cannot be used to probe other tenants'
 * user ids.
 */
async function customerInTenant(id: string, tenantId: string) {
  return prisma.users.findFirst({
    where: { id, tenantId, role: "PATIENT" },
    select: { id: true },
  });
}

/**
 * POST /api/tenant-admin/customers/[id]/tags
 * Attach a tag to a customer. Body: { tag: string } (1-40 chars after trim,
 * stored lowercased). Idempotent — re-adding an existing tag is a no-op.
 * Requires `canEditCustomers`. Responds with the customer's full tag list.
 */
export const POST = requirePermissionParams(
  "canEditCustomers",
  async (req, { tenantId }, params) => {
    try {
      const userId = parseUuid(params.id);
      const { tag } = await parseJsonBody(req, addTagSchema);

      const customer = await customerInTenant(userId, tenantId);
      if (!customer) {
        return apiError(new Error(CUSTOMER_NOT_FOUND), {
          route: POST_ROUTE,
          status: 404,
          safeMessage: CUSTOMER_NOT_FOUND,
        });
      }

      await addCustomerTag(tenantId, userId, tag);

      return NextResponse.json({ tags: await listCustomerTags(tenantId, userId) });
    } catch (error) {
      return apiError(error, { route: POST_ROUTE });
    }
  },
);

/**
 * DELETE /api/tenant-admin/customers/[id]/tags?tag=<tag>
 * Detach a tag (query param, matching the DELETE email-mappings convention).
 * Idempotent — removing an absent tag still answers with the current list.
 * Requires `canEditCustomers`.
 */
export const DELETE = requirePermissionParams(
  "canEditCustomers",
  async (req, { tenantId }, params) => {
    try {
      const userId = parseUuid(params.id);

      const parsed = tagSchema.safeParse(req.nextUrl.searchParams.get("tag"));
      if (!parsed.success) {
        return apiValidationError(
          parsed.error.issues[0]?.message ?? "A tag is required",
          DELETE_ROUTE,
        );
      }

      const customer = await customerInTenant(userId, tenantId);
      if (!customer) {
        return apiError(new Error(CUSTOMER_NOT_FOUND), {
          route: DELETE_ROUTE,
          status: 404,
          safeMessage: CUSTOMER_NOT_FOUND,
        });
      }

      await removeCustomerTag(tenantId, userId, parsed.data);

      return NextResponse.json({ tags: await listCustomerTags(tenantId, userId) });
    } catch (error) {
      return apiError(error, { route: DELETE_ROUTE });
    }
  },
);
