import { redirect } from "next/navigation";

/**
 * Old Signup Route - Deprecated
 *
 * All customer signups must go through tenant-specific consultation forms for KYC compliance.
 * This route redirects users to the homepage.
 */
export default function SignupPage() {
  redirect("/?message=Please visit your store to check eligibility");
}
