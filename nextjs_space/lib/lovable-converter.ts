import fs from 'fs/promises';
import path from 'path';

interface ConversionResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Lovable to BudStack Template Converter
 * 
 * Converts a Lovable.dev project structure to BudStack multi-tenant template format.
 * 
 * Lovable Structure:
 * - src/pages/Index.tsx (homepage)
 * - src/components/ (all components including Header, Footer)
 * - src/App.tsx (React Router setup)
 * 
 * BudStack Structure:
 * - index.tsx (main template entry)
 * - components/ (extracted homepage components, NO Header/Footer)
 * - defaults.json (design system configuration)
 * - template.config.json (metadata)
 * - styles.css (template-specific styles)
 */
export async function convertLovableTemplate(sourcePath: string): Promise<ConversionResult> {
  try {
    console.log('[Lovable Converter] Starting conversion...');
    console.log('[Lovable Converter] Source path:', sourcePath);

    // Step 1: Detect Lovable structure
    const isLovable = await detectLovableStructure(sourcePath);
    if (!isLovable) {
      return {
        success: false,
        error: 'Not a valid Lovable.dev project structure. Expected src/pages/Index.tsx and src/components/',
      };
    }

    console.log('[Lovable Converter] Lovable structure detected');

    // Step 2: Extract homepage components from src/pages/Index.tsx
    const components = await extractHomepageComponents(sourcePath);
    console.log(`[Lovable Converter] Found ${components.length} homepage components`);

    // Step 3: Transform file structure
    await transformFileStructure(sourcePath, components);
    console.log('[Lovable Converter] File structure transformed');

    // Step 4: Generate BudStack template files
    await generateTemplateFiles(sourcePath, components);
    console.log('[Lovable Converter] Template files generated');

    // Step 5: Refactor component code (remove React Router, add 'use client', etc.)
    await refactorComponents(sourcePath);
    console.log('[Lovable Converter] Components refactored');

    return {
      success: true,
      message: 'Template converted successfully from Lovable.dev structure',
    };
  } catch (error: any) {
    console.error('[Lovable Converter] Error:', error);
    return {
      success: false,
      error: error.message || 'Unknown conversion error',
    };
  }
}

/**
 * Detect if the extracted directory follows Lovable.dev structure
 */
async function detectLovableStructure(sourcePath: string): Promise<boolean> {
  try {
    const srcPath = path.join(sourcePath, 'src');
    const pagesPath = path.join(srcPath, 'pages');
    const indexPath = path.join(pagesPath, 'Index.tsx');
    const componentsPath = path.join(srcPath, 'components');

    // Check if required paths exist
    await fs.access(srcPath);
    await fs.access(pagesPath);
    await fs.access(indexPath);
    await fs.access(componentsPath);

    return true;
  } catch {
    return false;
  }
}

/**
 * Extract homepage component names from src/pages/Index.tsx
 */
async function extractHomepageComponents(sourcePath: string): Promise<string[]> {
  const indexPath = path.join(sourcePath, 'src', 'pages', 'Index.tsx');
  const content = await fs.readFile(indexPath, 'utf-8');

  // Extract component imports (excluding PageTransition, BackToTop, etc. but KEEP Header and Footer)
  const importRegex = /import (\w+) from ["']@\/components\/(\w+)["']/g;
  const components: string[] = [];
  const excludedComponents = ['PageTransition', 'BackToTop', 'MobileBottomActions', 'ScrollToTop', 'EligibilityDialog'];

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const componentName = match[1];
    if (!excludedComponents.includes(componentName)) {
      components.push(componentName);
    }
  }

  return components;
}

/**
 * Transform Lovable file structure to BudStack structure
 */
