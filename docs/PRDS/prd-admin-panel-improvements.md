# PRD: Admin Panel UI/UX Improvements

## 1. Introduction

A comprehensive overhaul of the Super Admin and Tenant Admin panels to improve usability, mobile responsiveness, visual hierarchy, and feature completeness. This addresses critical UX gaps including lack of mobile support, missing search/filter functionality, visual similarity between admin types, and incomplete data management features. The improvements will make the admin panels production-ready while maintaining all existing functionality.

**Current State Issues:**
- Both admin panels look nearly identical (same colors, layout, structure)
- No mobile responsiveness (sidebar blocks content on small screens)
- Missing search/filter on all list pages (tenants, products, orders, customers)
- Tables lack sorting, pagination, and bulk actions
- Dashboards show only basic stats without trends or activity feeds
- Accessibility issues (contrast, focus states, aria labels)
- Missing breadcrumbs for deep navigation
- No empty state handling on some pages

## 2. Goals

- **Mobile-First Design:** Full mobile responsiveness with hamburger menu and off-canvas sidebar
- **Visual Differentiation:** Distinct color schemes for Super Admin vs Tenant Admin panels
- **Enhanced Discoverability:** Search, filter, and sort on all list pages
- **Data Management:** Bulk actions, pagination, and advanced table features
- **Contextual Awareness:** Breadcrumbs, notifications, and quick actions
- **Analytics Integration:** Charts and trends using Plotly.js
- **Accessibility:** WCAG 2.1 AA compliance with proper focus states and labels
- **Zero Breaking Changes:** Preserve all existing functionality while refactoring

## 3. User Stories

### 3.1. HIGH PRIORITY - Critical UX Fixes

#### US-001: Mobile Responsive Sidebar
**Description:** As an admin user on mobile/tablet, I want to access all navigation items without content being blocked so that I can manage my platform on any device.

**Acceptance Criteria:**
- [ ] Sidebar hidden off-canvas on mobile (<768px) by default
- [ ] Hamburger menu button in top-left corner (visible on mobile only)
- [ ] Sidebar slides in from left when hamburger clicked
- [ ] Dark overlay covers content when sidebar open (click to close)
- [ ] Sidebar closes automatically when route changes on mobile
- [ ] Desktop behavior unchanged (sidebar always visible)
- [ ] Smooth transitions (300ms) for open/close animations
- [ ] Z-index layers: overlay (40), sidebar (50), modals (>50)
- [ ] Typecheck/lint passes
- [ ] Verify in browser at 375px, 768px, 1024px, 1440px widths

#### US-002: Visual Differentiation - Super Admin Theme
**Description:** As a super admin, I need the panel to have a distinct visual identity so I immediately know I'm in the platform admin area.

**Acceptance Criteria:**
- [ ] Sidebar gradient: `from-slate-800 via-slate-900 to-zinc-900` (dark theme)
- [ ] Accent color: `slate-700` for active states
- [ ] Header badge: "SUPER ADMIN" in bold with distinct styling
- [ ] Logo area: "B" icon with slate-400 background
- [ ] Active menu item: `bg-slate-700/50 border-l-4 border-slate-400`
- [ ] Hover states: `hover:bg-slate-700/30`
- [ ] All gradients updated to slate/zinc palette
- [ ] User avatar gradient: `from-slate-400 to-slate-600`
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-003: Visual Differentiation - Tenant Admin Theme
**Description:** As a tenant admin, I need the panel to reflect my store's environment distinct from super admin.

**Acceptance Criteria:**
- [ ] Sidebar gradient: `from-cyan-600 via-blue-600 to-indigo-700` (current)
- [ ] Accent color: `cyan-500` for active states
- [ ] Header badge: Tenant business name with current styling
- [ ] Logo area: "B" icon with cyan background or tenant logo if available
- [ ] Active menu item: `bg-cyan-500/30 border-l-4 border-cyan-300` (current)
- [ ] Hover states: `hover:bg-white/10` (current)
- [ ] No changes to existing cyan/blue palette
- [ ] User avatar gradient: `from-cyan-400 to-blue-500` (current)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-004: Search on Tenants Page
**Description:** As a super admin, I want to search tenants by name or subdomain so I can quickly find a specific tenant without scrolling.

**Acceptance Criteria:**
- [ ] Search input field above tenants table with placeholder "Search tenants..."
- [ ] Debounced search (300ms delay) to avoid excessive filtering
- [ ] Searches across: businessName, subdomain, customDomain, nftTokenId
- [ ] Case-insensitive search
- [ ] Clear button (X) appears when search has text
- [ ] Shows "No tenants found" empty state when search returns 0 results
- [ ] Search persists in URL query param `?search=value`
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-005: Filter Tenants by Status
**Description:** As a super admin, I want to filter tenants by active/inactive status so I can focus on specific tenant segments.

