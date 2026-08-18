-- US-011 — the six sample posts move out of code and into `platform_posts`.
--
-- They were authored inline in app/blog/page.tsx AND app/blog/[slug]/page.tsx —
-- the drift that produced 6 entries in one array and 8 in the other. The [slug]
-- copy is the one migrated here: it is the only one that carries the article
-- bodies, the author and the role. US-010 did the same for the two editorial
-- posts in lib/blog/posts.ts; with this migration applied all 8 posts exist as
-- rows, which is the precondition US-012 checks before deleting the arrays.
--
-- THESE ARE PLACEHOLDER PROSE and everyone involved knows it. They are seeded
-- as published anyway, because the six /blog/<slug> URLs are already
-- indexed and already linked to, and a live URL with weak copy beats a 404.
-- A human rewrites them in the editor afterwards — that is editorial judgement
-- against framing rules Ralph does not get to apply, and the rewrite lands as
-- an edit to these rows rather than as another migration.
--
-- A TIMESTAMPED DIRECTORY, not a loose .sql at the top of prisma/migrations/.
-- entrypoint.sh runs `prisma migrate deploy`, which only ever reads directories
-- — the seven loose files up there have never been applied by a deploy. The
-- name also has to sort AFTER 20260815000000_add_platform_posts or it would run
-- against a table that does not exist.
--
-- IDEMPOTENT. `ON CONFLICT ("slug") DO NOTHING` against platform_posts_slug_key,
-- so a re-run, a replayed history or a restored database that already carries
-- the rows cannot duplicate a post — and cannot overwrite the rewrite when it
-- comes. Deliberately not an upsert, for exactly that reason.
--
-- SLUGS ARE IDENTICAL to the ones the arrays shipped, character for character.
-- Nothing here may be "tidied".
--
-- The ids are FIXED UUIDs rather than readable keys, because
-- /api/platform/posts/[id] runs `parseUuid` on the path param — a row keyed
-- 'sample-post-1' would be published but uneditable and undeletable through the
-- admin UI, which is precisely the row a human needs to open to rewrite it.
--
-- "publishedAt" is each post's own date string at 12:00 UTC. Midday keeps the
-- rendered date on the intended calendar day either side of UTC
-- (formatPostDate formats in the server's local zone). All six dates differ, so
-- unlike the editorial pair no tie-break offset is needed for the index's
-- publishedAt DESC ordering. "createdAt" matches so the tie-break behind it
-- agrees. The dates are 2025-12-10 to 2026-01-10, so these sort BELOW the two
-- editorial posts (2026-08-15) on the index — the intended order.
--
-- The body is DOLLAR-QUOTED, so the HTML is byte-for-byte what the
-- array held — apostrophes and all — with no escaping to get wrong. It is
-- stored raw and unsanitised on purpose: sanitizePostHtml runs on the way out
-- in app/blog/[slug]/page.tsx, so a policy change applies to rows that predate
-- it. This SQL was GENERATED from the array rather than retyped, so the six
-- bodies are transcription-error-free by construction.
--
-- "coverImageAlt" and "seo" stay NULL: the arrays had neither. The article
-- falls back to the title for the cover's alt text and builds its metadata from
-- the post's own fields.
--
-- See tasks/prd-platform-content-and-seo.md (US-011).

INSERT INTO "platform_posts"
    ("id", "slug", "title", "excerpt", "content", "coverImage",
     "authorName", "authorRole", "published",
     "publishedAt", "createdAt", "updatedAt")
VALUES
    ('c8c1e81d-7636-472e-bec7-9b7217276226',
     'getting-started-with-medical-cannabis-franchise',
     'Getting Started with Your Medical Cannabis Franchise',
     'A comprehensive guide to launching your dispensary franchise with BudStacks infrastructure.',
     $post$
      <p>Launching a medical cannabis franchise has never been easier. With BudStacks's proprietary infrastructure, you can go from application to live store in under 10 minutes.</p>
      
      <h2>Understanding the Franchise Model</h2>
      <p>Our franchise model is designed to give you complete operational flexibility while providing enterprise-grade infrastructure. Whether you choose fully managed, semi-managed, or independent operation, you get access to the same powerful tools.</p>
      
      <h2>Step 1: Apply for Your Franchise</h2>
      <p>The application process is straightforward. You'll need your NFT token ID for verification, basic business information, and your preferred operating country. Our team reviews applications within 24-48 hours.</p>
      
      <h2>Step 2: Customize Your Store</h2>
      <p>Once approved, you'll have access to our template system. Choose from professionally designed templates, customize colors and branding, upload your logo, and configure your domain.</p>
      
      <h2>Step 3: Launch and Scale</h2>
      <p>Your store goes live instantly. The Dr. Green API integration ensures your product catalog is always up to date, and our analytics dashboard gives you real-time insights into your business performance.</p>
      
      <h2>What's Included</h2>
      <ul>
        <li>White-label storefront with custom branding</li>
        <li>Admin dashboard with full analytics</li>
        <li>Dr. Green API integration for products</li>
        <li>Customer management and CRM</li>
        <li>Order tracking and fulfillment</li>
        <li>Blockchain traceability for compliance</li>
      </ul>
      
      <p>Ready to get started? Apply for your franchise today and join the growing network of medical cannabis dispensaries powered by BudStacks.</p>
    $post$,
     '/images/blog/post-01-franchise.svg',
     'Jordan Miller',
     'Head of Operations, BudStacks',
     true,
     '2026-01-10 12:00:00', '2026-01-10 12:00:00', '2026-01-10 12:00:00'),

    ('a0829caf-0776-4634-885c-50dbcb831053',
     'understanding-dr-green-api-integration',
     'Understanding Dr. Green API Integration',
     'How to leverage the Dr. Green API for seamless product catalog and order management.',
     $post$
      <p>The Dr. Green API is at the heart of every BudStacks franchise. This integration provides real-time product synchronization, automated inventory management, and seamless order fulfillment.</p>
      
      <h2>Real-Time Product Sync</h2>
      <p>Your product catalog is automatically synchronized with Dr. Green's database. When new products are added or prices change, your store updates instantly. No manual updates required.</p>
      
      <h2>Inventory Management</h2>
      <p>Stock levels are tracked in real-time. When a product runs low or goes out of stock, your store reflects this immediately. This prevents overselling and ensures customer satisfaction.</p>
      
      <h2>Order Fulfillment</h2>
      <p>When customers place orders, they're automatically routed to the fulfillment center. You can track order status from your admin dashboard, from processing to delivery.</p>
      
      <h2>API Health Monitoring</h2>
      <p>Our dashboard includes API health monitoring. You can see uptime statistics, response times, and any issues at a glance. Our current uptime is 99.9%.</p>
    $post$,
     '/images/blog/post-02-api.svg',
     'Stefan Klein',
     'Technical Lead, BudStacks',
     true,
     '2026-01-05 12:00:00', '2026-01-05 12:00:00', '2026-01-05 12:00:00'),

    ('305ad773-540b-4280-a83c-75cd7353185e',
     'blockchain-traceability-compliance',
     'Blockchain Traceability & Compliance',
     'Ensuring regulatory compliance with integrated blockchain tracking for your dispensary.',
     $post$
      <p>Regulatory compliance is critical in the medical cannabis industry. Our blockchain traceability system ensures complete transparency and audit readiness.</p>
      
      <h2>Why Blockchain?</h2>
      <p>Blockchain provides an immutable record of every transaction. From seed to sale, every step is recorded and verifiable. This meets the strictest regulatory requirements across all operating countries.</p>
      
      <h2>Audit Logging</h2>
      <p>Every action in your admin dashboard is logged. User access, order modifications, inventory changes - everything is recorded with timestamps and user attribution.</p>
      
      <h2>Compliance Reporting</h2>
      <p>Generate compliance reports with one click. Our system aggregates all required data and formats it according to your jurisdiction's requirements.</p>
    $post$,
     '/images/blog/post-03-blockchain.svg',
     'Emma Williams',
     'Compliance Officer, BudStacks',
     true,
     '2025-12-28 12:00:00', '2025-12-28 12:00:00', '2025-12-28 12:00:00'),

    ('9c39975b-1cc9-450c-9cde-e18ead515ce1',
     'scaling-multi-tenant-operations',
     'Scaling Multi-Tenant Operations',
     'Best practices for managing multiple storefronts with isolated data and custom branding.',
     $post$
      <p>As your franchise grows, you may want to operate multiple storefronts. Our multi-tenant architecture makes this seamless.</p>
      
      <h2>Data Isolation</h2>
      <p>Each storefront has completely isolated data. Customer information, orders, and analytics are kept separate. This ensures privacy and simplifies management.</p>
      
      <h2>Centralized Dashboard</h2>
      <p>While data is isolated, you can view all storefronts from a single dashboard. Compare performance, track orders, and manage inventory across locations.</p>
      
      <h2>Custom Branding Per Location</h2>
      <p>Each storefront can have its own branding. Different colors, logos, and content - all managed independently while sharing the same infrastructure.</p>
    $post$,
     '/images/blog/post-04-scale.svg',
     'João Mendes',
     'Solutions Architect, BudStacks',
     true,
     '2025-12-20 12:00:00', '2025-12-20 12:00:00', '2025-12-20 12:00:00'),

    ('2a3d32b3-7391-4db0-b26a-99ba276db545',
     'customer-management-best-practices',
     'Customer Management Best Practices',
     'Building lasting patient relationships through effective CRM and consultation tracking.',
     $post$
      <p>Strong customer relationships are the foundation of a successful dispensary. Our CRM tools help you manage every interaction.</p>
      
      <h2>Patient Onboarding</h2>
      <p>Streamline the patient onboarding process with our digital forms. Collect necessary documentation, verify KYC requirements, and get patients ready to order.</p>
      
      <h2>Consultation Tracking</h2>
      <p>Track every consultation, noting patient preferences, medical requirements, and recommendations. This information is securely stored and easily accessible.</p>
      
      <h2>Order History</h2>
      <p>View complete order history for each customer. Identify purchasing patterns, recommend products, and provide personalized service.</p>
    $post$,
     '/images/blog/post-05-customers.svg',
     'Maria Santos',
     'Customer Success, BudStacks',
     true,
     '2025-12-15 12:00:00', '2025-12-15 12:00:00', '2025-12-15 12:00:00'),

    ('b754ea2d-779f-4b5e-8173-4b9fb41e8fec',
     'maximizing-revenue-analytics',
     'Maximizing Revenue with Analytics',
     'Using data-driven insights to optimize your dispensary''s performance and growth.',
     $post$
      <p>Data-driven decision making is key to maximizing your dispensary's revenue. Our analytics dashboard provides the insights you need.</p>
      
      <h2>Revenue Tracking</h2>
      <p>Track daily, weekly, and monthly revenue. See trends over time and identify peak selling periods. Compare performance across time periods.</p>
      
      <h2>Product Performance</h2>
      <p>Identify your best-selling products and categories. See which items drive the most revenue and which have the highest margins.</p>
      
      <h2>Customer Insights</h2>
      <p>Understand your customer base. See average order values, purchase frequency, and customer lifetime value. Use this data to optimize your marketing.</p>
    $post$,
     '/images/blog/post-06-analytics.svg',
     'Stefan Klein',
     'Technical Lead, BudStacks',
     true,
     '2025-12-10 12:00:00', '2025-12-10 12:00:00', '2025-12-10 12:00:00')
ON CONFLICT ("slug") DO NOTHING;