async function transformFileStructure(sourcePath: string, components: string[]): Promise<void> {
  // Create components directory if it doesn't exist
  const componentsDir = path.join(sourcePath, 'components');
  await fs.mkdir(componentsDir, { recursive: true });

  // Copy homepage components from src/components/ to components/
  for (const component of components) {
    const srcFile = path.join(sourcePath, 'src', 'components', `${component}.tsx`);
    const targetFile = path.join(componentsDir, `${component}.tsx`);

    try {
      await fs.access(srcFile);
      await fs.copyFile(srcFile, targetFile);
      console.log(`[Lovable Converter] Copied component: ${component}`);
    } catch (error) {
      console.warn(`[Lovable Converter] Could not copy component ${component}:`, error);
    }
  }

  // Copy assets if they exist
  const publicSrc = path.join(sourcePath, 'public');
  const publicDest = path.join(sourcePath, 'assets');
  
  try {
    await fs.access(publicSrc);
    await fs.cp(publicSrc, publicDest, { recursive: true });
    console.log('[Lovable Converter] Copied public assets');
  } catch {
    console.log('[Lovable Converter] No public assets found');
  }

  // Copy styles from src/index.css to styles.css
  try {
    const srcStyles = path.join(sourcePath, 'src', 'index.css');
    const targetStyles = path.join(sourcePath, 'styles.css');
    await fs.copyFile(srcStyles, targetStyles);
    console.log('[Lovable Converter] Copied styles');
  } catch (error) {
    console.warn('[Lovable Converter] Could not copy styles:', error);
  }
}

/**
 * Generate BudStack template files (index.tsx, defaults.json, template.config.json)
 */
async function generateTemplateFiles(sourcePath: string, components: string[]): Promise<void> {
  // Generate index.tsx
  const indexContent = generateIndexFile(components);
  await fs.writeFile(path.join(sourcePath, 'index.tsx'), indexContent, 'utf-8');
  console.log('[Lovable Converter] Generated index.tsx');

  // Generate defaults.json
  const defaultsContent = await generateDefaultsFile(sourcePath);
  await fs.writeFile(path.join(sourcePath, 'defaults.json'), JSON.stringify(defaultsContent, null, 2), 'utf-8');
  console.log('[Lovable Converter] Generated defaults.json');

  // Generate template.config.json
  const configContent = generateTemplateConfig(components);
  await fs.writeFile(path.join(sourcePath, 'template.config.json'), JSON.stringify(configContent, null, 2), 'utf-8');
  console.log('[Lovable Converter] Generated template.config.json');
}

/**
 * Generate index.tsx content
 */
function generateIndexFile(components: string[]): string {
  // Exclude Header, Footer, and Navigation from homepage rendering (they're handled by layout)
  const homePageComponents = components.filter(c => !['Header', 'Footer', 'Navigation'].includes(c));
  
  const imports = homePageComponents.map(c => `import ${c} from './components/${c}';`).join('\n');
  const componentRenders = homePageComponents.map(c => `      <${c} />`).join('\n');

  return `import { Tenant } from '@prisma/client';
${imports}
import './styles.css';

interface TemplateProps {
  tenant: Tenant;
  consultationUrl: string;
  productsUrl: string;
  contactUrl: string;
  heroImageUrl?: string | null;
  logoUrl?: string | null;
}

export default function LovableTemplate({
  tenant,
  consultationUrl,
  productsUrl,
  contactUrl,
  heroImageUrl,
  logoUrl
}: TemplateProps) {
  const settings = tenant.settings as any;
  
  return (
    <div style={{ 
      fontFamily: 'var(--tenant-font-base)',
      backgroundColor: 'var(--tenant-color-background)',
      color: 'var(--tenant-color-text)'
    }}>
${componentRenders}
    </div>
  );
}
`;
}

/**
 * Generate defaults.json by extracting colors from index.css
 */
