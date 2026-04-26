/**
 * Bonsai SaaS - Centralized Branding Configuration
 *
 * This file contains all branding-related constants used throughout the application.
 * Update values here to rebrand the entire application.
 */

export const branding = {
  // App Identity
  name: 'Bonsai',
  tagline: 'Grow your business organically',
  description: 'Multi-tenant SaaS platform for modern businesses',

  // Logo
  logo: {
    // Initials shown in small logo variants
    initials: 'B',
    // Full logo path (relative to public folder)
    light: '/logo-light.svg',
    dark: '/logo-dark.svg',
    favicon: '/favicon.ico',
  },

  // Theme Colors (matching Tailwind config)
  colors: {
    primary: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e', // Main primary color
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
      950: '#052e16',
    },
    accent: {
      50: '#fefce8',
      100: '#fef9c3',
      200: '#fef08a',
      300: '#fde047',
      400: '#facc15', // Main accent color
      500: '#eab308',
      600: '#ca8a04',
      700: '#a16207',
      800: '#854d0e',
      900: '#713f12',
    },
  },

  // Contact & Social
  contact: {
    email: 'support@bonsai.app',
    website: 'https://bonsai.app',
  },

  social: {
    twitter: 'https://twitter.com/bonsaiapp',
    github: 'https://github.com/bonsai-saas',
    linkedin: 'https://linkedin.com/company/bonsai-saas',
  },

  // Legal
  legal: {
    company: 'Bonsai Software Ltd.',
    copyright: `© ${new Date().getFullYear()} Bonsai Software Ltd. All rights reserved.`,
  },

  // API Configuration
  api: {
    title: 'Bonsai API',
    description: 'RESTful API for Bonsai SaaS platform',
    version: '1.0.0',
  },
} as const;

// Type exports for type-safe usage
export type Branding = typeof branding;
export type BrandingColors = typeof branding.colors;