**Acceptance Criteria:**
- [ ] Dropdown filter next to search: "All Tenants", "Active Only", "Inactive Only"
- [ ] Filter state persists in URL query param `?status=active|inactive|all`
- [ ] Badge shows count: "Active (15)" in dropdown
- [ ] Filters combine with search (AND logic)
- [ ] Default: "All Tenants" selected
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-006: Search and Filter Products
**Description:** As a tenant admin, I want to search products and filter by category/strain so I can manage my catalog efficiently.

**Acceptance Criteria:**
- [ ] Search input: placeholder "Search products..."
- [ ] Searches: name, category, slug fields
- [ ] Debounced 300ms
- [ ] Filter dropdown 1: Category (All, Flower, Edibles, Concentrates, etc.)
- [ ] Filter dropdown 2: Strain Type (All, Sativa, Indica, Hybrid)
- [ ] Filter dropdown 3: Stock Status (All, In Stock, Out of Stock)
- [ ] Filters combine with search using AND logic
- [ ] URL params: `?search=&category=&strain=&stock=`
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-007: Search and Filter Orders
**Description:** As a tenant admin, I want to search orders and filter by status/date so I can manage fulfillment efficiently.

**Acceptance Criteria:**
- [ ] Search input: searches orderNumber, customer name, customer email
- [ ] Filter dropdown 1: Status (All, Pending, Processing, Completed, Cancelled)
- [ ] Date range picker: "Last 7 days", "Last 30 days", "Last 90 days", "Custom range"
- [ ] Quick filter chips: "Needs Attention" (PENDING), "In Progress" (PROCESSING)
- [ ] Filters combine with search
- [ ] URL params: `?search=&status=&dateFrom=&dateTo=`
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-008: Search Customers
**Description:** As a tenant admin, I want to search customers by name or email so I can quickly find customer records.

**Acceptance Criteria:**
- [ ] Search input above customers table
- [ ] Searches: firstName, lastName, email, phone
- [ ] Debounced 300ms
- [ ] Clear button (X)
- [ ] Empty state: "No customers found matching '[query]'"
- [ ] URL param: `?search=value`
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### 3.2. HIGH PRIORITY - Table Enhancements

#### US-009: Pagination for Tenants Table
**Description:** As a super admin, I want paginated tenant results so the page loads quickly even with 100+ tenants.

**Acceptance Criteria:**
- [ ] Server-side pagination (not client-side)
- [ ] Default page size: 20 items
- [ ] Pagination controls at bottom of table
- [ ] Shows: "Showing 1-20 of 156 results"
- [ ] Previous/Next buttons (disabled at boundaries)
- [ ] Page size selector: 10, 20, 50, 100
- [ ] URL params: `?page=2&pageSize=20`
- [ ] Maintains search/filter state when paginating
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-010: Pagination for Products, Orders, Customers
**Description:** As a tenant admin, I want all list pages paginated consistently for better performance.

**Acceptance Criteria:**
- [ ] Apply same pagination component to: products, orders, customers pages
- [ ] Consistent page sizes: 20 default, options 10/20/50/100
- [ ] Same UI controls and URL param pattern
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill for each page

#### US-011: Sortable Table Columns
**Description:** As an admin, I want to click column headers to sort data so I can organize information by any field.

**Acceptance Criteria:**
- [ ] Click column header to sort ascending
- [ ] Click again to sort descending
- [ ] Click third time to clear sort (default order)
- [ ] Sort indicator icon: ↑ (asc), ↓ (desc), ↕ (sortable but not active)
- [ ] Sortable columns: All text/number/date columns
- [ ] URL param: `?sortBy=businessName&sortOrder=asc`
- [ ] Server-side sorting (not client-side)
- [ ] Sort persists with search/filter/pagination
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-012: Bulk Actions - Tenants
**Description:** As a super admin, I want to select multiple tenants and perform actions so I can efficiently manage multiple accounts.

**Acceptance Criteria:**
- [ ] Checkbox in table header (select all on page)
- [ ] Checkbox on each row (individual select)
- [ ] Action bar appears when ≥1 selected: "3 tenants selected"
- [ ] Actions: "Activate", "Deactivate", "Export to CSV", "Cancel"
- [ ] Confirmation dialog before bulk activation/deactivation
- [ ] Success toast: "3 tenants activated successfully"
- [ ] Selection clears after action completes
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-013: Bulk Actions - Products
**Description:** As a tenant admin, I want to bulk update products to save time on catalog management.