async function generateDefaultsFile(sourcePath: string): Promise<any> {
  // Try to extract colors from CSS
  let primaryColor = '#10b981'; // Default emerald
  let secondaryColor = '#0ea5e9'; // Default sky
  
  try {
    const cssPath = path.join(sourcePath, 'src', 'index.css');
    const cssContent = await fs.readFile(cssPath, 'utf-8');
    
    // Try to extract CSS variables
    const primaryMatch = cssContent.match(/--primary[^:]*:\s*([^;]+);/);
    if (primaryMatch) {
      primaryColor = primaryMatch[1].trim();
    }
  } catch (error) {
    console.warn('[Lovable Converter] Could not extract colors from CSS');
  }

  return {
    template: 'lovable-converted',
    logoPath: null,
    heroImagePath: null,
    primaryColor,
    fontFamily: 'Inter, system-ui, sans-serif',
    designSystem: {
      colors: {
        primary: primaryColor,
        secondary: secondaryColor,
        accent: '#8b5cf6',
        background: '#ffffff',
        surface: '#f9fafb',
        text: '#1f2937',
        heading: '#111827',
        border: '#e5e7eb',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6'
      },
      typography: {
        fontFamily: {
          base: 'Inter, system-ui, sans-serif',
          heading: 'Inter, system-ui, sans-serif',
          mono: 'JetBrains Mono, monospace'
        },
        fontSize: {
          xs: '0.75rem',
          sm: '0.875rem',
          base: '1rem',
          lg: '1.125rem',
          xl: '1.25rem',
          '2xl': '1.5rem',
          '3xl': '1.875rem',
          '4xl': '2.25rem',
          '5xl': '3rem',
          '6xl': '3.75rem'
        }
      }
    },
    pageContent: {
      homeHeroTitle: 'Welcome to {businessName}',
      homeHeroSubtitle: 'Your trusted partner in medical cannabis'
    }
  };
}

/**
 * Generate template.config.json
 */
function generateTemplateConfig(components: string[]): any {
  const timestamp = new Date().toISOString().split('T')[0];
  
  return {
    id: `lovable-template-${Date.now()}`,
    slug: `lovable-template-${Date.now()}`,
    name: 'Lovable Template (Converted)',
    description: 'A template converted from Lovable.dev structure',
    version: '1.0.0',
    author: 'Lovable.dev',
    category: 'modern',
    tags: ['lovable', 'converted', 'modern'],
    features: [
      'Converted from Lovable.dev',
      'Responsive design',
      'Modern UI components'
    ],
    previewUrl: '',
    thumbnailUrl: '',
    screenshots: [],
    components: components.map(name => ({
      name,
      path: `components/${name}.tsx`,
      required: true
    })),
    customization: {
      colors: {
        primary: '#10b981',
        secondary: '#0ea5e9',
        accent: '#8b5cf6'
      },
      fonts: {
        base: 'Inter, system-ui, sans-serif',
        heading: 'Inter, system-ui, sans-serif'
      }
    },
    compatibility: {
      nextjs: '14.x',
      react: '18.x'
    },
    dependencies: [
      'framer-motion',
      'lucide-react'
    ]
  };
}

/**
 * Refactor components to be BudStack-compliant
 */
async function refactorComponents(sourcePath: string): Promise<void> {
  const componentsDir = path.join(sourcePath, 'components');
  
  try {
    const files = await fs.readdir(componentsDir);
    
    for (const file of files) {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        const filePath = path.join(componentsDir, file);
        
        // Special handling for Header and Footer
        if (file === 'Header.tsx') {
          await refactorHeaderComponent(filePath);
        } else if (file === 'Footer.tsx') {
          await refactorFooterComponent(filePath);
        } else {
          await refactorComponentFile(filePath);
        }
      }
    }

    // Also refactor index.tsx
    const indexPath = path.join(sourcePath, 'index.tsx');
    await refactorComponentFile(indexPath);
  } catch (error) {
    console.error('[Lovable Converter] Error refactoring components:', error);
  }
}

/**
 * Refactor a single component file
 */
