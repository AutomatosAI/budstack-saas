/**
 * check-auth-wrappers — core scanner (PRD-203 US-002, AC-4/AC-4b/OQ-4).
 *
 * Classifies every exported HTTP handler in an `app/api/**\/route.ts` file as
 * `wrapped` (one of the approved api-auth wrappers), `allow-listed` (matches
 * AUTH_PUBLIC_ROUTES) or `violation` (a bare/unguarded handler).
 *
 * OQ-4 resolution: this works on the TypeScript AST (the compiler API), NOT a
 * regex, so it follows import ALIASES (`import { withAuth as guard }`),
 * indirection (`const h = withAuth(...); export { h as GET }`) and re-exports —
 * the exact cases a textual grep would miss. (ts-morph is a thin convenience
 * wrapper over this same compiler API; it is not in this repo's lockfile and
 * the worktree carries no node_modules of its own, so the gate uses the
 * already-installed `typescript` package directly — same AST, zero new deps.)
 *
 * Pure module: no fs, no process side effects — the CLI (check-auth-wrappers.ts)
 * supplies file contents and the unit test exercises `classifySource` directly.
 */
import * as ts from "typescript";

import { isAuthPublicRoute } from "../lib/auth-public-routes";

export const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

/** The base wrappers from `lib/api-auth` (PRD-203). */
export const AUTH_WRAPPERS = [
  "withTenantAuth",
  "withTenantAuthParams",
  "withSuperAdmin",
  "withSuperAdminParams",
  "withAuth",
] as const;

/**
 * PRD-301's permission gates (US-009). These are NOT a second way to skip auth:
 * each one delegates to the api-auth wrapper of the same shape
 * (requirePermission → withTenantAuth, requirePermissionParams →
 * withTenantAuthParams; see lib/permissions/require-permission.ts) and then
 * additionally 403s a caller lacking the required permission key. A route using
 * one is strictly MORE guarded than a plain withTenantAuth route, so counting it
 * as a violation inverted the gate's signal.
 */
export const PERMISSION_WRAPPERS = [
  "requirePermission",
  "requirePermissionParams",
] as const;

export const APPROVED_WRAPPERS = [...AUTH_WRAPPERS, ...PERMISSION_WRAPPERS] as const;
export type ApprovedWrapper = (typeof APPROVED_WRAPPERS)[number];

/**
 * Which module each wrapper name may legitimately come from. A name only counts
 * when imported from ITS OWN module, so a locally-defined `withTenantAuth` — or
 * a `requirePermission` imported from somewhere else — cannot launder a bare
 * handler past the gate.
 */
const WRAPPER_MODULES: ReadonlyArray<{
  readonly suffix: string;
  readonly wrappers: ReadonlySet<string>;
}> = [
  { suffix: "lib/api-auth", wrappers: new Set(AUTH_WRAPPERS) },
  {
    suffix: "lib/permissions/require-permission",
    wrappers: new Set(PERMISSION_WRAPPERS),
  },
];

/** The wrapper names a given import specifier is allowed to contribute. */
function wrappersForModule(spec: string): ReadonlySet<string> | undefined {
  return WRAPPER_MODULES.find(
    (mod) => spec === `@/${mod.suffix}` || spec.endsWith(mod.suffix),
  )?.wrappers;
}

export type HandlerStatus = "wrapped" | "allow-listed" | "violation";

export interface HandlerClassification {
  readonly method: HttpMethod;
  readonly status: HandlerStatus;
  readonly wrapper?: ApprovedWrapper;
}

export interface RouteClassification {
  readonly apiPath: string;
  readonly allowListed: boolean;
  readonly handlers: readonly HandlerClassification[];
  readonly violations: readonly HttpMethod[];
}

const HTTP_METHOD_SET: ReadonlySet<string> = new Set(HTTP_METHODS);
const APPROVED_WRAPPER_SET: ReadonlySet<string> = new Set(APPROVED_WRAPPERS);

/** `app/api/store/[slug]/products/route.ts` → `/api/store/[slug]/products`. */
export function deriveApiPath(routeFilePath: string): string {
  const norm = routeFilePath.replace(/\\/g, "/");
  const marker = "app/api/";
  const at = norm.indexOf(marker);
  const tail = at >= 0 ? norm.slice(at + "app/".length) : norm.replace(/^\/+/, "");
  return "/" + tail.replace(/\/route\.tsx?$/, "").replace(/^\/+/, "");
}

