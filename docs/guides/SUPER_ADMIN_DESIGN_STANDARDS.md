# BudStack Super Admin - Design Standards

## 🎨 Color System

### Gradient Palette
```tsx
// Primary gradient (for main CTAs)
const PRIMARY_GRADIENT = "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"

// Card header gradients
const CARD_HEADERS = {
  blue: "bg-gradient-to-r from-blue-50 to-cyan-50",
  emerald: "bg-gradient-to-r from-emerald-50 to-teal-50",
  purple: "bg-gradient-to-r from-purple-50 to-pink-50",
  amber: "bg-gradient-to-r from-amber-50 to-orange-50",
  pink: "bg-gradient-to-r from-pink-50 to-rose-50",
  indigo: "bg-gradient-to-r from-indigo-50 to-purple-50",
  slate: "bg-gradient-to-r from-slate-50 to-slate-100",
}

// Metric card gradients (for stats)
const METRIC_GRADIENTS = {
  revenue: "bg-gradient-to-br from-emerald-500 to-teal-500",
  orders: "bg-gradient-to-br from-amber-500 to-orange-500",
  customers: "bg-gradient-to-br from-purple-500 to-pink-500",
  stores: "bg-gradient-to-br from-cyan-500 to-blue-500",
}
```

### Text Colors
```tsx
const TEXT_COLORS = {
  heading: "text-slate-900",      // Main headings
  subheading: "text-slate-600",   // Descriptions, labels
  body: "text-slate-700",         // Body text
  muted: "text-slate-500",        // Helper text
  link: "text-cyan-600 hover:text-cyan-700",
}
```

---

## 🔘 Button Standards

### Primary Button (Main CTA)
Use for the **single most important action** on a page.

```tsx
<Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-medium shadow-md hover:shadow-lg transition-all">
  Primary Action
</Button>
```

**Examples:**
- "Review Applications" (Tenants)
- "Upload New Template" (Templates)
- "Save Platform Branding" (Branding)
- "Save Settings" (Settings)

---

### Secondary Button
Use for **supportive actions** or navigation links.

```tsx
<Button variant="outline" className="border-slate-300 bg-white hover:bg-slate-50 text-slate-700">
  Secondary Action
</Button>
```

**Examples:**
- "Manage" (Table actions)
- "View Details"
- "Edit"
- "Back to [Page]"

---

### Destructive Button
Use for **dangerous/irreversible actions**.

```tsx
<Button className="bg-red-600 hover:bg-red-700 text-white shadow-md">
  Destructive Action
</Button>
```

**Examples:**
- "Deactivate Tenant"
- "Delete Tenant"
- "Delete Template"

---

### Ghost/Link Button
Use for **tertiary actions** or inline links.

```tsx
<Button variant="ghost" className="text-cyan-600 hover:text-cyan-700 hover:underline">
  Link Action
</Button>
```

**Examples:**
- "Learn More"
- "View Documentation"
- Internal navigation links

---

## 🃏 Card Standards

### Standard Card
```tsx
<Card className="shadow-lg border-slate-200">
  <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-cyan-50">
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description text</CardDescription>
  </CardHeader>
  <CardContent className="pt-6">
    {/* Content */}
  </CardContent>
</Card>
```

### Metric Card (Stats)
```tsx
<Card className="border-none shadow-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white overflow-hidden relative group hover:shadow-xl transition-shadow duration-300">
  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-300" />
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
    <CardTitle className="text-sm font-medium text-emerald-50">Metric Name</CardTitle>
    <Icon className="h-5 w-5 text-emerald-100" />
  </CardHeader>
  <CardContent className="relative z-10">
    <div className="text-3xl font-bold">Value</div>
    <p className="text-xs mt-2">Change indicator</p>
  </CardContent>
</Card>
```

---

## 🏷️ Badge Standards

### Status Badges
```tsx
// Active/Success
<Badge className="bg-emerald-500 hover:bg-emerald-600">Active</Badge>

// Pending/Warning
<Badge className="bg-amber-500 hover:bg-amber-600">Pending</Badge>

// Inactive/Neutral
<Badge className="bg-slate-400">Inactive</Badge>

// Error/Danger
<Badge className="bg-red-500">Error</Badge>
```

### Category Badges
```tsx
<Badge variant="outline" className="bg-white border-slate-300 text-slate-700">
  Category
</Badge>
```

### Tag Badges
```tsx
<Badge variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">
  tag-name
</Badge>
```

---

## 📊 Table Standards

### Table Header
```tsx
<Card className="shadow-lg border-slate-200">
  <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-slate-100">
    <CardTitle>Table Title</CardTitle>
    <CardDescription>Table description</CardDescription>
  </CardHeader>
  <CardContent className="pt-6">
    <Table>
      {/* Table content */}
    </Table>
  </CardContent>
</Card>
```

### Table Cell Actions
```tsx
// Use secondary button style
<Button variant="outline" size="sm" className="border-slate-300 hover:bg-slate-50">
  Manage
</Button>
```

---

## 📐 Spacing Standards

```tsx
// Page container
<div className="p-8">

// Page header spacing
<div className="mb-8">

// Section spacing
<div className="space-y-8">

// Grid gaps
<div className="grid gap-6">

// Card content padding
<CardContent className="pt-6">
```

---

## ✍️ Typography Standards

```tsx
// Page Title
<h1 className="text-3xl font-bold text-slate-900 tracking-tight">

// Page Description
<p className="text-slate-600 mt-2">

// Section Heading
<h2 className="text-xl font-semibold text-slate-900">

// Card Title
<CardTitle className="text-lg text-slate-900">

// Body Text
<p className="text-sm text-slate-700">

// Helper Text
<p className="text-sm text-slate-500">
```

---

## 🎯 Usage Guidelines

### Do's ✅
- Use **ONE primary button** per page (the main action)
- Use gradient headers on all cards for visual hierarchy
- Keep destructive actions red for consistency
- Use emerald for success states (active, approved, etc.)
- Use slate for neutral/inactive states

### Don'ts ❌
- Don't use multiple primary buttons on the same page
- Don't use random colors - stick to the gradient palette
- Don't use plain cards without gradient headers
- Don't use green for active states - use emerald
- Don't use gray - use slate

---

## 📱 Responsive Considerations

```tsx
// Grid responsiveness
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

// Button responsiveness
<Button size="sm" className="w-full md:w-auto">

// Text responsiveness
<h1 className="text-2xl md:text-3xl font-bold">
```

---

## 🔄 State Variations

### Hover States
```tsx
// Cards
hover:shadow-xl transition-shadow duration-300

// Buttons
hover:from-cyan-700 hover:to-blue-700 transition-all

// Links
hover:text-cyan-700 hover:underline
```

### Selection States
```tsx
// Selected item
border-emerald-500 bg-emerald-50 shadow-md

// Unselected item
border-slate-200 hover:border-slate-300 hover:shadow
```

---

## 📝 Code Examples

### Complete Page Template
```tsx
export default function ExamplePage() {
  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Page Title
            </h1>
            <p className="text-slate-600 mt-2">Page description</p>
          </div>
          <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-medium shadow-md hover:shadow-lg transition-all">
            Primary Action
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Card className="shadow-lg border-slate-200">
        <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-cyan-50">
          <CardTitle>Content Section</CardTitle>
          <CardDescription>Section description</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Content here */}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

**Last Updated:** January 8, 2026  
**Maintained By:** BudStack Development Team
