import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from '@/components/modules/auth/LoginPage'
import { AdminDashboard } from '@/components/modules/dashboard/AdminDashboard'
import { UsersPage } from '@/modules/admin/UsersPage'
import { PeriodsPage } from '@/modules/admin/PeriodsPage'
import { GroupsPage } from '@/modules/admin/GroupsPage'
import { EnrollmentPage } from '@/modules/academic/EnrollmentPage'
import { LessonManager } from '@/modules/academic/LessonManager'
import { Gradebook } from '@/modules/academic/Gradebook'
import { GroupStats } from '@/modules/academic/GroupStats'
import { StudentDashboard } from '@/modules/student/StudentDashboard'
import { TakeExam } from '@/modules/student/TakeExam'
import { MyProgress } from '@/modules/student/MyProgress'
import { OrganizationsPage } from '@/modules/superadmin/OrganizationsPage'
import { AssignmentsPage } from '@/modules/assignments/AssignmentsPage'
import { ForumPage } from '@/modules/forum/ForumPage'
import { ChatPage } from '@/modules/chat/ChatPage'
import { Toaster } from 'react-hot-toast'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/organizations" element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <OrganizationsPage />
          </ProtectedRoute>
        } />
        <Route path="/users" element={
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <UsersPage />
          </ProtectedRoute>
        } />
        <Route path="/periods" element={
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <PeriodsPage />
          </ProtectedRoute>
        } />
        <Route path="/groups" element={
          <ProtectedRoute allowedRoles={['teacher', 'admin', 'super_admin']}>
            <GroupsPage />
          </ProtectedRoute>
        } />
        <Route path="/enrollments" element={
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <EnrollmentPage />
          </ProtectedRoute>
        } />
        <Route path="/lessons" element={
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <LessonManager />
          </ProtectedRoute>
        } />
        <Route path="/gradebook" element={
          <ProtectedRoute allowedRoles={['teacher', 'admin', 'super_admin']}>
            <Gradebook />
          </ProtectedRoute>
        } />
        <Route path="/group-stats" element={
          <ProtectedRoute allowedRoles={['teacher', 'admin', 'super_admin']}>
            <GroupStats />
          </ProtectedRoute>
        } />
        <Route path="/my-courses" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentDashboard />
          </ProtectedRoute>
        } />
        <Route path="/exams" element={
          <ProtectedRoute allowedRoles={['student', 'teacher', 'admin', 'super_admin']}>
            <TakeExam />
          </ProtectedRoute>
        } />
        <Route path="/my-progress" element={
          <ProtectedRoute allowedRoles={['student']}>
            <MyProgress />
          </ProtectedRoute>
        } />
        <Route path="/assignments" element={
          <ProtectedRoute allowedRoles={['student', 'teacher', 'admin', 'super_admin']}>
            <AssignmentsPage />
          </ProtectedRoute>
        } />
        <Route path="/assignments/:assignmentId" element={
          <ProtectedRoute allowedRoles={['student', 'teacher', 'admin', 'super_admin']}>
            <AssignmentsPage />
          </ProtectedRoute>
        } />
        <Route path="/forum" element={
          <ProtectedRoute allowedRoles={['student', 'teacher', 'admin', 'super_admin']}>
            <ForumPage />
          </ProtectedRoute>
        } />
        <Route path="/forum/:topicId" element={
          <ProtectedRoute allowedRoles={['student', 'teacher', 'admin', 'super_admin']}>
            <ForumPage />
          </ProtectedRoute>
        } />
        <Route path="/chat" element={
          <ProtectedRoute allowedRoles={['student', 'teacher', 'admin', 'super_admin']}>
            <ChatPage />
          </ProtectedRoute>
        } />
        <Route path="/chat/:groupId" element={
          <ProtectedRoute allowedRoles={['student', 'teacher', 'admin', 'super_admin']}>
            <ChatPage />
          </ProtectedRoute>
        } />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}