**Acceptance Criteria:**
- [ ] Bulk actions: "Set In Stock", "Set Out of Stock", "Export to CSV", "Delete"
- [ ] Delete shows confirmation: "Are you sure you want to delete 5 products? This cannot be undone."
- [ ] Audit log entry created for bulk actions
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-014: Bulk Actions - Orders
**Description:** As a tenant admin, I want to bulk update order statuses for efficient fulfillment.

**Acceptance Criteria:**
- [ ] Bulk actions: "Mark as Processing", "Mark as Completed", "Export to CSV"
- [ ] Cannot bulk update to Cancelled (requires individual confirmation)
- [ ] Shows count: "Update 7 orders to Processing?"
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### 3.3. MEDIUM PRIORITY - Navigation & Context

#### US-015: Breadcrumb Navigation
**Description:** As an admin, I want breadcrumbs on all pages so I know where I am and can navigate up levels easily.

**Acceptance Criteria:**
- [ ] Breadcrumbs component appears below header on all pages
- [ ] Format: Dashboard > Tenants > Healing Buds Store
- [ ] Each segment is clickable link except last (current page)
- [ ] Separated by ChevronRight icon
- [ ] Text colors: gray-600 for links, gray-900 for current
- [ ] Super Admin breadcrumbs start with "Dashboard"
- [ ] Tenant Admin breadcrumbs start with "Dashboard" and show tenant name
- [ ] Works on: tenant details, customer details, order details, etc.
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-016: Improved Empty States
**Description:** As an admin, I want helpful empty states so I know what to do when lists are empty.

**Acceptance Criteria:**
- [ ] Empty state component with: icon, heading, description, CTA button
- [ ] Products empty: "No products yet" + "Sync from Dr Green Admin" button
- [ ] Orders empty: "No orders yet" + illustration + "Your orders will appear here"
- [ ] Customers empty: "No customers yet" + "Share your store URL to get started"
- [ ] Tenants empty: "No tenants yet" + "Review Applications" button
- [ ] Search/filter empty: "No results found" + "Try adjusting your filters"
- [ ] Consistent styling across all empty states
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-017: Toast Notification System
**Description:** As an admin, I want clear feedback for all actions so I know when operations succeed or fail.

**Acceptance Criteria:**
- [ ] Use existing sonner toast library consistently
- [ ] Success toast: green with checkmark icon, 3s duration
- [ ] Error toast: red with X icon, 5s duration
- [ ] Loading toast: blue with spinner, dismissible
- [ ] All API mutations show toast feedback
- [ ] Examples: "Tenant activated", "Product updated", "Failed to load orders"
- [ ] Position: bottom-right on desktop, top-center on mobile
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### 3.4. MEDIUM PRIORITY - Dashboard Improvements

#### US-018: Super Admin Dashboard - Platform Analytics
**Description:** As a super admin, I want to see platform trends and health metrics so I can monitor business performance.

**Acceptance Criteria:**
- [ ] Add chart section below existing stats cards
- [ ] Chart 1: Tenant Signups (Line chart, last 90 days) using Plotly.js
- [ ] Chart 2: Platform Revenue (Bar chart, last 12 months) using Plotly.js
- [ ] Chart 3: Active vs Inactive Tenants (Pie chart) using Plotly.js
- [ ] Add "Needs Attention" card showing: Pending onboarding, Failed payments, Support tickets
- [ ] Quick metrics: MRR (Monthly Recurring Revenue), Churn Rate %, Avg Users per Tenant
- [ ] All charts responsive (full width on mobile, grid on desktop)
- [ ] Loading skeletons while charts fetch data
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-019: Tenant Dashboard - Store Analytics
**Description:** As a tenant admin, I want to see my store's performance so I can track sales and customer engagement.

**Acceptance Criteria:**
- [ ] Add revenue metrics cards: Today's Revenue, This Week, This Month
- [ ] Chart 1: Sales Trend (Line chart, last 30 days) using Plotly.js
- [ ] Chart 2: Top 5 Products (Horizontal bar chart) using Plotly.js
- [ ] Chart 3: Order Status Distribution (Donut chart) using Plotly.js
- [ ] "Recent Activity" widget: Last 5 orders with status and customer
- [ ] "Recent Customers" widget: Last 5 customer signups
- [ ] "Pending Consultations" count with link to consultations page
- [ ] All charts responsive
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-020: Quick Actions Widget
**Description:** As a tenant admin, I want shortcut buttons for common tasks so I can navigate faster.

**Acceptance Criteria:**
- [ ] Card titled "Quick Actions" in 2x2 or 2x3 grid
- [ ] Actions: "Add Product", "View Orders", "Manage Customers", "View Analytics", "Branding", "Settings"
- [ ] Each button: Icon, label, hover effect
- [ ] Click navigates to respective page
- [ ] Positioned prominently on dashboard (top-right or full-width section)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### 3.5. MEDIUM PRIORITY - Accessibility & Polish

