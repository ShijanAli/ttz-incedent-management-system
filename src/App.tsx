import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { Loader2 } from 'lucide-react';
import AppLayout from '@/components/layout/app-layout';

const Home = lazy(() => import('@/pages/home'));
const LoginPage = lazy(() => import('@/pages/login'));
const RegisterPage = lazy(() => import('@/pages/register'));
const ForgotPasswordPage = lazy(() => import('@/pages/forgot-password'));
const ChangePasswordPage = lazy(() => import('@/pages/change-password'));
const DashboardPage = lazy(() => import('@/pages/dashboard'));
const ProjectsPage = lazy(() => import('@/pages/projects'));
const ProjectDetailPage = lazy(() => import('@/pages/project-detail'));
const IssuesPage = lazy(() => import('@/pages/issues'));
const IssueDetailPage = lazy(() => import('@/pages/issue-detail'));
const GroupsPage = lazy(() => import('@/pages/groups'));
const GroupDetailPage = lazy(() => import('@/pages/group-detail'));
const ActivityPage = lazy(() => import('@/pages/activity'));
const NotificationsPage = lazy(() => import('@/pages/notifications'));
const ReportsPage = lazy(() => import('@/pages/reports'));
const RolesPage = lazy(() => import('@/pages/roles'));
const RoleEditorPage = lazy(() => import('@/pages/role-editor'));
const UsersPage = lazy(() => import('@/pages/users'));
const SettingsPage = lazy(() => import('@/pages/settings'));
const AccessDeniedPage = lazy(() => import('@/pages/unauthorized'));
const NotFound = lazy(() => import('@/pages/not-found'));

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/issues" element={<IssuesPage />} />
          <Route path="/issues/:id" element={<IssueDetailPage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/groups/:id" element={<GroupDetailPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/roles" element={<RolesPage />} />
          <Route path="/roles/new" element={<RoleEditorPage />} />
          <Route path="/roles/:id" element={<RoleEditorPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/unauthorized" element={<AccessDeniedPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
