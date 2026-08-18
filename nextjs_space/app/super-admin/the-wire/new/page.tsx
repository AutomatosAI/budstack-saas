import PlatformPostForm from "../post-form";

/**
 * A blank platform post. No database read, so no `force-dynamic` is needed —
 * the super-admin layout's own `currentUser()` already makes this segment
 * dynamic, and it is that layout (plus middleware) that gates the route.
 */

export const metadata = {
  title: "New post — The Wire",
};

export default function NewPlatformPostPage() {
  return <PlatformPostForm />;
}
