import type { Guide } from "./types";
import { overviewGuide } from "./guides/overview";
import { productsGuide } from "./guides/products";
import { ordersGuide } from "./guides/orders";
import { customersGuide } from "./guides/customers";
import { analyticsGuide } from "./guides/analytics";
import { brandingGuide } from "./guides/branding";
import { seoGuide } from "./guides/seo";
import { store_themesGuide } from "./guides/store-themes";
import { the_wireGuide } from "./guides/the-wire";
import { webhooksGuide } from "./guides/webhooks";
import { audit_logsGuide } from "./guides/audit-logs";
import { teamGuide } from "./guides/team";
import { settingsGuide } from "./guides/settings";
import { cookie_settingsGuide } from "./guides/cookie-settings";
import { company_detailsGuide } from "./guides/company-details";
import { legal_pagesGuide } from "./guides/legal-pages";
import { data_processorsGuide } from "./guides/data-processors";
import { emailsGuide } from "./guides/emails";

/** Every guide in series order. Adding a guide = one module + one line here. */
export const GUIDES: Guide[] = [
  overviewGuide,
  productsGuide,
  ordersGuide,
  customersGuide,
  analyticsGuide,
  brandingGuide,
  seoGuide,
  store_themesGuide,
  emailsGuide,
  the_wireGuide,
  webhooksGuide,
  audit_logsGuide,
  teamGuide,
  settingsGuide,
  cookie_settingsGuide,
  company_detailsGuide,
  legal_pagesGuide,
  data_processorsGuide,
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
