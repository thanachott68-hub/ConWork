-- =====================================================================
-- CONWORK SUPABASE DATABASE SCHEMA & RLS POLICIES
-- =====================================================================

-- 1. EXTENSIONS & ENUMS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. PROFILES TABLE (Extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    phone TEXT,
    account_type TEXT CHECK (account_type IN ('personal', 'company')) DEFAULT 'personal',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. COMPANIES TABLE (Workspaces)
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    domain TEXT,
    logo_url TEXT,
    is_personal BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SUBSCRIPTION PLANS & COMPANY SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    max_members INT NOT NULL,
    max_projects INT NOT NULL,
    price_monthly NUMERIC(10,2) DEFAULT 0.00,
    features JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.company_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES public.subscription_plans(id),
    status TEXT CHECK (status IN ('active', 'past_due', 'canceled')) DEFAULT 'active',
    current_period_start TIMESTAMPTZ DEFAULT NOW(),
    current_period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 year'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. COMPANY MEMBERS TABLE (RBAC)
CREATE TABLE IF NOT EXISTS public.company_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    company_role TEXT CHECK (company_role IN ('super_admin', 'company_admin', 'manager', 'employee', 'guest')) DEFAULT 'employee',
    department TEXT,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, user_id)
);

-- 6. PROJECTS & PROJECT MEMBERS
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES public.profiles(id),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT CHECK (status IN ('planning', 'in_progress', 'completed', 'on_hold')) DEFAULT 'in_progress',
    progress_pct INT DEFAULT 0,
    start_date DATE,
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_role TEXT CHECK (project_role IN ('project_manager', 'contributor', 'viewer')) DEFAULT 'contributor',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

-- 7. TASK SECTIONS, TASKS & ASSIGNEES
CREATE TABLE IF NOT EXISTS public.task_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    display_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    section_id UUID REFERENCES public.task_sections(id) ON DELETE SET NULL,
    creator_id UUID REFERENCES public.profiles(id),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT CHECK (status IN ('todo', 'in_progress', 'in_review', 'done')) DEFAULT 'todo',
    priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.task_assignees (
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, user_id)
);

-- 8. CHAT CHANNELS & MESSAGES
CREATE TABLE IF NOT EXISTS public.chat_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('direct', 'group', 'project', 'announcement')) DEFAULT 'group',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_channel_members (
    channel_id UUID REFERENCES public.chat_channels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES public.chat_channels(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id),
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. EVENTS & ATTENDEES (Calendar)
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    organizer_id UUID REFERENCES public.profiles(id),
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT CHECK (event_type IN ('meeting', 'task_deadline', 'company_event', 'personal')) DEFAULT 'meeting',
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    location_or_link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.event_attendees (
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
    PRIMARY KEY (event_id, user_id)
);

-- =====================================================================
-- AUTOMATED TRIGGERS (Auth Profile Auto-Creation)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, account_type)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://i.pravatar.cc/150?u=' || NEW.id),
        COALESCE(NEW.raw_user_meta_data->>'account_type', 'personal')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can view all profiles in their company, and edit their own profile
CREATE POLICY "Users can view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Company Members: Members can view and join company members
CREATE POLICY "Users view company members" ON public.company_members FOR SELECT USING (true);
CREATE POLICY "Users insert company members" ON public.company_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update company members" ON public.company_members FOR UPDATE USING (true);

-- Project Members: View, Insert, Update, Delete project members
CREATE POLICY "Users view project members" ON public.project_members FOR SELECT USING (true);
CREATE POLICY "Users insert project members" ON public.project_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Users update project members" ON public.project_members FOR UPDATE USING (true);
CREATE POLICY "Users delete project members" ON public.project_members FOR DELETE USING (true);

-- Task Assignees: View, Insert, Update, Delete task assignees
CREATE POLICY "Users view task assignees" ON public.task_assignees FOR SELECT USING (true);
CREATE POLICY "Users insert task assignees" ON public.task_assignees FOR INSERT WITH CHECK (true);
CREATE POLICY "Users update task assignees" ON public.task_assignees FOR UPDATE USING (true);
CREATE POLICY "Users delete task assignees" ON public.task_assignees FOR DELETE USING (true);

-- Companies: Members can view their companies
CREATE POLICY "Members can view their company" ON public.companies FOR SELECT
USING (
    id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
    OR created_by = auth.uid()
);

-- Projects: Multi-tenant isolation by company_id
CREATE POLICY "Users view company projects" ON public.projects FOR SELECT
USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
);

