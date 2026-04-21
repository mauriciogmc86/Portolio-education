import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Profile = {
  id: string
  email: string
  full_name: string | null
  role: 'super_admin' | 'admin' | 'teacher' | 'student'
  organization_id: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export type Organization = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  banner_url: string | null
  created_at: string
}

export type Group = {
  id: string
  name: string
  organization_id: string
  created_at: string
}

export type AcademicPeriod = {
  id: string
  name: string
  organization_id: string
  start_date: string
  end_date: string
  created_at: string
}



export type GroupMember = {
  id: string
  group_id: string
  profile_id: string
  role: 'student' | 'teacher' | 'assistant'
  created_at: string
}

export type Post = {
  id: string
  title: string
  content: string | null
  file_url: string | null
  file_name: string | null
  file_type: string | null
  group_id: string
  author_id: string
  created_at: string
  updated_at: string
}

export type Exam = {
  id: string
  title: string
  description: string | null
  group_id: string
  organization_id: string
  created_at: string
  time_limit: number | null
  revisable: boolean
}

export type Question = {
  id: string
  exam_id: string
  text: string
  order_index: number
  created_at: string
}

export type QuestionOption = {
  id: string
  question_id: string
  text: string
  is_correct: boolean
  order_index: number
  created_at: string
}

export type ExamAttempt = {
  id: string
  exam_id: string
  student_id: string
  score: number | null
  max_score: number
  started_at: string
  completed_at: string | null
  created_at: string
}

export type GradebookEntry = {
  id: string
  student_id: string
  group_id: string
  exam_id: string | null
  attempt_id: string | null
  grade: number
  weight: number
  created_at: string
  updated_at: string
}

export type Assignment = {
  id: string
  title: string
  description: string | null
  group_id: string
  organization_id: string
  due_date: string | null
  max_grade: number | null
  allow_late_submission: boolean
  created_at: string
  updated_at: string
}

export type Submission = {
  id: string
  assignment_id: string
  student_id: string
  content: string | null
  file_url: string | null
  file_name: string | null
  submitted_at: string | null
  grade: number | null
  feedback: string | null
  created_at: string
  updated_at: string
}

export type ForumTopic = {
  id: string
  title: string
  content: string
  group_id: string
  organization_id: string
  author_id: string
  is_pinned: boolean
  is_locked: boolean
  reply_count: number
  last_reply_at: string | null
  created_at: string
  updated_at: string
}

export type ForumPost = {
  id: string
  topic_id: string
  author_id: string
  content: string
  created_at: string
  updated_at: string
}

export type Message = {
  id: string
  sender_id: string
  receiver_id: string | null
  group_id: string | null
  organization_id: string | null
  content: string
  is_read: boolean
  created_at: string
}