#### US-021: Accessibility - Focus States
**Description:** As a keyboard user, I want visible focus indicators so I can navigate the admin panel without a mouse.

**Acceptance Criteria:**
- [ ] All interactive elements have focus-visible ring
- [ ] Ring style: `focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none`
- [ ] Super Admin ring color: `ring-slate-400`
- [ ] Applies to: buttons, links, inputs, selects, checkboxes
- [ ] Focus trap in modals (Tab cycles within modal)
- [ ] Skip to content link at top of page (visible on focus)
- [ ] Typecheck/lint passes
- [ ] Test keyboard navigation: Tab, Shift+Tab, Enter, Escape

#### US-022: Accessibility - ARIA Labels
**Description:** As a screen reader user, I want proper labels on all controls so I can navigate effectively.

**Acceptance Criteria:**
- [ ] Sidebar collapse button: `aria-label="Collapse sidebar"` / `aria-label="Expand sidebar"`
- [ ] Sidebar: `aria-expanded={!collapsed}`
- [ ] Hamburger menu: `aria-label="Open navigation menu"`
- [ ] Search inputs: `aria-label="Search tenants"`
- [ ] Filter dropdowns: `aria-label="Filter by status"`
- [ ] Pagination: `aria-label="Go to page 2"`, `aria-label="Previous page"`
- [ ] Bulk action checkboxes: `aria-label="Select tenant Healing Buds"`
- [ ] Status badges: `aria-label="Status: Active"`
- [ ] Typecheck/lint passes
- [ ] Test with screen reader (VoiceOver on Mac or NVDA on Windows)

#### US-023: Color Contrast Compliance
**Description:** As a user with vision impairment, I want sufficient color contrast so I can read all text clearly.

**Acceptance Criteria:**
- [ ] All text on gradient backgrounds has minimum 4.5:1 contrast (AA standard)
- [ ] Use `text-white` with `drop-shadow-sm` on colored cards where needed
- [ ] Badge text colors meet contrast requirements
- [ ] Link colors (cyan-600) meet contrast on white backgrounds
- [ ] Test using browser DevTools or online contrast checker
- [ ] Fix any failing combinations (darken background or lighten text)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### 3.6. LOW PRIORITY - Advanced Features

#### US-024: Export to CSV
**Description:** As an admin, I want to export table data to CSV so I can analyze it in Excel or share with others.

**Acceptance Criteria:**
- [ ] "Export to CSV" button on all list pages
- [ ] Exports current filtered/searched results (not all data)
- [ ] CSV includes all table columns
- [ ] Filename format: `tenants-export-2026-01-09.csv`
- [ ] Shows loading state: "Exporting..." during download
- [ ] Success toast: "Exported 42 records to CSV"
- [ ] Uses browser download (no server endpoint needed)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-025: Keyboard Shortcuts
**Description:** As a power user, I want keyboard shortcuts so I can navigate faster.

**Acceptance Criteria:**
- [ ] Cmd+K (Mac) / Ctrl+K (Windows): Focus search input
- [ ] G then D: Go to Dashboard
- [ ] G then T: Go to Tenants (super admin)
- [ ] G then P: Go to Products (tenant admin)
- [ ] G then O: Go to Orders
- [ ] Escape: Close modal/dialog
- [ ] Shortcuts shown in tooltip on hover over menu items
- [ ] Shortcuts modal: Cmd+/ or Ctrl+/ opens help
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-026: Recent Activity Timeline (Super Admin)
**Description:** As a super admin, I want to see a timeline of recent platform activity so I can monitor system health.

**Acceptance Criteria:**
- [ ] Timeline widget on dashboard showing last 20 events
- [ ] Events: Tenant created, Tenant activated, User registered, Order placed
- [ ] Each event: Icon, description, timestamp, actor (if applicable)
- [ ] "View All" link goes to full audit log page
- [ ] Real-time updates (optional, or refresh on page load)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-027: Notification Center (Header Badge)
**Description:** As an admin, I want a notification bell icon so I can see important alerts without checking each page.

**Acceptance Criteria:**
- [ ] Bell icon in header next to user profile
- [ ] Badge shows count of unread notifications (red circle)
- [ ] Click opens dropdown with last 5 notifications
- [ ] Notifications: Pending approvals, Failed orders, Low stock alerts
- [ ] Mark as read button for each notification
- [ ] "View All" link goes to notifications page
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-028: Print Packing Slip (Orders)
**Description:** As a tenant admin, I want to print packing slips for orders so I can include them in shipments.

