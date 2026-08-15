/**
 * Editorial blog posts for budstacks.io/blog.
 *
 * Single source of truth — both the index (app/blog/page.tsx) and the detail
 * page (app/blog/[slug]/page.tsx) read from here, so a new post is one edit.
 * The six original sample posts still live inline in those two files; migrate
 * them here as each is rewritten.
 */

export type BlogPost = {
  id: number;
  slug: string;
  title: string;
  date: string;
  author: string;
  role: string;
  excerpt: string;
  image: string;
  /** Rendered as HTML by the detail page. */
  content: string;
};

export const BLOG_POSTS: BlogPost[] = [
  {
    id: 101,
    slug: "wordpress-or-budstacks-cannabis-storefront",
    title: "Should You Build Your Cannabis Storefront on WordPress?",
    date: "Aug 15, 2026",
    author: "BudStacks",
    role: "Platform Team",
    excerpt:
      "We run cannabis storefronts on both WordPress and BudStacks. Here is the honest comparison, including the parts that do not flatter us.",
    image: "/images/blog/post-01-franchise.svg",
    content: `
      <p>We are not neutral here, and you should read this knowing that. But we also run a fleet of cannabis storefronts on WordPress — real ones, taking real orders — alongside the BudStacks platform. That gives us something most comparison articles do not have: the specific list of things that broke.</p>

      <p>So here is the honest version, including where WordPress wins.</p>

      <h2>What WordPress genuinely does well</h2>
      <p>It is the most flexible publishing tool ever built, it costs almost nothing to start, and every developer on earth knows it. If you want a page to look a particular way, someone has already built a plugin for it. For a blog, a brochure site, or an ordinary shop selling ordinary things, WordPress plus WooCommerce is a sensible, boring, correct answer.</p>

      <p>If your storefront is mostly a shop window and your orders arrive by phone, stop reading. WordPress will serve you well and cost you a few pounds a month.</p>

      <h2>WordPress does not know it is selling cannabis</h2>
      <p>This is the whole thing, really. WooCommerce was built to sell t-shirts. It has no concept of a patient, a prescription, an identity document, or a jurisdiction that will fine you for shipping into it.</p>

      <p>Every one of those concepts has to be bolted on. In our own WordPress fleet, that meant building and maintaining four separate plugins:</p>

      <ul>
        <li><strong>Identity upload</strong> — capturing a customer's ID, storing it somewhere defensible, and getting it in front of a human to approve or reject before an order can proceed.</li>
        <li><strong>Direct payment</strong> — because the default checkout flow assumes the customer can simply pay, and a medical order cannot be paid for until the customer is verified.</li>
        <li><strong>Local pricing</strong> — showing the right currency and the right price to the right country, which sounds trivial until you have priced South African rand at dollar values.</li>
        <li><strong>Policies</strong> — the consent, terms, and disclosure furniture that regulated retail requires on every page.</li>
      </ul>

      <p>None of those is exotic. All of them are the sort of thing you discover you need three weeks after launch, usually because something went wrong.</p>

      <h2>The update problem nobody mentions</h2>
      <p>One WordPress site is a pleasure. Twenty is a job. Two hundred is a full-time engineering function.</p>

      <p>Every plugin you add is a thing that updates on its own schedule, occasionally breaks against a WordPress core release, and needs testing across every site you run. We ended up writing a fleet patching tool purely to push a single fix across hundreds of sites without visiting each one by hand. That tool exists because the alternative was a person clicking through admin panels for two days.</p>

      <p>If you plan to run one store, this is not your problem. If you plan to run several, it is the problem.</p>

      <h2>Compliance is not a plugin</h2>
      <p>The parts of a medical cannabis store that keep you out of trouble are unglamorous and structural: identity verification before an order can be placed, a consultation questionnaire, geographic gating for regions you are not licensed to serve, consent capture that survives an audit, and a log of who changed what and when that cannot be quietly edited afterwards.</p>

      <p>You can assemble all of that on WordPress. People do. But you are then the person responsible for it — for the encryption of those ID documents, for the redaction of personal data in your logs, for proving to a regulator that the audit trail is genuine. That responsibility does not go away because a plugin author said it was handled.</p>

      <p>On BudStacks those pieces are part of the platform rather than an add-on, which is a claim worth being precise about: it does not make you compliant. It means the mechanism exists and works the same way on every store, and that keeping it working is our job rather than yours. You still have to operate lawfully in your own jurisdiction.</p>

      <h2>The honest cost comparison</h2>
      <p>WordPress hosting runs a few pounds a month. That is genuinely cheaper than any SaaS subscription, and anyone who tells you otherwise is selling something.</p>

      <p>The cost you are actually comparing is the build. Assembling a compliant medical cannabis storefront from scratch — the identity workflows, the payment integration, the supplier connection, the legal review — is the part that runs into serious money and serious time. Our own estimate for doing it properly from nothing is $200,000 to $500,000 and one to three years, which matches what operators who have tried it tell us.</p>

      <p>The subscription is not competing with your hosting bill. It is competing with that build.</p>

      <h2>So which one</h2>
      <p><strong>Choose WordPress</strong> if you have development capacity in-house, you are running one or two sites, you want total control of every pixel and every integration, and you are comfortable owning the compliance surface yourself.</p>

      <p><strong>Choose BudStacks</strong> if you want to be selling this quarter rather than building this year, if you would rather spend your time on patients than on plugin updates, and if you want the compliance machinery to be someone else's problem to maintain.</p>

      <p>There is no clever answer here. It is a straight trade: control and cheap hosting on one side, time and maintained compliance on the other. Anyone who tells you one option is simply better has not run both.</p>
    `,
  },
  {
    id: 102,
    slug: "real-economics-medical-cannabis-storefront",
    title: "The Real Economics of a Medical Cannabis Storefront",
    date: "Aug 15, 2026",
    author: "BudStacks",
    role: "Platform Team",
    excerpt:
      "Margin per gram, where the profit share goes, what the overhead really is, and the number that decides whether any of it works.",
    image: "/images/blog/post-06-analytics.svg",
    content: `
      <p>Most people considering a cannabis storefront ask about the setup cost first. It is the wrong first question. The setup cost is a one-off you can plan for. The economics are what you live in every month afterwards.</p>

      <p>So let us do the arithmetic properly, including the parts that are less fun.</p>

      <h2>Start with one gram</h2>
      <p>The unit that matters is a single gram, and the number that matters is your margin on it — roughly $3 to $4 depending on what you are selling and what you charge.</p>

      <p>That figure is the whole business in miniature. Everything below is that number multiplied by how much you sell and reduced by what it costs you to operate.</p>

      <h2>Where the profit share goes, and when it stops</h2>
      <p>On the Lease-to-Own path, 20% of gross goes to the platform during the lease. On a $4 margin, that is $0.80 to us and $3.20 to you.</p>

      <p>The part worth understanding is that this is temporary by design. Complete the lease and the profit share drops to zero, along with the monthly licence rental. Buy the licence outright at the start and it never applies at all. Those are genuinely different financial shapes: the lease trades a slice of your upside for a low entry cost, and outright ownership trades capital up front for keeping everything.</p>

      <p>Which suits you depends entirely on whether capital or certainty is the thing you are short of.</p>

      <h2>The overhead, stated plainly</h2>
      <p>During a lease you are paying the $169 monthly licence rental plus your subscription tier — $99, $149, or $199 depending on which tools you need. Worst case, on the top tier, that is $368 a month. On the entry tier it is $268.</p>

      <p>Call it somewhere between three and four and a half thousand dollars a year while you are leasing. That is your floor. You need to clear it before you have made a penny.</p>

      <p>At a $3.50 margin, covering $368 of monthly overhead takes about 105 grams a month. Roughly three and a half grams a day. That is the actual break-even, and it is a more useful number than any revenue projection.</p>

      <h2>The number that decides everything</h2>
      <p>Here is the part the brochures skip. Your revenue is not driven by the platform, the design, or the product range. It is driven by two things: how many patients you have, and how often they come back.</p>

      <p>A patient buying 30 grams a month at a $4 margin is worth about $120 of margin a month to you. Ten of them is $1,200. A hundred is $12,000. The arithmetic is not complicated — but every one of those patients has to be found, verified, and kept.</p>

      <p>Reorder rate is the quiet multiplier. A store where patients return every month is a fundamentally different business from one where they buy once and vanish, even with identical patient counts. This is why the analytics in the platform track your reorder cycle and flag patients who are overdue: that list is worth more than any acquisition campaign, because winning back someone who already trusts you is the cheapest sale you will ever make.</p>

      <h2>The part that is not passive</h2>
      <p>You will see this sold as passive income. It is not, and we would rather tell you now than have you discover it in month two.</p>

      <p>What you do not have to do is real and substantial: you never handle stock, you never touch the product, fulfilment and logistics are handled, and the compliance machinery runs without you. That removes most of what makes traditional retail exhausting.</p>

      <p>What remains is a job. Orders arrive and need attention. Identity documents need reviewing and approving, and rejecting one badly loses you a customer. Patients email with questions. Somebody has to write the content that brings new people in, and somebody has to notice when reorders slow down. Our own store owners describe it as a couple of focused hours a day once it is running, more at the start.</p>

      <p>That is a good business. It is not a passive one, and anyone describing it as passive is either misinformed or selling to you.</p>

      <h2>Do the arithmetic yourself</h2>
      <p>Take your realistic patient count for month six — not month sixty. Multiply by the grams you expect each to buy. Multiply by your margin. Subtract your overhead. That number, not anyone's projection table, is what you should make the decision on.</p>

      <p>If it works at a conservative patient count, the upside takes care of itself. If it only works at a heroic one, you have learned something valuable before spending anything.</p>

      <p><em>Every figure here is illustrative. Actual results depend on your market, your pricing, your patient base, and your own effort. Nothing on this page is a guarantee of earnings, and nothing here is financial advice.</em></p>
    `,
  },
];
