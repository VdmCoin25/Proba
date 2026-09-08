import { Navigate, useNavigate } from 'react-router-dom';
import { LogOut, Mail, Shield } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/utils/format';

export function AccountPage() {
  const { user, profile, signOut, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  const initial = (profile?.email ?? user.email ?? '?').slice(0, 1).toUpperCase();

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-ink-dark">
        Личный кабинет
      </h1>

      <div className="mt-6 flex items-center gap-4 rounded-xl2 border border-line p-5 dark:border-line-dark">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-semibold text-white"
          style={{ backgroundColor: profile?.avatar_color ?? '#5B2EFF' }}
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-base font-medium text-ink dark:text-ink-dark">
            <Mail size={15} className="shrink-0 text-ink-soft dark:text-ink-darksoft" />
            {profile?.email ?? user.email}
          </p>
          <p className="mt-1 text-sm text-ink-soft dark:text-ink-darksoft">
            На площадке с {formatDate(user.created_at)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl2 border border-line p-4 text-sm text-ink-soft dark:border-line-dark dark:text-ink-darksoft">
        <Shield size={15} className="shrink-0" />
        Ваши данные защищены — доступ к корзине и избранному есть только у вас.
      </div>

      <Button variant="outline" size="lg" className="mt-6" onClick={handleSignOut}>
        <LogOut size={16} /> Выйти из аккаунта
      </Button>
    </div>
  );
}
