import { NextResponse } from "next/server";
import { z } from "zod";
import { withSuperAdminParams } from "@/lib/api-auth";
import { editSubmission } from "@/lib/marketplace/marketplace-review-service";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { apiError, apiValidationError } from "@/lib/api-error";
import { parseUuid } from "@/lib/validation/parse-uuid";
import { parseJsonBody } from "@/lib/validation/body";

// Submission files are stringified JSON / CSS; allow up to 512KB each and a
// 1MB whole-body cap (the four files combined).
const editSubmissionSchema = z
  .object({
    layoutJson: z.string().max(512 * 1024).optional(),
    defaultsJson: z.string().max(512 * 1024).optional(),
    configJson: z.string().max(512 * 1024).optional(),
    stylesCss: z.string().max(512 * 1024).optional(),
  })
  .strict();

export const PUT = withSuperAdminParams(async (request, { user }, params) => {
  try {
    const id = parseUuid(params.id);
    const { layoutJson, defaultsJson, configJson, stylesCss } =
      await parseJsonBody(request, editSubmissionSchema, {
        maxBytes: 1024 * 1024,
      });

    if (!layoutJson && !defaultsJson && !configJson && !stylesCss) {
      return apiValidationError(
        "At least one file must be provided",
        "PUT /api/super-admin/submissions/[id]/edit",
      );
    }

    await editSubmission(id, { layoutJson, defaultsJson, configJson, stylesCss });

    await createAuditLog({
      action: AUDIT_ACTIONS.TEMPLATE.UPDATED,
      entityType: "MarketplaceSubmission",
      entityId: id,
      userId: user.id,
      userEmail: user.email || undefined,
      metadata: {
        action: "edited",
        filesEdited: [
          layoutJson && "layout.json",
          defaultsJson && "defaults.json",
          configJson && "template.config.json",
          stylesCss && "styles.css",
        ].filter(Boolean),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Edit Submission] Error:", error);
    return apiError(error, {
      route: "super-admin.submissions.edit",
      status: 500,
      safeMessage: "Failed to edit submission",
    });
  }
});