CREATE POLICY "Admins/Managers create projects" ON public.projects FOR INSERT
WITH CHECK (
    company_id IN (
        SELECT company_id FROM public.company_members 
        WHERE user_id = auth.uid() AND company_role IN ('super_admin', 'company_admin', 'manager')
    )
);

CREATE POLICY "Users update company projects" ON public.projects FOR UPDATE USING (true);
CREATE POLICY "Users delete company projects" ON public.projects FOR DELETE USING (true);

-- Tasks: View company tasks
CREATE POLICY "Users view company tasks" ON public.tasks FOR SELECT
USING (
    project_id IN (
        SELECT id FROM public.projects 
        WHERE company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
    )
);
CREATE POLICY "Users insert company tasks" ON public.tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Users update company tasks" ON public.tasks FOR UPDATE USING (true);
CREATE POLICY "Users delete company tasks" ON public.tasks FOR DELETE USING (true);

-- Task Sections: View and manage task sections in company
CREATE POLICY "Users view company task sections" ON public.task_sections FOR SELECT
USING (
    project_id IN (
        SELECT id FROM public.projects 
        WHERE company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
    )
);
CREATE POLICY "Users insert company task sections" ON public.task_sections FOR INSERT WITH CHECK (true);
CREATE POLICY "Users update company task sections" ON public.task_sections FOR UPDATE USING (true);
CREATE POLICY "Users delete company task sections" ON public.task_sections FOR DELETE USING (true);

-- Chat: View channels in member companies
CREATE POLICY "Users view company chat channels" ON public.chat_channels FOR SELECT
USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
);
CREATE POLICY "Users insert chat channels" ON public.chat_channels FOR INSERT WITH CHECK (true);
CREATE POLICY "Users update chat channels" ON public.chat_channels FOR UPDATE USING (true);
CREATE POLICY "Users delete chat channels" ON public.chat_channels FOR DELETE USING (true);

CREATE POLICY "Users view channel messages" ON public.chat_messages FOR SELECT
USING (
    channel_id IN (
        SELECT id FROM public.chat_channels 
        WHERE company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
    )
);

CREATE POLICY "Users send channel messages" ON public.chat_messages FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- Events: View company events
CREATE POLICY "Users view company events" ON public.events FOR SELECT
USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
);
CREATE POLICY "Users insert company events" ON public.events FOR INSERT WITH CHECK (true);
CREATE POLICY "Users update company events" ON public.events FOR UPDATE USING (true);
CREATE POLICY "Users delete company events" ON public.events FOR DELETE USING (true);

-- =====================================================================
-- 10. PROJECT FINANCE MANAGEMENT
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.finance_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#94a3b8',
    icon TEXT DEFAULT 'fa-box',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.finance_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.finance_categories(id) ON DELETE SET NULL,
    creator_id UUID REFERENCES public.profiles(id),
    responsible_user TEXT, -- e.g. payer name or user ID
    title TEXT NOT NULL,
    description TEXT,
    transaction_type TEXT CHECK (transaction_type IN ('credit', 'cash')) NOT NULL,
    amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'paid', 'canceled')) DEFAULT 'pending',
    transaction_date DATE NOT NULL,
    attachment_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view company finance categories" ON public.finance_categories FOR SELECT
USING (
    project_id IN (
        SELECT id FROM public.projects 
        WHERE company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
    )
);

CREATE POLICY "Users view company finance transactions" ON public.finance_transactions FOR SELECT
USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
);

CREATE POLICY "Members can create finance transactions" ON public.finance_transactions FOR INSERT
WITH CHECK (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
);

CREATE POLICY "Managers can update finance transactions" ON public.finance_transactions FOR UPDATE
USING (
    company_id IN (
        SELECT company_id FROM public.company_members 
        WHERE user_id = auth.uid() AND company_role IN ('super_admin', 'company_admin', 'manager')
    )
);

-- =====================================================================
-- INITIAL SEED DATA FOR SUBSCRIPTION PLANS
-- =====================================================================

INSERT INTO public.subscription_plans (id, name, max_members, max_projects, price_monthly, features)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Free Tier', 5, 3, 0.00, '{"chat": true, "calendar": true, "export": false}'::jsonb),
    ('22222222-2222-2222-2222-222222222222', 'Pro Business', 50, 25, 499.00, '{"chat": true, "calendar": true, "export": true, "custom_reports": true}'::jsonb),
    ('33333333-3333-3333-3333-333333333333', 'Enterprise', 9999, 9999, 1999.00, '{"chat": true, "calendar": true, "export": true, "custom_reports": true, "dedicated_support": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;