**Acceptance Criteria:**
- [ ] "Print Packing Slip" button on order detail modal
- [ ] Opens print-friendly page with order details
- [ ] Includes: Order number, customer address, items, QR code
- [ ] CSS print styles: `@media print` removes nav, buttons
- [ ] Window.print() triggered automatically
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-029: Customer Notes Field (Orders)
**Description:** As a tenant admin, I want to add internal notes to orders so I can track special handling requirements.

**Acceptance Criteria:**
- [ ] "Admin Notes" textarea in order detail modal
- [ ] Notes saved to `orders.adminNotes` field (add migration if needed)
- [ ] Notes visible only to admins (not customers)
- [ ] Auto-save after 1s of no typing (debounced)
- [ ] Shows "Saved" indicator after successful save
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-030: Drag-and-Drop Product Ordering
**Description:** As a tenant admin, I want to reorder products by dragging so I can control how they appear in my store.

**Acceptance Criteria:**
- [ ] Enable drag-and-drop on products table (use @dnd-kit library)
- [ ] Add `displayOrder` integer field to products table
- [ ] Visual feedback: Row lifts and changes opacity while dragging
- [ ] Drop zones between rows highlighted
- [ ] Persists order to database on drop
- [ ] Shows loading state while saving
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### 3.7. TECHNICAL - Infrastructure

#### US-031: Shared Component Library
**Description:** As a developer, I need reusable components for search/filter/pagination so I don't duplicate code.

**Acceptance Criteria:**
- [ ] Create `components/admin/shared/` directory
- [ ] Components: `SearchInput`, `StatusFilter`, `Pagination`, `BulkActionBar`, `EmptyState`
- [ ] Each component: TypeScript props interface, JSDoc comments
- [ ] Storybook stories for each component (optional but recommended)
- [ ] Generic/reusable (not tied to specific domain)
- [ ] Typecheck/lint passes

#### US-032: Mobile Sidebar Component
**Description:** As a developer, I need a single mobile-aware sidebar component for both admin panels.

**Acceptance Criteria:**
- [ ] Refactor `DashboardSidebar` and `TenantDashboardSidebar` to share logic
- [ ] Accept props: `theme: 'super-admin' | 'tenant-admin'`, `menuItems`, `userName`, etc.
- [ ] Handle mobile state internally with useState
- [ ] Responsive CSS classes applied based on theme prop
- [ ] Export single component: `AdminSidebar`
- [ ] Typecheck/lint passes

#### US-033: URL State Management Utility
**Description:** As a developer, I need helpers for managing search/filter/pagination in URL params consistently.

**Acceptance Criteria:**
- [ ] Create `lib/admin/url-state.ts` utility file
- [ ] Functions: `useTableState()` hook returning {search, filters, page, pageSize, sort}
- [ ] Hook syncs with URL params using Next.js useSearchParams
- [ ] Functions: `setSearch(value)`, `setFilter(key, value)`, `setPage(n)`, `setSort(column)`
- [ ] TypeScript generic for filter types
- [ ] Used in all list pages for consistency
- [ ] Typecheck/lint passes

#### US-034: API Rate Limiting & Caching
**Description:** As a developer, I need to prevent API abuse and improve performance with caching.

**Acceptance Criteria:**
- [ ] Add rate limiting to all admin API routes (20 requests/minute per user)
- [ ] Return 429 status with `Retry-After` header when exceeded
- [ ] Cache dashboard stats with React Query (staleTime: 5 minutes)
- [ ] Cache tenant/product lists (staleTime: 1 minute)
- [ ] Invalidate cache on mutations (create/update/delete)
- [ ] Typecheck/lint passes

## 4. Functional Requirements

### 4.1. Mobile Responsiveness
- **FR-1:** All pages must be fully functional on viewport widths from 375px to 3840px.
- **FR-2:** Navigation sidebar must be off-canvas on viewports <768px.
- **FR-3:** Tables must scroll horizontally on mobile without breaking layout.
- **FR-4:** Cards must stack vertically on mobile (grid-cols-1).
- **FR-5:** Touch targets must be minimum 44x44px for mobile usability.

### 4.2. Search & Filter
- **FR-6:** All list pages (tenants, products, orders, customers) must have search functionality.
- **FR-7:** Search must be debounced with 300ms delay.
- **FR-8:** Filters must persist in URL query parameters.
- **FR-9:** Combining search + filters must use AND logic (both conditions must match).
- **FR-10:** Clearing search/filters must show all results.

