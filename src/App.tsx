import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { Loader2 } from 'lucide-react';
import AppLayout from '@/components/layout/app-layout';
import { RequirePermission } from '@/components/shared/require-permission';
import PrivacyPolicy from './pages/privacy-policy';

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
const CustomersPage = lazy(() => import('@/pages/customers'));
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
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<RequirePermission permission='dashboard.view'><DashboardPage /></RequirePermission>} />
          <Route path="/projects" element={<RequirePermission permission={['projects.view', 'account.projects.view_all']}><ProjectsPage /></RequirePermission>} />
          <Route path="/projects/:id" element={<RequirePermission permission={['projects.view', 'account.projects.view_all']}><ProjectDetailPage /></RequirePermission>} />
          <Route path="/issues" element={<RequirePermission permission={['issues.view', 'account.projects.view_all']}><IssuesPage /></RequirePermission>} />
          <Route path="/issues/:id" element={<RequirePermission permission={['issues.view', 'account.projects.view_all']}><IssueDetailPage /></RequirePermission>} />
          <Route path="/groups" element={<RequirePermission permission='account.groups.view'><GroupsPage /></RequirePermission>} />
          <Route path="/groups/:id" element={<RequirePermission permission='account.groups.view'><GroupDetailPage /></RequirePermission>} />
          <Route path="/customers" element={<RequirePermission permission='account.customers.view'><CustomersPage /></RequirePermission>} />
          <Route path="/activity" element={<RequirePermission permission='activity.view'><ActivityPage /></RequirePermission>} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/roles" element={<RequirePermission permission='account.roles.view'><RolesPage /></RequirePermission>} />
          <Route path="/roles/new" element={<RequirePermission permission='account.roles.create'><RoleEditorPage /></RequirePermission>} />
          <Route path="/roles/:id" element={<RequirePermission permission='account.roles.edit'><RoleEditorPage /></RequirePermission>} />
          <Route path="/users" element={<RequirePermission permission='account.users.view'><UsersPage /></RequirePermission>} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/unauthorized" element={<AccessDeniedPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
