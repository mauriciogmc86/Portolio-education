'use client'

import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type Conversation = {
  id: string
  organization_id: string | null
  type: 'direct' | 'group'
  name: string | null
  avatar_url: string | null
  last_message_at: string | null
  created_at: string
  other_participant?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  }
  last_read_at?: string | null
}

export type ConversationParticipant = {
  id: string
  conversation_id: string
  profile_id: string
  joined_at: string
  last_read_at: string | null
  is_active: boolean
  is_admin: boolean
}

export type ChatMessage = {
  id: string
  conversation_id: string
  sender_id: string
  sender_full_name?: string | null
  content: string
  message_type: string
  file_url: string | null
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  thumbnail_url: string | null
  reply_to_id: string | null
  is_edited: boolean
  edited_at: string | null
  deleted_at: string | null
  created_at: string
}

export async function getMyConversations(userId: string, organizationId?: string): Promise<Conversation[]> {
  const { data: participants, error: error1 } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('profile_id', userId)

  if (error1) throw error1
  
  if (!participants || participants.length === 0) return []

  const participantMap = new Map(participants.map(p => [p.conversation_id, p.last_read_at]))
  const conversationIds = participants.map(p => p.conversation_id)
  
  let query = supabase
    .from('conversations')
    .select('*')
    .in('id', conversationIds)

  if (organizationId) {
    query = query.eq('organization_id', organizationId)
  }

  const { data: conversations, error } = await query.order('last_message_at', { ascending: false, nullsFirst: false })

  if (error) throw error

  const conversationsWithParticipants: Conversation[] = []
  
  for (const conv of (conversations || []) as Conversation[]) {
    const { data: otherParticipants, error: errOther } = await supabase
      .from('conversation_participants')
      .select('profile_id')
      .eq('conversation_id', conv.id)
      .neq('profile_id', userId)
      .limit(1)

    if (errOther || !otherParticipants || otherParticipants.length === 0) {
      conversationsWithParticipants.push({ ...conv, last_read_at: participantMap.get(conv.id) || null })
      continue
    }

    const otherParticipantId = otherParticipants[0].profile_id
    const { data: otherProfile } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('id', otherParticipantId)
      .single()

    conversationsWithParticipants.push({
      ...conv,
      other_participant: otherProfile || undefined,
      last_read_at: participantMap.get(conv.id) || null
    })
  }

  return conversationsWithParticipants
}

export async function getConversationMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) throw error

  const messages = data as ChatMessage[]
  if (!messages || messages.length === 0) return []

  const senderIds = [...new Set(messages.map(m => m.sender_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', senderIds)

  const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name]))

  return messages.map(m => ({
    ...m,
    sender_full_name: profileMap.get(m.sender_id) || null
  }))
}

export async function getOrCreateDirectConversation(
  userId1: string,
  userId2: string,
  organizationId: string
): Promise<Conversation> {
  console.log('[Chat] getOrCreateDirectConversation - userId1:', userId1, 'userId2:', userId2, 'organizationId:', organizationId)

  if (!organizationId) {
    throw new Error('organizationId es requerido y no puede estar vacío')
  }

  // Validar que organizationId es UUID válido
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(organizationId)) {
    console.error('[Chat] organizationId no es UUID válido:', organizationId)
    throw new Error('organizationId debe ser un UUID válido')
  }

  // Buscar conversación directa existente entre los usuarios
  const { data: participants1, error: err1 } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('profile_id', userId1)

  console.log('[Chat] participants1:', participants1, 'error:', err1)

  if (err1) {
    console.error('[Chat] Error buscando participantes1:', err1)
    throw err1
  }

  if (participants1 && participants1.length > 0) {
    const convIds1 = participants1.map(p => p.conversation_id)
    
    const { data: participants2, error: err2 } = await supabase
      .from('conversation_participants')
      .select('conversation_id, profile_id')
      .eq('profile_id', userId2)
      .in('conversation_id', convIds1)

    console.log('[Chat] participants2:', participants2, 'error:', err2)

    if (err2) {
      console.error('[Chat] Error buscando participantes2:', err2)
      throw err2
    }

    if (participants2 && participants2.length > 0) {
      const { data: conversation, error: err3 } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', participants2[0].conversation_id)
        .single()
      
      console.log('[Chat] conversation encontrada:', conversation, 'error:', err3)
      return conversation as Conversation
    }
  }

  // Crear nueva conversación
  console.log('[Chat] Creando nueva conversación...')
  const { data: newConversation, error } = await supabase
    .from('conversations')
    .insert({
      organization_id: organizationId,
      type: 'direct'
      // NO incluir created_by - esa columna no existe
    })
    .select()
    .single()

  console.log('[Chat] nuevaConversation:', newConversation, 'error insert:', error)

  if (error) {
    console.error('[Chat] Error al crear conversación:', error)
    throw error
  }

  if (!newConversation) {
    throw new Error('No se pudo crear la conversación')
  }

  // Insertar participantes
  console.log('[Chat] Insertando participantes...')
  const { error: errParticipants } = await supabase.from('conversation_participants').insert([
    { conversation_id: newConversation.id, profile_id: userId1, is_active: true },
    { conversation_id: newConversation.id, profile_id: userId2, is_active: true }
  ])

  console.log('[Chat] error insert participantes:', errParticipants)

  if (errParticipants) {
    console.error('[Chat] Error al insertar participantes:', errParticipants)
    throw errParticipants
  }

  console.log('[Chat] Conversación creada exitosamente')
  return newConversation as Conversation
}

