/**
 * Bonsai SaaS - Centralized Branding Configuration (Backend)
 *
 * This file contains all branding-related constants used in the API.
 * Keep in sync with apps/web/src/config/branding.ts
 */

export const branding = {
  // App Identity
  name: 'Bonsai',
  tagline: 'Grow your business organically',
  description: 'Multi-tenant SaaS platform for modern businesses',

  // API Configuration
  api: {
    title: 'Bonsai API',
    description: 'RESTful API for Bonsai SaaS platform',
    version: '1.1.0',
  },

  // Legal
  legal: {
    company: 'Bonsai Software Ltd.',
  },
} as const;

export type Branding = typeof branding;