### 4.3. Pagination & Sorting
- **FR-11:** All tables with >20 items must implement server-side pagination.
- **FR-12:** Default page size: 20 items, configurable to 10/20/50/100.
- **FR-13:** Pagination state must persist in URL (`?page=2&pageSize=20`).
- **FR-14:** Column sorting must be server-side, triggered by clicking headers.
- **FR-15:** Sort state persists in URL (`?sortBy=name&sortOrder=asc`).

### 4.4. Bulk Actions
- **FR-16:** Tables must support multi-select via checkboxes.
- **FR-17:** Bulk action bar appears when ≥1 item selected.
- **FR-18:** Destructive bulk actions (delete, deactivate) require confirmation.
- **FR-19:** Bulk actions create audit log entries.
- **FR-20:** Success/error feedback via toast notifications.

### 4.5. Visual Design
- **FR-21:** Super Admin sidebar: Slate/zinc dark gradient (`from-slate-800 via-slate-900 to-zinc-900`).
- **FR-22:** Tenant Admin sidebar: Cyan/blue gradient (`from-cyan-600 via-blue-600 to-indigo-700`).
- **FR-23:** Gradient cards reserved for KPI metrics and primary actions.
- **FR-24:** Data tables use simple white cards with subtle borders.
- **FR-25:** All text on colored backgrounds must meet WCAG AA contrast (4.5:1).

### 4.6. Analytics & Charts
- **FR-26:** Dashboard charts implemented using Plotly.js.
- **FR-27:** Charts must be responsive and render correctly on mobile.
- **FR-28:** Chart data fetched asynchronously with loading states.
- **FR-29:** Super Admin dashboard shows: Tenant signups, Platform revenue, Active/Inactive ratio.
- **FR-30:** Tenant Admin dashboard shows: Sales trend, Top products, Order status distribution.

### 4.7. Accessibility
- **FR-31:** All interactive elements must have visible focus indicators.
- **FR-32:** All icon-only buttons must have aria-labels.
- **FR-33:** Modals must trap focus and close on Escape key.
- **FR-34:** Form inputs must have associated labels (visible or aria-label).
- **FR-35:** Skip-to-content link must be first focusable element.

### 4.8. Navigation
- **FR-36:** Breadcrumbs must appear on all pages except top-level dashboard.
- **FR-37:** Breadcrumb format: Dashboard > Section > Current Page.
- **FR-38:** Each breadcrumb segment clickable except current page.
- **FR-39:** Active sidebar menu item highlighted with left border and background.
- **FR-40:** Sidebar collapses/expands on button click (desktop only).

## 5. Non-Goals (Out of Scope)

- **Dark Mode:** Not included in this phase. Light mode only.
- **User Impersonation:** Super Admin cannot "log in as" a tenant admin.
- **Advanced Analytics:** No predictive analytics, ML insights, or custom dashboards.
- **Third-Party Integrations:** No Zapier, Slack, or external notification services.
- **Multi-Language Support:** English only for admin panels.
- **Custom Branding for Admins:** Admin panels use fixed themes (not tenant branding).
- **Real-Time Collaboration:** No concurrent editing detection or live cursors.
- **Mobile App:** Web-responsive only, no native iOS/Android apps.
- **Offline Mode:** No service worker or offline functionality.
- **Video Tutorials:** No in-app video guides or interactive tutorials.

## 6. Design Considerations

### 6.1. Component Reusability
- Create shared components in `components/admin/shared/` for search, filters, pagination.
- Use composition pattern: `<Table>`, `<Table.Header>`, `<Table.Row>`, `<Table.Cell>`.
- Single sidebar component with theme prop instead of two separate components.

### 6.2. Color Palette
```typescript
// Super Admin Theme
const superAdminTheme = {
  sidebar: 'from-slate-800 via-slate-900 to-zinc-900',
  sidebarText: 'text-slate-300',
  sidebarActive: 'bg-slate-700/50 border-slate-400',
  sidebarHover: 'hover:bg-slate-700/30',
  accent: 'slate-700',
  badge: 'bg-slate-700/20 text-slate-200',
};

// Tenant Admin Theme
const tenantAdminTheme = {
  sidebar: 'from-cyan-600 via-blue-600 to-indigo-700',
  sidebarText: 'text-white/80',
  sidebarActive: 'bg-cyan-500/30 border-cyan-300',
  sidebarHover: 'hover:bg-white/10',
  accent: 'cyan-500',
  badge: 'bg-white/20 text-white',
};
```

### 6.3. Typography
- Page Title: `text-2xl md:text-3xl font-bold text-slate-900`
- Section Title: `text-xl md:text-2xl font-bold text-slate-900`
- Card Title: `text-lg font-semibold text-slate-900`
- Body Text: `text-base text-slate-700`
- Caption: `text-sm text-slate-600`

