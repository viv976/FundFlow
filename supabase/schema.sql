-- FundFlow PostgreSQL Schema & Row Level Security (RLS)
-- Comprehensive production-grade schema for financial intelligence

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Profiles Table (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL DEFAULT 'Founder',
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Workspaces Table
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL DEFAULT 'Startup Workspace',
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Workspace Members (Roles: owner, admin, member, viewer)
CREATE TABLE IF NOT EXISTS workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, user_id)
);

-- 5. Transaction Categories
CREATE TABLE IF NOT EXISTS transaction_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category_type VARCHAR(20) NOT NULL DEFAULT 'expense' CHECK (category_type IN ('revenue', 'expense')),
    description TEXT,
    color VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    description TEXT NOT NULL,
    merchant TEXT,
    category TEXT NOT NULL DEFAULT 'Other',
    subcategory TEXT,
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('income', 'expense')),
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'failed', 'reconciled')),
    source VARCHAR(50) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'csv_import', 'plaid_sync')),
    external_reference TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_workspace_date ON transactions(workspace_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(workspace_id, category);

-- 7. Imports
CREATE TABLE IF NOT EXISTS imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    rows_processed INTEGER NOT NULL DEFAULT 0,
    rows_imported INTEGER NOT NULL DEFAULT 0,
    rows_failed INTEGER NOT NULL DEFAULT 0,
    error_details JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 8. Alerts
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'warning', 'info', 'system')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    threshold NUMERIC(15, 2),
    current_value NUMERIC(15, 2),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'dismissed')),
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_workspace_status ON alerts(workspace_id, status);

-- 9. Alert Preferences
CREATE TABLE IF NOT EXISTS alert_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
    runway_threshold_months NUMERIC(4, 1) NOT NULL DEFAULT 6.0,
    expense_spike_percentage NUMERIC(5, 2) NOT NULL DEFAULT 40.0,
    cash_minimum_threshold NUMERIC(15, 2) NOT NULL DEFAULT 50000.0,
    large_transaction_threshold NUMERIC(15, 2) NOT NULL DEFAULT 10000.0,
    email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    slack_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    slack_webhook_url TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Financial Snapshots (Calculated historical metrics for rapid trend analysis)
CREATE TABLE IF NOT EXISTS financial_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    cash NUMERIC(15, 2) NOT NULL,
    monthly_burn NUMERIC(15, 2) NOT NULL,
    runway_months NUMERIC(6, 2),
    revenue NUMERIC(15, 2) NOT NULL DEFAULT 0,
    expenses NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, snapshot_date)
);

-- 11. AI Conversations, Messages & Grounded Citations
CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Financial Inquiry',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_citations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES ai_messages(id) ON DELETE CASCADE,
    citation_type VARCHAR(50) NOT NULL CHECK (citation_type IN ('transaction', 'category_aggregation', 'financial_snapshot', 'alert', 'calculation')),
    reference_id UUID,
    label TEXT NOT NULL,
    amount NUMERIC(15, 2),
    date_range TEXT,
    source_context JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. What-If Scenarios
CREATE TABLE IF NOT EXISTS scenarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    delta_monthly_burn NUMERIC(15, 2) NOT NULL DEFAULT 0,
    delta_monthly_revenue NUMERIC(15, 2) NOT NULL DEFAULT 0,
    baseline_runway NUMERIC(6, 2) NOT NULL,
    projected_runway NUMERIC(6, 2) NOT NULL,
    assumptions JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;

-- Helper function to check workspace access
CREATE OR REPLACE FUNCTION user_has_workspace_access(ws_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_id = ws_id AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles: Users can read/write their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Workspaces: Members and Owners can view; Owners/Admins can mutate
CREATE POLICY "Members and owners can view workspaces" ON workspaces
    FOR SELECT USING (user_has_workspace_access(id) OR owner_id = auth.uid());

CREATE POLICY "Authenticated users can create workspaces" ON workspaces
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners and admins can update workspaces" ON workspaces
    FOR UPDATE USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_id = workspaces.id
              AND user_id = auth.uid()
              AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Owners can delete workspaces" ON workspaces
    FOR DELETE USING (owner_id = auth.uid());

-- Workspace Members
CREATE POLICY "Members can view workspace members" ON workspace_members
    FOR SELECT USING (user_has_workspace_access(workspace_id) OR user_id = auth.uid());

CREATE POLICY "Users can join workspace or owners can add members" ON workspace_members
    FOR INSERT WITH CHECK (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM workspace_members existing
            WHERE existing.workspace_id = workspace_members.workspace_id
              AND existing.user_id = auth.uid()
              AND existing.role IN ('owner', 'admin')
        )
    );

-- Transaction Categories
CREATE POLICY "Members can view categories" ON transaction_categories
    FOR SELECT USING (user_has_workspace_access(workspace_id));

CREATE POLICY "Authorized members can manage categories" ON transaction_categories
    FOR ALL USING (user_has_workspace_access(workspace_id));

-- Transactions: Members can view; Non-viewers can insert/update/delete
CREATE POLICY "Members can view transactions" ON transactions
    FOR SELECT USING (user_has_workspace_access(workspace_id));

CREATE POLICY "Authorized members can mutate transactions" ON transactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_id = transactions.workspace_id
              AND user_id = auth.uid()
              AND role IN ('owner', 'admin', 'member')
        )
    );

-- Alerts RLS
CREATE POLICY "Members can view alerts" ON alerts
    FOR SELECT USING (user_has_workspace_access(workspace_id));

CREATE POLICY "Members can update alert status" ON alerts
    FOR UPDATE USING (user_has_workspace_access(workspace_id));

-- AI Conversations & Citations RLS
CREATE POLICY "Members can view AI conversations" ON ai_conversations
    FOR SELECT USING (user_has_workspace_access(workspace_id));

CREATE POLICY "Members can insert AI messages" ON ai_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM ai_conversations
            WHERE ai_conversations.id = ai_messages.conversation_id
              AND user_has_workspace_access(ai_conversations.workspace_id)
        )
    );