async function refactorComponentFile(filePath: string): Promise<void> {
  let content = await fs.readFile(filePath, 'utf-8');
  
  // Add 'use client' if it uses hooks or events
  if (!content.includes("'use client'") && 
      (content.includes('useState') || content.includes('useEffect') || 
       content.includes('onClick') || content.includes('onChange'))) {
    content = "'use client'\n\n" + content;
  }

  // Replace React Router imports with Next.js
  content = content.replace(
    /import \{\s*Link\s*,\s*useLocation\s*\} from ["']react-router-dom["'];?/g,
    "import Link from 'next/link';\nimport { usePathname } from 'next/navigation';"
  );
  content = content.replace(
    /import \{([^}]+)\} from ["']react-router-dom["'];?/g,
    (match, imports) => {
      if (imports.includes('Link')) {
        return "import Link from 'next/link';";
      }
      return ''; // Remove other react-router imports
    }
  );

  // Replace <Link to="..."> with <Link href="...">
  content = content.replace(/<Link\b([^>]*?)\s+to=/g, '<Link$1 href=');

  // Replace @/ imports with relative paths for local components
  content = content.replace(
    /from ["']@\/components\/ui\/([^"']+)["']/g,
    'from "@/components/ui/$1"'
  );

  // Save the refactored content
  await fs.writeFile(filePath, content, 'utf-8');
  console.log(`[Lovable Converter] Refactored: ${path.basename(filePath)}`);
}

/**
 * Refactor Header component to BudStack Navigation format
 */
async function refactorHeaderComponent(filePath: string): Promise<void> {
  let content = await fs.readFile(filePath, 'utf-8');
  
  // Add 'use client' at the top
  if (!content.includes("'use client'")) {
    content = "'use client'\n\n" + content;
  }

  content = content.replace(
    /import \{ Link, useLocation \} from ["']react-router-dom["'];?/g,
    "import Link from 'next/link';\nimport { usePathname } from 'next/navigation';"
  );
  content = content.replace(
    /import \{[^}]*\} from ["']react-router-dom["'];?/g,
    ''
  );

  // Replace useLocation with usePathname
  content = content.replace(/const location = useLocation\(\);/g, 'const pathname = usePathname();');
  content = content.replace(/location\.pathname/g, 'pathname');

  // Replace <Link to="..."> with <Link href="...">
  content = content.replace(/<Link\b([^>]*?)\s+to=/g, '<Link$1 href=');

  // Remove asset imports (will be replaced with placeholder)
  content = content.replace(/import \w+ from ["']@\/assets\/[^"']+["'];?/g, '');

  // Remove unsupported component imports
  content = content.replace(/import EligibilityDialog from ["'][^"']+["'];?/g, '');
  content = content.replace(/<EligibilityDialog[^>]*>/g, '');
  content = content.replace(/<\/EligibilityDialog>/g, '');

  // Replace cn utility import
  content = content.replace(
    /import \{ cn \} from ["']@\/lib\/utils["']/g,
    "import { cn } from '@/lib/utils'"
  );

  // Replace logo image with placeholder or dynamic logo
  content = content.replace(
    /<img\s+src=\{[^}]+\}\s+alt=["'][^"']*Logo[^"']*["'][^>]*>/g,
    `<div className="text-white font-bold text-xl">HB</div>`
  );

  // Rename component from Header to Navigation
  content = content.replace(/const Header = /g, 'const Navigation = ');
  content = content.replace(/export default Header;/g, 'export default Navigation;');

  // Save the refactored content
  await fs.writeFile(filePath.replace('Header.tsx', 'Navigation.tsx'), content, 'utf-8');
  
  // Remove old Header.tsx
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.warn('[Lovable Converter] Could not remove old Header.tsx:', error);
  }
  
  console.log('[Lovable Converter] Converted Header → Navigation');
}

/**
 * Refactor Footer component to BudStack format
 */
async function refactorFooterComponent(filePath: string): Promise<void> {
  let content = await fs.readFile(filePath, 'utf-8');
  
  // Add 'use client' at the top (Footer might have state/effects)
  if (!content.includes("'use client'") && 
      (content.includes('useState') || content.includes('useEffect') || 
       content.includes('onClick') || content.includes('new Date()'))) {
    content = "'use client'\n\n" + content;
  }

  // Replace React Router imports
  content = content.replace(
    /import \{ Link \} from ["']react-router-dom["'];?/g,
    "import Link from 'next/link';"
  );

  // Replace <Link to="..."> with <Link href="...">
  content = content.replace(/<Link\b([^>]*?)\s+to=/g, '<Link$1 href=');

  // Remove asset imports
  content = content.replace(/import \w+ from ["']@\/assets\/[^"']+["'];?/g, '');

  // Replace logo image with placeholder or text
  content = content.replace(
    /<img\s+src=\{[^}]+\}\s+alt=["'][^"']*Logo[^"']*["'][^>]*>/g,
    `<div className="text-white font-bold text-lg">Healing Buds</div>`
  );

  // Save the refactored content
  await fs.writeFile(filePath, content, 'utf-8');
  console.log('[Lovable Converter] Refactored Footer');
}