### 6.4. Spacing
- Page padding: `p-4 md:p-6 lg:p-8`
- Card padding: `p-6`
- Grid gaps: `gap-4 md:gap-6`
- Stack spacing: `space-y-4 md:space-y-6`

### 6.5. Responsive Breakpoints
- Mobile: `< 768px` (sm)
- Tablet: `768px - 1024px` (md)
- Desktop: `1024px - 1440px` (lg)
- Large Desktop: `> 1440px` (xl)

### 6.6. Existing Components to Reuse
- shadcn/ui: Button, Card, Table, Badge, Dialog, Select, Input, Checkbox
- Lucide React: All icons
- sonner: Toast notifications
- date-fns: Date formatting
- Plotly.js: Charts and graphs

## 7. Technical Considerations

### 7.1. Performance
- **Server-Side Rendering:** All admin pages use Next.js SSR for initial load.
- **Server Actions:** Use Next.js server actions for mutations (create/update/delete).
- **React Query:** Cache dashboard stats and list data with appropriate staleTime.
- **Lazy Loading:** Code-split Plotly.js charts to reduce initial bundle size.
- **Virtual Scrolling:** Not needed unless lists exceed 1000 items.

### 7.2. Database Queries
- **Pagination:** Use Prisma `skip` and `take` for server-side pagination.
- **Search:** Use Prisma `contains` with `mode: 'insensitive'` for case-insensitive search.
- **Filtering:** Combine multiple `where` clauses with AND logic.
- **Sorting:** Use Prisma `orderBy` with dynamic column and direction.
- **Indexing:** Add database indexes on frequently searched/filtered columns.

### 7.3. State Management
- **URL State:** Search, filter, pagination, sort state in URL query params.
- **Client State:** Sidebar open/close, bulk selection, modal visibility use React useState.
- **Server State:** All data fetching managed by React Query or Next.js server components.
- **Form State:** react-hook-form with zod validation for all forms.

### 7.4. Testing Strategy
- **Unit Tests:** Shared components (SearchInput, Pagination, etc.) with Jest/Vitest.
- **Integration Tests:** Page-level tests with Playwright covering critical flows.
- **Visual Tests:** Manual browser testing at 375px, 768px, 1024px, 1440px.
- **Accessibility Tests:** Manual screen reader testing + automated tools (axe-core).

### 7.5. Migration Strategy
- **Phase 1:** Core infrastructure (mobile sidebar, shared components) - Week 1
- **Phase 2:** Search/filter/pagination on all pages - Week 2
- **Phase 3:** Bulk actions and table enhancements - Week 3
- **Phase 4:** Dashboard improvements and charts - Week 4
- **Phase 5:** Accessibility and polish - Week 5
- **Phase 6:** Advanced features (export, shortcuts, etc.) - Week 6

### 7.6. Backward Compatibility
- **API Routes:** No breaking changes to existing API endpoints.
- **Database Schema:** Only additive changes (new columns, no removals).
- **Component Props:** Existing component props remain unchanged, new props added as optional.
- **URL Structure:** Existing routes preserved, query params added.

### 7.7. Dependencies to Add
```json
{
  "@tanstack/react-query": "^5.0.0",
  "@dnd-kit/core": "^6.1.0",
  "@dnd-kit/sortable": "^8.0.0",
  "plotly.js": "^2.27.0", // Already installed
  "react-plotly.js": "^2.6.0" // Already installed
}
```

## 8. Success Metrics

### 8.1. Performance Metrics
- **Mobile Lighthouse Score:** >90 for Performance, Accessibility, Best Practices
- **Page Load Time:** <2s for dashboard, <3s for list pages (3G connection)
- **Time to Interactive:** <3s on mobile devices
- **Bundle Size:** Admin pages <500KB gzipped

### 8.2. Usability Metrics
- **Task Completion Rate:** 95%+ for "Find specific tenant" task with search
- **Time to Complete Tasks:** 50% reduction in time to find and manage records
- **Error Rate:** <5% of users encounter errors during admin tasks
- **Mobile Usage:** 20%+ of admin users can now access panels on mobile

### 8.3. Accessibility Metrics
- **WCAG Compliance:** 100% AA compliance (4.5:1 contrast, keyboard nav, ARIA labels)
- **Keyboard Navigation:** 100% of features accessible without mouse
- **Screen Reader Support:** All critical flows tested with VoiceOver/NVDA

### 8.4. Feature Adoption
- **Search Usage:** 60%+ of list page views include search query
- **Filter Usage:** 40%+ of list page views include at least one filter
- **Bulk Actions:** 30%+ of tenants use bulk actions within first month
- **Export CSV:** 20%+ of admins export data at least once per month