function hasExportModifier(node: ts.Declaration): boolean {
  return (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0;
}

function statementIsExported(node: ts.HasModifiers): boolean {
  return ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function unwrap(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

/** Imports from a wrapper module: local binding name → canonical wrapper name. */
function collectWrapperImports(sf: ts.SourceFile): ReadonlyMap<string, ApprovedWrapper> {
  const map = new Map<string, ApprovedWrapper>();
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const allowed = wrappersForModule(stmt.moduleSpecifier.text);
    if (!allowed) continue;
    const named = stmt.importClause?.namedBindings;
    if (!named || !ts.isNamedImports(named)) continue;
    for (const el of named.elements) {
      const original = (el.propertyName ?? el.name).text;
      if (allowed.has(original)) {
        map.set(el.name.text, original as ApprovedWrapper);
      }
    }
  }
  return map;
}

/** Top-level `const <name> = <expr>` initializers, for indirection resolution. */
function collectTopLevelConsts(sf: ts.SourceFile): ReadonlyMap<string, ts.Expression> {
  const map = new Map<string, ts.Expression>();
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.initializer) {
        map.set(decl.name.text, decl.initializer);
      }
    }
  }
  return map;
}

function resolveWrapper(
  expression: ts.Expression,
  wrapperLocals: ReadonlyMap<string, ApprovedWrapper>,
  localConsts: ReadonlyMap<string, ts.Expression>,
  seen: Set<string> = new Set(),
): ApprovedWrapper | undefined {
  const expr = unwrap(expression);
  if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
    const name = expr.expression.text;
    return wrapperLocals.get(name) ?? (APPROVED_WRAPPER_SET.has(name) ? (name as ApprovedWrapper) : undefined);
  }
  if (ts.isIdentifier(expr)) {
    if (seen.has(expr.text)) return undefined;
    seen.add(expr.text);
    const init = localConsts.get(expr.text);
    return init ? resolveWrapper(init, wrapperLocals, localConsts, seen) : undefined;
  }
  return undefined;
}

interface ExportedHandler {
  readonly method: HttpMethod;
  readonly init?: ts.Expression;
}

function collectExportedHandlers(sf: ts.SourceFile): readonly ExportedHandler[] {
  const localConsts = collectTopLevelConsts(sf);
  const handlers: ExportedHandler[] = [];
  for (const stmt of sf.statements) {
    if (ts.isVariableStatement(stmt) && statementIsExported(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && HTTP_METHOD_SET.has(decl.name.text)) {
          handlers.push({ method: decl.name.text as HttpMethod, init: decl.initializer });
        }
      }
    } else if (ts.isFunctionDeclaration(stmt) && stmt.name && HTTP_METHOD_SET.has(stmt.name.text) && hasExportModifier(stmt)) {
      handlers.push({ method: stmt.name.text as HttpMethod });
    } else if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause) && !stmt.moduleSpecifier) {
      for (const el of stmt.exportClause.elements) {
        if (HTTP_METHOD_SET.has(el.name.text)) {
          const local = (el.propertyName ?? el.name).text;
          handlers.push({ method: el.name.text as HttpMethod, init: localConsts.get(local) });
        }
      }
    }
  }
  return handlers;
}

/** Classify one route file's exported handlers from its source text. */
export function classifySource(apiPath: string, sourceText: string): RouteClassification {
  const sf = ts.createSourceFile("route.ts", sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const allowListed = isAuthPublicRoute(apiPath);
  const wrapperLocals = collectWrapperImports(sf);
  const localConsts = collectTopLevelConsts(sf);

  const handlers: HandlerClassification[] = collectExportedHandlers(sf).map(({ method, init }) => {
    const wrapper = init ? resolveWrapper(init, wrapperLocals, localConsts) : undefined;
    if (wrapper) return { method, status: "wrapped", wrapper };
    return { method, status: allowListed ? "allow-listed" : "violation" };
  });

  const violations = handlers.filter((h) => h.status === "violation").map((h) => h.method);
  return { apiPath, allowListed, handlers, violations };
}
