-- Initial Database Setup Script
-- This runs when PostgreSQL container is first created

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- Tenant Schema Management Functions
-- ============================================

-- Create function to auto-create tenant schema
CREATE OR REPLACE FUNCTION create_tenant_schema(schema_name TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Row-Level Security (RLS) Helper Functions
-- ============================================

-- Function to set current tenant context (for RLS policies)
-- This sets a session variable that RLS policies can reference
CREATE OR REPLACE FUNCTION set_current_tenant(tenant_id TEXT)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', tenant_id, false);
END;
$$ LANGUAGE plpgsql;

-- Function to get current tenant from session context
-- Returns NULL if no tenant context is set
CREATE OR REPLACE FUNCTION get_current_tenant()
RETURNS TEXT AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_tenant_id', true), '');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Schema Cloning Function (Future Use)
-- ============================================

-- Function to clone a schema (useful for template-based tenant creation)
-- Usage: SELECT clone_schema('tenant_template', 'tenant_new_company');
CREATE OR REPLACE FUNCTION clone_schema(
    source_schema TEXT,
    target_schema TEXT
) RETURNS VOID AS $$
DECLARE
    object RECORD;
BEGIN
    -- Create target schema
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', target_schema);

    -- Copy tables (structure only, no data)
    FOR object IN
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = source_schema AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format(
            'CREATE TABLE %I.%I (LIKE %I.%I INCLUDING ALL)',
            target_schema, object.table_name,
            source_schema, object.table_name
        );
    END LOOP;

    -- Copy sequences
    FOR object IN
        SELECT sequence_name FROM information_schema.sequences
        WHERE sequence_schema = source_schema
    LOOP
        EXECUTE format(
            'CREATE SEQUENCE IF NOT EXISTS %I.%I',
            target_schema, object.sequence_name
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
-- The application will handle schema creation through Prisma
