import { useState, FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';

export function AuthPage() {
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/account" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    if (mode === 'signup') {
      const { error: err, needsConfirmation } = await signUp(email, password);
      setLoading(false);
      if (err) {
        setError(err);
        return;
      }
      if (needsConfirmation) {
        setInfo('Мы отправили письмо для подтверждения на вашу почту. Перейдите по ссылке в письме, затем войдите.');
        setMode('signin');
        return;
      }
      navigate('/account');
      return;
    }

    const { error: err } = await signIn(email, password);
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    navigate('/account');
  }

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-ink-dark">
          {mode === 'signin' ? 'Вход в аккаунт' : 'Создать аккаунт'}
        </h1>
        <p className="mt-1.5 text-sm text-ink-soft dark:text-ink-darksoft">
          {mode === 'signin'
            ? 'Войдите, чтобы видеть заказы, избранное и корзину.'
            : 'Регистрация займёт меньше минуты.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink dark:text-ink-dark">Email</span>
            <div className="flex items-center gap-2 rounded-lg border border-line px-3 dark:border-line-dark">
              <Mail size={16} className="text-ink-soft dark:text-ink-darksoft" />
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-11 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft/60 dark:text-ink-dark"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink dark:text-ink-dark">Пароль</span>
            <div className="flex items-center gap-2 rounded-lg border border-line px-3 dark:border-line-dark">
              <Lock size={16} className="text-ink-soft dark:text-ink-darksoft" />
              <input
                required
                minLength={6}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 6 символов"
                className="h-11 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft/60 dark:text-ink-dark"
              />
            </div>
          </label>

          {error && (
            <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{error}</p>
          )}
          {info && (
            <p className="rounded-lg bg-accent/10 px-3 py-2 text-sm text-accent dark:text-accent-dark">
              {info}
            </p>
          )}

          <Button type="submit" size="lg" disabled={loading}>
            {loading ? 'Подождите...' : mode === 'signin' ? 'Войти' : 'Зарегистрироваться'}
            <ArrowRight size={16} />
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-soft dark:text-ink-darksoft">
          {mode === 'signin' ? (
            <>
              Нет аккаунта?{' '}
              <button
                onClick={() => {
                  setMode('signup');
                  setError(null);
                  setInfo(null);
                }}
                className="font-medium text-accent hover:underline dark:text-accent-dark"
              >
                Зарегистрироваться
              </button>
            </>
          ) : (
            <>
              Уже есть аккаунт?{' '}
              <button
                onClick={() => {
                  setMode('signin');
                  setError(null);
                  setInfo(null);
                }}
                className="font-medium text-accent hover:underline dark:text-accent-dark"
              >
                Войти
              </button>
            </>
          )}
        </p>

        <Link
          to="/"
          className="mt-6 block text-center text-sm text-ink-soft hover:text-ink dark:text-ink-darksoft dark:hover:text-ink-dark"
        >
          ← Вернуться на главную
        </Link>
      </div>
    </div>
  );
}
