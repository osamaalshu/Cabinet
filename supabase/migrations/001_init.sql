-- 1. Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  timezone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Cabinet members table
CREATE TABLE IF NOT EXISTS public.cabinet_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  model_provider TEXT NOT NULL DEFAULT 'openai',
  model_name TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  temperature FLOAT NOT NULL DEFAULT 0.7,
  is_enabled BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Briefs table
CREATE TABLE IF NOT EXISTS public.briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  input_context JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. Brief responses table
CREATE TABLE IF NOT EXISTS public.brief_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID REFERENCES public.briefs ON DELETE CASCADE NOT NULL,
  cabinet_member_id UUID REFERENCES public.cabinet_members ON DELETE CASCADE NOT NULL,
  response_text TEXT NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('approve', 'abstain', 'oppose')),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. Decisions table
CREATE TABLE IF NOT EXISTS public.decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID REFERENCES public.briefs ON DELETE CASCADE NOT NULL,
  chosen_option TEXT NOT NULL,
  user_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. Audits table
CREATE TABLE IF NOT EXISTS public.audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID REFERENCES public.briefs ON DELETE CASCADE NOT NULL,
  reflection TEXT NOT NULL,
  what_changed TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cabinet_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brief_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can manage their cabinet members" ON public.cabinet_members FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their briefs" ON public.briefs FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view responses to their briefs" ON public.brief_responses FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.briefs WHERE id = brief_id AND user_id = auth.uid()));

CREATE POLICY "Users can manage decisions for their briefs" ON public.decisions FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.briefs WHERE id = brief_id AND user_id = auth.uid()));

CREATE POLICY "Users can manage audits for their briefs" ON public.audits FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.briefs WHERE id = brief_id AND user_id = auth.uid()));

