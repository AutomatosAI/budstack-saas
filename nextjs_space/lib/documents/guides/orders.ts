import type { Guide } from "../types";

/**
 * Part 3 — The Order Desk. Written for a non-technical store owner; every claim
 * below matches the shipped behaviour (app/tenant-admin/orders/*,
 * app/api/tenant-admin/orders/*, components/admin/PackingSlip.tsx, and the
 * Dr Green status webhooks in lib/drgreen/status-event-handlers.ts).
 */
export const ordersGuide: Guide = {
  slug: "orders",
  part: 3,
  title: "The Order Desk",
  navLabel: "Orders",
  adminPath: "/tenant-admin/orders",
  summary:
    "Every order from placed to delivered — the queue you work each day, and what Dr Green is doing with it in the background.",
  status: "published",
  updatedAt: "2026-08-15",
  sections: [
    {
      id: "queue",
      kind: "tab",
      title: "The orders list",
      shot: {
        id: "orders",
        caption:
          "Order Management: four counts across the top, quick filters, and every order newest first with its Dr Green reference.",
        alt: "The Orders page showing status cards, quick filters and the orders table",
      },
      whatFor:
        "Every order your shop has taken, newest first — who placed it, what state it is in, and what it was worth. This is the screen you work each morning.",
      does: [
        "Four counts across the top: Total Orders, Pending, Processing and Completed.",
        "Two quick filters — Needs Attention (still pending) and In Progress (started) — each with a live count. Press one to narrow the list, press it again to clear it.",
        "A status box (All Orders, Pending, Processing, Completed, Cancelled) with counts, a date filter (last 7, 30 or 90 days, or two dates you pick), and a search that looks at the order reference, the customer's name and their email.",
        "The Order ID column shows the Dr Green invoice number once Dr Green has issued one, and a short reference from your own store until then.",
        "View on any row opens the order.",
        "Tick rows to get the bulk bar: Mark Processing, Mark Completed, Export CSV. There is deliberately no bulk cancel — cancelling is one order at a time, on purpose.",
      ],
      walkthroughs: [
        {
          title: "Work the morning queue",
          steps: [
            {
              text: "Open Orders in the left menu and read the four counts at the top.",
              note: "Pending is the one that matters: those are orders nobody has picked up yet.",
            },
            {
              text: "Press Needs Attention in the quick filters row.",
              note: "The list narrows to pending orders only and the button turns green while the filter is on.",
            },
            {
              text: "Press View on the oldest one at the bottom and check the customer, the items and the total.",
            },
            {
              text: "Press Start Processing, then close the window.",
              note: "You should see “Order status updated successfully”, the list reload, and the In Progress count go up by one. Work up the list the same way.",
            },
            {
              text: "When you are done, press Clear all so tomorrow you start from the whole list again.",
              note: "The filters live in the page's web address, so a bookmarked filtered view comes back filtered — clearing avoids that surprise.",
            },
          ],
        },
      ],
      why:
        "Orders age badly. One filtered pass down the pending list each morning is the difference between a customer who feels looked after and one who emails asking whether anyone is there.",
      notes: [
        "The four counts only cover Pending, Processing, Completed and Cancelled. Orders Dr Green has already moved on — Confirmed, Shipped, Delivered — still appear in the list with their own label but are in none of those totals, so the list can hold more orders than the cards add up to.",
        "A few old orders show Pending sync. Nothing in the store creates that status any more; they are leftovers from an earlier version of the checkout and can be read as pending.",
        "Amounts print with an R (rand) on this screen whatever currency your store sells in. The figure is right; the symbol is not yet.",
        "Export takes the page you are looking at — one row per order with the reference, customer, status, number of items, total and date.",
      ],
    },
    {
      id: "order-detail",
      kind: "editor",
      title: "Opening an order",
      whatFor:
        "The order window: who it is for, what is in it, what it came to, and the one place you record what your team is doing with it.",
      does: [
        "Customer name and email, and the date and time the order was placed.",
        "A status box with Pending, Processing, Completed and Cancelled, plus buttons that move the order one step: Start Processing on a pending order, Mark as Completed on one in progress, and Cancel Order until it is finished.",
        "Every line — product, quantity, price, line total — then subtotal, shipping and the total.",
        "Admin Notes: a private notepad for special handling, a gift message, or what you told the customer on the phone. It saves itself a second after you stop typing and shows Saved when it has.",
      ],
      why:
        "When a customer calls, everything you need to answer them is in one window — what they bought, what they paid, what state it is in and what your colleague wrote about it last week.",
      notes: [
        "Admin Notes are internal. Customers never see them, on the order page or anywhere else.",
        "Changing the status here does not tell Dr Green anything and does not email the customer. It is your team's record of who is doing what.",
        "Marking an order Completed does not stick in this build: Completed is not one of the states an order can be saved in, so the update is refused and you see “Failed to update order status”. It is also why the Completed count usually reads zero. Leave the order in Processing and let Dr Green's own Shipped and Delivered updates land.",
      ],
    },
    {
      id: "fulfilment",
      kind: "concept",
      title: "Who actually ships the order",
      whatFor:
        "Orders taken on your shop are placed with Dr Green, which holds the stock, dispenses and ships. Your order desk mirrors that process rather than driving it — worth knowing before you wonder why a status changed on its own.",
      does: [
        "At checkout the order is sent to Dr Green and comes back with a Dr Green reference and invoice number — the reference you see in the Order ID column.",
        "As Dr Green progresses the order it reports back, and your copy updates itself to Confirmed, Shipped, Delivered or Cancelled.",
        "Those same reports email the customer a status update from your store, with your business name on it — you do not have to send it.",
        "Payment outcomes arrive the same way, so a completed or failed payment lands on the order without anyone typing it in.",
        "If you have set up webhooks (Part 11), each of those moments is passed on to whatever you connected.",
      ],
      why:
        "You are not chasing couriers or counting stock — the medical supply side is Dr Green's job. What is left is the part customers judge you on: watching the queue, answering “where is my order?” with a straight answer, and leaving notes your team can act on.",
      notes: [
        "This is also why Cancel Order here is a record rather than an instruction: it marks your copy cancelled and sends nothing to Dr Green. A real cancellation has to go through them.",
        "If an order sits pending for a long time with no Dr Green reference, that is worth raising — it usually means the order never reached Dr Green, which no status change on this screen will fix.",
      ],
    },
    {
      id: "packing-slip",
      kind: "concept",
      title: "The packing slip",
      whatFor:
        "A print-ready page for the parcel: your business name at the top, the customer and their delivery address, every line to pack, the totals, and a QR code that opens the tracking page for that order.",
      does: [
        "It is laid out for paper — the on-screen buttons drop away when it prints.",
        "It opens your printer dialog by itself, and keeps Print Packing Slip and Close buttons above the document for a second copy.",
        "The QR code points at your store's public tracking page for that order number, so whoever opens the box can check it themselves.",
      ],
      walkthroughs: [
        {
          title: "Print a packing slip",
          steps: [
            {
              text: "Open the order from the list with View and read the items and quantities — that is what goes in the box.",
            },
            {
              text: "Check the delivery details with the customer's record (Part 4) before you pack, especially on a first order.",
            },
            {
              text: "Open the packing slip page for that order. The printer dialog opens on its own; if you dismissed it, press Print Packing Slip.",
              note: "In this build nothing on the orders list opens that page — the print button was taken off the order window and has not been put back — so it only opens if you have its direct address. That link is on the roadmap below.",
            },
            {
              text: "Until it returns, work from the order on screen, and use Export on the orders list to get a checklist of the orders to pack.",
              note: "The export gives one line per order — reference, customer, status, number of items, total, date — so it is a run sheet, not a per-item pick list.",
            },
          ],
        },
      ],
      why:
        "A slip in the box tells the customer what should be in their hands, and gives whoever packed it something to check against before it is sealed. It is the cheapest way to stop a “something's missing” email.",
      notes: [
        "The slip prints the delivery address held on the order. If that address looks wrong, fix it with the customer before shipping — reprinting is quicker than a returned parcel.",
      ],
    },
  ],
  improvements: [
    "Put the packing slip back on the order row, one click from the list.",
    "Replace Completed with the states an order really passes through — Confirmed, Shipped, Delivered — so the counts, filters and buttons agree with the order.",
    "Show amounts in the store's own currency instead of a fixed R.",
    "Count every status in the cards, so the totals match the list underneath them.",
  ],
};
