import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check as CheckIcon, Circle as CircleIcon } from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { useAuth } from '../contexts/AuthContext.js';
import { useForm, type FormValidators } from '../hooks/useForm.js';

type RegisterValues = {
  email: string;
  password: string;
  confirmPassword: string;
  companyName: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validators: FormValidators<RegisterValues> = {
  email: (value) =>
    !value.trim()
      ? 'Email is required'
      : !emailPattern.test(value.trim().toLowerCase())
        ? 'Enter a valid email address'
        : undefined,
  password: (value) => {
    if (value.length < 8) return 'Password must be at least 8 characters long';
    if (!/[A-Z]/.test(value)) return 'Password must contain an uppercase letter';
    if (!/[a-z]/.test(value)) return 'Password must contain a lowercase letter';
    if (!/[0-9]/.test(value)) return 'Password must contain a digit';
    return undefined;
  },
  confirmPassword: (value, values) =>
    !value
      ? 'Please confirm your password'
      : value !== values.password
        ? 'Passwords do not match'
        : undefined,
  companyName: (value) =>
    value.trim().length > 100 ? 'Company name must be 100 characters or fewer' : undefined,
};

const passwordRules = [
  { label: 'At least 8 characters', test: (value: string) => value.length >= 8 },
  { label: 'One uppercase letter', test: (value: string) => /[A-Z]/.test(value) },
  { label: 'One lowercase letter', test: (value: string) => /[a-z]/.test(value) },
  { label: 'One number', test: (value: string) => /[0-9]/.test(value) },
];

function getApiError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { error?: string } } }).response;
    if (response?.data?.error) return response.data.error;
  }
  return 'Unable to create your account right now. Please try again.';
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [apiError, setApiError] = useState('');
  const form = useForm<RegisterValues>({
    initialValues: { email: '', password: '', confirmPassword: '', companyName: '' },
    validators,
  });
  const passedRules = passwordRules.filter((rule) => rule.test(form.values.password)).length;
  const strength = passedRules === 4 ? 'strong' : passedRules >= 2 ? 'medium' : 'weak';
  const strengthColor =
    strength === 'strong' ? 'bg-green-500' : strength === 'medium' ? 'bg-amber-500' : 'bg-red-500';
  const strengthText =
    strength === 'strong' ? 'Strong' : strength === 'medium' ? 'Getting there' : 'Weak';

  const submit = form.handleSubmit(async ({ email, password, companyName }) => {
    setApiError('');
    try {
      await register(email.trim().toLowerCase(), password, companyName.trim() || undefined);
      navigate('/events', { replace: true });
    } catch (error) {
      setApiError(getApiError(error));
    }
  });

  return (
    <div>
      <h1 className="text-xl font-semibold text-white">Create your account</h1>
      <p className="mt-1 text-sm text-gray-500">Start delivering webhooks with confidence.</p>
      <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
        <Input
          label="Work email"
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
          label="Company name"
          name="companyName"
          autoComplete="organization"
          maxLength={100}
          value={form.values.companyName}
          onChange={form.handleChange}
          error={form.errors.companyName}
          placeholder="Acme Inc. (optional)"
        />
        <div className="space-y-2">
          <Input
            label="Password"
            type="password"
            name="password"
            autoComplete="new-password"
            value={form.values.password}
            onChange={form.handleChange}
            error={form.errors.password}
            placeholder="Create a strong password"
          />
          <div aria-live="polite" className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-800">
                <div
                  className={`h-full rounded-full transition-all ${strengthColor}`}
                  style={{ width: `${(passedRules / passwordRules.length) * 100}%` }}
                />
              </div>
              <span
                className={`w-24 text-right text-xs ${
                  strength === 'strong'
                    ? 'text-green-400'
                    : strength === 'medium'
                      ? 'text-amber-400'
                      : 'text-gray-500'
                }`}
              >
                {form.values.password ? strengthText : 'Password strength'}
              </span>
            </div>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
              {passwordRules.map((rule) => {
                const passed = rule.test(form.values.password);
                const Icon = passed ? CheckIcon : CircleIcon;
                return (
                  <li
                    key={rule.label}
                    className={`flex items-center gap-1.5 text-xs ${
                      passed ? 'text-green-400' : 'text-gray-500'
                    }`}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    {rule.label}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <Input
          label="Confirm password"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          value={form.values.confirmPassword}
          onChange={form.handleChange}
          error={form.errors.confirmPassword}
          placeholder="Enter your password again"
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
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-blue-400 hover:text-blue-300">
          Sign in
        </Link>
      </p>
    </div>
  );
}