export async function createGroupConversation(
  name: string,
  participantIds: string[],
  organizationId: string,
  createdBy: string
): Promise<Conversation> {
  const { data: conversation, error } = await supabase
    .from('conversations')
    .insert({
      organization_id: organizationId,
      type: 'group',
      name,
      created_by: createdBy
    })
    .select()
    .single()

  if (error) throw error

  const participants = participantIds.map(profileId => ({
    conversation_id: conversation.id,
    profile_id: profileId,
    is_active: true,
    is_admin: profileId === createdBy
  }))

  await supabase.from('conversation_participants').insert(participants)

  return conversation as Conversation
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  messageType: string = 'text'
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      message_type: messageType
    })
    .select()
    .single()

  if (error) throw error

  // Opcional: actualizar last_message_at si la columna existe
  // Commentar si no tienes esta columna en tu tabla
  /*
  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId)
  */

  return data as ChatMessage
}

export async function markAsRead(conversationId: string, profileId: string): Promise<number> {
  const { data: participant } = await supabase
    .from('conversation_participants')
    .select('last_read_at')
    .eq('conversation_id', conversationId)
    .eq('profile_id', profileId)
    .single()

  const { data: messages } = await supabase
    .from('messages')
    .select('id, created_at')
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)

  let unreadCount = 0
  if (messages) {
    if (!participant?.last_read_at) {
      unreadCount = messages.length
    } else {
      unreadCount = messages.filter(m => 
        new Date(m.created_at!) > new Date(participant.last_read_at)
      ).length
    }
  }

  await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('profile_id', profileId)

  return unreadCount
}

export function subscribeToConversation(
  conversationId: string,
  callback: (message: ChatMessage) => void
): RealtimeChannel {
  return supabase
    .channel(`chat:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        callback(payload.new as ChatMessage)
      }
    )
    .subscribe()
}

export function unsubscribe(channel: RealtimeChannel): void {
  supabase.removeChannel(channel)
}

export async function getUnreadMessagesCount(userId: string, organizationId?: string): Promise<number> {
  const { data: participants, error: error1 } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('profile_id', userId)

  if (error1) throw error1
  if (!participants || participants.length === 0) return 0

  let totalUnread = 0

  for (const participant of participants) {
    if (!participant.last_read_at) {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', participant.conversation_id)
        .is('deleted_at', null)

      if (count) totalUnread += count
      continue
    }

    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', participant.conversation_id)
      .gt('created_at', participant.last_read_at)
      .is('deleted_at', null)

    if (count) totalUnread += count
  }

  return totalUnread
}

export function subscribeToAllMessages(
  userId: string,
  callback: (message: ChatMessage & { sender_full_name?: string }) => void
): RealtimeChannel {
  return supabase
    .channel('all-messages')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      },
      async (payload) => {
        const newMessage = payload.new as ChatMessage
        
        const { data: participant } = await supabase
          .from('conversation_participants')
          .select('profile_id')
          .eq('conversation_id', newMessage.conversation_id)
          .eq('profile_id', userId)
          .single()

        if (!participant) return

        const { data: senderProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', newMessage.sender_id)
          .single()

        callback({
          ...newMessage,
          sender_full_name: senderProfile?.full_name || null
        })
      }
    )
    .subscribe()
}