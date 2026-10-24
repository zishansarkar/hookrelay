import { useCallback, useState, type ChangeEvent, type FormEvent } from 'react';

export type FormValues = Record<string, string>;
export type FormErrors<T extends FormValues> = Partial<Record<keyof T, string>>;
export type FieldValidator<T extends FormValues> = (value: string, values: T) => string | undefined;
export type FormValidators<T extends FormValues> = Partial<Record<keyof T, FieldValidator<T>>>;

export interface UseFormOptions<T extends FormValues> {
  initialValues: T;
  validators?: FormValidators<T>;
}

export interface UseFormResult<T extends FormValues> {
  values: T;
  errors: FormErrors<T>;
  isSubmitting: boolean;
  handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ): void;
  handleSubmit(
    onValid: (values: T) => Promise<void> | void,
  ): (event: FormEvent<HTMLFormElement>) => void;
  setFieldError(field: keyof T, message: string): void;
  resetForm(): void;
}

export function useForm<T extends FormValues>({
  initialValues,
  validators = {},
}: UseFormOptions<T>): UseFormResult<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<FormErrors<T>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateField = useCallback(
    (field: keyof T, value: string, currentValues: T): string | undefined =>
      validators[field]?.(value, currentValues),
    [validators],
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const field = event.currentTarget.name as keyof T;
      if (!(field in initialValues)) return;
      const value = event.currentTarget.value;
      setValues((current) => {
        const next = { ...current, [field]: value };
        if (field in errors) {
          setErrors((currentErrors) => ({
            ...currentErrors,
            [field]: validateField(field, value, next),
          }));
        }
        return next;
      });
    },
    [errors, initialValues, validateField],
  );

  const setFieldError = useCallback((field: keyof T, message: string) => {
    setErrors((current) => ({ ...current, [field]: message }));
  }, []);

  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setIsSubmitting(false);
  }, [initialValues]);

  const handleSubmit = useCallback(
    (onValid: (values: T) => Promise<void> | void) => (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const nextErrors: FormErrors<T> = {};
      for (const field of Object.keys(initialValues) as (keyof T)[]) {
        const message = validateField(field, values[field] ?? '', values);
        if (message) nextErrors[field] = message;
      }
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) return;

      setIsSubmitting(true);
      void Promise.resolve(onValid(values)).finally(() => setIsSubmitting(false));
    },
    [initialValues, validateField, values],
  );

  return { values, errors, isSubmitting, handleChange, handleSubmit, setFieldError, resetForm };
}
