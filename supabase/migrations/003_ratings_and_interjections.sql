-- Migration: Add ratings and interjection support

-- 1. Add performance tracking columns to cabinet_members
ALTER TABLE public.cabinet_members 
  ADD COLUMN IF NOT EXISTS total_rating_sum INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_rating_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consecutive_low_ratings INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS warnings INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'probation', 'suspended', 'archived')),
  ADD COLUMN IF NOT EXISTS last_rating_date TIMESTAMPTZ;

-- 2. Create minister_ratings table for individual session ratings
CREATE TABLE IF NOT EXISTS public.minister_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_member_id UUID REFERENCES public.cabinet_members(id) ON DELETE CASCADE NOT NULL,
  brief_id UUID REFERENCES public.briefs(id) ON DELETE CASCADE NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  was_helpful BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(cabinet_member_id, brief_id)
);

-- 3. Enable RLS
ALTER TABLE public.minister_ratings ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy for ratings
CREATE POLICY "Users can manage ratings for their ministers" 
  ON public.minister_ratings FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM public.cabinet_members 
    WHERE id = cabinet_member_id AND user_id = auth.uid()
  ));

-- 5. Create minister_performance_log for tracking history
CREATE TABLE IF NOT EXISTS public.minister_performance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_member_id UUID REFERENCES public.cabinet_members(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('warning', 'probation', 'suspended', 'reinstated', 'replaced')),
  reason TEXT,
  old_status TEXT,
  new_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.minister_performance_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view performance logs for their ministers" 
  ON public.minister_performance_log FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM public.cabinet_members 
    WHERE id = cabinet_member_id AND user_id = auth.uid()
  ));

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_minister_ratings_member ON public.minister_ratings(cabinet_member_id);
CREATE INDEX IF NOT EXISTS idx_minister_ratings_brief ON public.minister_ratings(brief_id);
CREATE INDEX IF NOT EXISTS idx_performance_log_member ON public.minister_performance_log(cabinet_member_id);

-- Performance thresholds (stored as comments for reference):
-- Average rating < 2.5 over 5+ sessions = Warning
-- 2 warnings = Probation
-- Average < 2.0 while on Probation = Suspension recommendation
-- 3 consecutive ratings of 1 = Immediate suspension recommendation
