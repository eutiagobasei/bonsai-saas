-- Initial Database Setup Script
-- This runs when PostgreSQL container is first created

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create function to auto-create tenant schema
CREATE OR REPLACE FUNCTION create_tenant_schema(schema_name TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
-- The application will handle schema creation through Prisma
