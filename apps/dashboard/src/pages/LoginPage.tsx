import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { useAuth } from '../contexts/AuthContext.js';
import { useForm, type FormValidators } from '../hooks/useForm.js';

type LoginValues = {
  email: string;
  password: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validators: FormValidators<LoginValues> = {
  email: (value) =>
    !value.trim()
      ? 'Email is required'
      : !emailPattern.test(value.trim().toLowerCase())
        ? 'Enter a valid email address'
        : undefined,
  password: (value) => (!value ? 'Password is required' : undefined),
};

function getApiError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { error?: string } } }).response;
    if (response?.data?.error) return response.data.error;
  }
  return 'Unable to sign in right now. Please try again.';
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [apiError, setApiError] = useState('');
  const form = useForm<LoginValues>({
    initialValues: { email: '', password: '' },
    validators,
  });

  const submit = form.handleSubmit(async ({ email, password }) => {
    setApiError('');
    try {
      await login(email.trim().toLowerCase(), password);
      navigate('/events', { replace: true });
    } catch (error) {
      setApiError(getApiError(error));
    }
  });

  return (
    <div>
      <h1 className="text-xl font-semibold text-white">Welcome back</h1>
      <p className="mt-1 text-sm text-gray-500">Sign in to your HookRelay workspace.</p>
      <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          autoFocus
          value={form.values.email}
          onChange={form.handleChange}
          error={form.errors.email}
          placeholder="you@company.com"
        />
        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          value={form.values.password}
          onChange={form.handleChange}
          error={form.errors.password}
          placeholder="Enter your password"
        />
        {apiError && (
          <p
            role="alert"
            className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          >
            {apiError}
          </p>
        )}
        <Button type="submit" className="w-full" loading={form.isSubmitting}>
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-500">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="font-medium text-blue-400 hover:text-blue-300">
          Sign up
        </Link>
      </p>
    </div>
  );
}
