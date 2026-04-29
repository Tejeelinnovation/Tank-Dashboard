-- Performance Optimization Indexes for Tank Dashboard

-- Speed up company lookups by slug (used in most dashboard/setup routes)
CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);

-- Speed up admin lookups by login ID
CREATE INDEX IF NOT EXISTS idx_companies_login_id ON companies(company_login_id);

-- Speed up ordering by created_at (used in dashboard lists)
CREATE INDEX IF NOT EXISTS idx_companies_created_at ON companies(created_at DESC);

-- Analyze to update statistics
ANALYZE companies;