### 8.5. Business Metrics
- **Admin Support Tickets:** 30% reduction in "can't find X" support requests
- **Admin Efficiency:** 40% reduction in time spent on routine management tasks
- **Mobile Admin Adoption:** 15% of admin sessions from mobile devices (up from 0%)
- **User Satisfaction:** Net Promoter Score (NPS) >50 for admin panel experience

## 9. Open Questions

1. **Charts Library:** Plotly.js is powerful but has large bundle size. Should we consider lighter alternatives like Recharts for simple charts?
   - **Decision:** Use Plotly.js as specified, but lazy load to minimize impact.

2. **Real-Time Updates:** Should dashboard stats auto-refresh every X minutes, or only on page load?
   - **Decision:** TBD - User to decide if polling needed or manual refresh acceptable.

3. **Audit Logging:** Should bulk actions log individual entries or single "bulk" entry?
   - **Decision:** TBD - Recommend single entry with metadata listing affected items.

4. **Mobile Sidebar Behavior:** Should sidebar auto-close on route change?
   - **Decision:** Yes, for better UX.

5. **Search Scope:** Should super admin search include tenant admin names/emails?
   - **Decision:** TBD - User to confirm if searching tenant users is needed.

6. **Pagination:** Should we cache previous pages for instant back navigation?
   - **Decision:** Use React Query cache with 1-minute staleTime for recent pages.

7. **Dark Mode:** Even though out of scope, should color tokens be prepared for future dark mode?
   - **Decision:** Not a priority, can be added later if needed.

8. **Notification Persistence:** Should notification center use database storage or in-memory?
   - **Decision:** TBD - Recommend database table for persistence.

9. **Export Format:** CSV only, or should we support Excel (.xlsx)?
   - **Decision:** CSV only for v1, Excel can be added later if needed.

10. **Chart Data Range:** Are default date ranges (7/30/90 days) acceptable or user-configurable?
    - **Decision:** TBD - Recommend fixed defaults for v1, add date pickers in future iteration.

---

## Implementation Checklist

### Prerequisites
- [ ] Review PRD with stakeholders and get approval
- [ ] Set up project tracking (GitHub issues or Linear)
- [ ] Create feature branch: `feature/admin-panel-improvements`
- [ ] Run `npm install @tanstack/react-query @dnd-kit/core @dnd-kit/sortable`

### Phase 1: Foundation (Week 1)
- [ ] US-031: Shared component library
- [ ] US-032: Mobile sidebar component
- [ ] US-033: URL state management utility
- [ ] US-001: Mobile responsive sidebar
- [ ] US-002: Super Admin theme
- [ ] US-003: Tenant Admin theme

### Phase 2: Search & Filter (Week 2)
- [ ] US-004: Search tenants
- [ ] US-005: Filter tenants
- [ ] US-006: Search/filter products
- [ ] US-007: Search/filter orders
- [ ] US-008: Search customers

### Phase 3: Tables (Week 3)
- [ ] US-009: Pagination tenants
- [ ] US-010: Pagination products/orders/customers
- [ ] US-011: Sortable columns
- [ ] US-012: Bulk actions tenants
- [ ] US-013: Bulk actions products
- [ ] US-014: Bulk actions orders

### Phase 4: Context & Navigation (Week 4)
- [ ] US-015: Breadcrumb navigation
- [ ] US-016: Improved empty states
- [ ] US-017: Toast notifications
- [ ] US-020: Quick actions widget

### Phase 5: Analytics (Week 5)
- [ ] US-018: Super Admin dashboard analytics
- [ ] US-019: Tenant Admin dashboard analytics
- [ ] US-034: API rate limiting & caching

### Phase 6: Accessibility (Week 6)
- [ ] US-021: Focus states
- [ ] US-022: ARIA labels
- [ ] US-023: Color contrast

### Phase 7: Advanced Features (Optional)
- [ ] US-024: Export to CSV
- [ ] US-025: Keyboard shortcuts
- [ ] US-026: Recent activity timeline
- [ ] US-027: Notification center
- [ ] US-028: Print packing slip
- [ ] US-029: Customer notes
- [ ] US-030: Drag-and-drop ordering

### Testing & Deployment
- [ ] Manual testing on 375px, 768px, 1024px, 1440px
- [ ] Keyboard navigation testing
- [ ] Screen reader testing (VoiceOver/NVDA)
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Lighthouse audit (>90 scores)
- [ ] Staging deployment and QA
- [ ] Production deployment
- [ ] Monitor error rates and performance
- [ ] Gather user feedback

---

**Document Status:** Ready for Implementation
**Created:** 2026-01-09
**Last Updated:** 2026-01-09
**Version:** 1.0
**Author:** Claude (AI Assistant)
**Approved By:** [Pending]
