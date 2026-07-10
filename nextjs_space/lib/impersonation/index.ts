/** PRD-302 super-admin impersonation — public surface. */

export {
  IMPERSONATION_COOKIE,
  impersonationMaxHours,
  impersonationExpiry,
  secondsUntil,
} from "./constants";
export {
  generateImpersonationToken,
  hashImpersonationToken,
} from "./token";
export {
  getImpersonationContext,
  runWithImpersonationContextAsync,
  type ImpersonationAuditContext,
} from "./context";
export { rejectSessionRow, type SessionRejection } from "./validate";
export {
  resolveActiveImpersonation,
  type ActiveImpersonation,
} from "./resolve";
export {
  startImpersonation,
  endImpersonation,
  lazyExpireSessions,
  listSessions,
  getSessionById,
  type ImpersonationSessionRecord,
  type ImpersonationSessionListItem,
  type StartImpersonationResult,
  type SessionStatusFilter,
} from "./sessions";
