-- Migration: Add debate features
-- 1. Add new columns to cabinet_members
ALTER TABLE public.cabinet_members 
  ADD COLUMN IF NOT EXISTS seat_index INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- 2. Create discussion_messages table for full debate transcript
CREATE TABLE IF NOT EXISTS public.discussion_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID REFERENCES public.briefs(id) ON DELETE CASCADE NOT NULL,
  turn_index INT NOT NULL,
  speaker_member_id UUID REFERENCES public.cabinet_members(id) ON DELETE SET NULL,
  speaker_role TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('opening', 'rebuttal', 'cross_exam', 'synthesis', 'vote', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Enable RLS on discussion_messages
ALTER TABLE public.discussion_messages ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy: Users can read/write discussion_messages for their own briefs
CREATE POLICY "Users can view discussion messages for their briefs" 
  ON public.discussion_messages FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.briefs WHERE id = brief_id AND user_id = auth.uid()));

CREATE POLICY "Users can insert discussion messages for their briefs" 
  ON public.discussion_messages FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.briefs WHERE id = brief_id AND user_id = auth.uid()));

-- 5. Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_discussion_messages_brief_id ON public.discussion_messages(brief_id);
CREATE INDEX IF NOT EXISTS idx_discussion_messages_turn ON public.discussion_messages(brief_id, turn_index, created_at);

-- 6. Update brief_responses to allow service role inserts
CREATE POLICY "Service role can insert responses" 
  ON public.brief_responses FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.briefs WHERE id = brief_id AND user_id = auth.uid()));

