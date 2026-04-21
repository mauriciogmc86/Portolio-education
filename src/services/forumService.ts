'use client'

import { supabase, type ForumTopic, type ForumPost } from '@/lib/supabase'

export async function getForumTopicsByGroup(groupId: string): Promise<ForumTopic[]> {
  const { data, error } = await supabase
    .from('forums')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as ForumTopic[]
}

export async function getMyForumTopics(organizationId: string): Promise<ForumTopic[]> {
  const { data, error } = await supabase
    .from('forums')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as ForumTopic[]
}

export async function getForumTopic(topicId: string): Promise<ForumTopic | null> {
  const { data, error } = await supabase
    .from('forums')
    .select('*')
    .eq('id', topicId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data as ForumTopic | null
}

export async function getForumPostsByTopic(topicId: string): Promise<ForumPost[]> {
  const { data, error } = await supabase
    .from('forum_replies')
    .select('*')
    .eq('forum_id', topicId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data as ForumPost[]
}

export async function createForumTopic(
  title: string,
  content: string,
  groupId: string,
  organizationId: string,
  authorId: string
): Promise<ForumTopic> {
  const { data, error } = await supabase
    .from('forums')
    .insert({
      title,
      description: content,
      group_id: groupId,
      organization_id: organizationId,
      created_by: authorId,
    })
    .select()
    .single()

  if (error) throw error
  return data as ForumTopic
}

export async function createForumPost(
  topicId: string,
  authorId: string,
  content: string
): Promise<ForumPost> {
  const { data: post, error: postError } = await supabase
    .from('forum_replies')
    .insert({
      forum_id: topicId,
      author_id: authorId,
      content,
    })
    .select()
    .single()

  if (postError) throw postError
  return post as ForumPost
}

export async function togglePinTopic(topicId: string, isPinned: boolean): Promise<ForumTopic> {
  const { data, error } = await supabase
    .from('forums')
    .update({ is_pinned: isPinned })
    .eq('id', topicId)
    .select()
    .single()

  if (error) throw error
  return data as ForumTopic
}

export async function toggleLockTopic(topicId: string, isLocked: boolean): Promise<ForumTopic> {
  const { data, error } = await supabase
    .from('forums')
    .update({ is_locked: isLocked })
    .eq('id', topicId)
    .select()
    .single()

  if (error) throw error
  return data as ForumTopic
}