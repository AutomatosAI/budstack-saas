import dynamic from 'next/dynamic';
import { Suspense } from 'react';

/**
 * Dynamic template loader component
 * This component handles runtime loading of templates from the filesystem
 */

interface DynamicTemplateProps {
  templateSlug: string;
  [key: string]: any;
}

// Loading component
function TemplateLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading template...</p>
      </div>
    </div>
  );
}

// Error boundary component
function TemplateError({ error }: { error: Error }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Template Error</h2>
        <p className="text-gray-600">{error.message}</p>
      </div>
    </div>
  );
}

/**
 * Dynamically import a template based on its slug
 * This uses Next.js dynamic imports with webpack magic comments for better code splitting
 */
function getTemplateComponent(slug: string) {
  try {
    // Use dynamic import with template literals
    // Next.js/Webpack will create chunks for each template at build time
    return dynamic(() => import(`@/templates/${slug}/index`), {
      loading: () => <TemplateLoading />,
      ssr: true,
    });
  } catch (error) {
    console.error(`[Dynamic Template] Failed to load template: ${slug}`, error);
    throw error;
  }
}

export function DynamicTemplate({ templateSlug, ...props }: DynamicTemplateProps) {
  try {
    const Template = getTemplateComponent(templateSlug);

    return (
      <Suspense fallback={<TemplateLoading />}>
        <Template {...props} />
      </Suspense>
    );
  } catch (error) {
    return <TemplateError error={error as Error} />;
  }
}
