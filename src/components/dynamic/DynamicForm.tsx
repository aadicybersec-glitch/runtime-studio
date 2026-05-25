'use client';

import React, { useCallback, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { EntityDefinition, FieldDefinition } from '@/types';
import logger from '@/lib/logger/logger';
import ComponentFallback from '@/components/fallbacks/ComponentFallback';

interface DynamicFormProps {
  entity: EntityDefinition;
  appId: string;
  onSuccess?: (record: any) => void;
  initialValues?: Record<string, any>;
  title?: string;
}

// Build a Zod schema dynamically from field definitions
function buildFormSchema(fields: FieldDefinition[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    let validator: z.ZodTypeAny;
    switch (field.type) {
      case 'number':
        validator = z.coerce.number();
        break;
      case 'checkbox':
        validator = z.boolean().default(false);
        break;
      case 'tags':
        validator = z.array(z.string()).default([]);
        break;
      case 'email':
        validator = z.string().email('Invalid email address');
        break;
      default:
        validator = z.string();
    }
    if (!field.required) {
      validator = validator.optional();
    } else if (field.type === 'text' || field.type === 'textarea' || field.type === 'email') {
      validator = z.string().min(1, `${field.label || field.name} is required`);
    }
    shape[field.name] = validator;
  }
  return z.object(shape);
}

function renderFieldInput(
  field: FieldDefinition,
  register: any,
  control: any,
  errors: any
) {
  const baseInputClass =
    'w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-md px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400 transition-colors';
  const errorClass = errors[field.name] ? 'border-red-500 focus:ring-red-500' : '';

  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          {...register(field.name)}
          placeholder={field.placeholder}
          rows={4}
          className={`${baseInputClass} ${errorClass} resize-none`}
        />
      );

    case 'select':
      return (
        <select
          {...register(field.name)}
          className={`${baseInputClass} ${errorClass}`}
        >
          <option value="">— Select —</option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );

    case 'checkbox':
      return (
        <div className="flex items-center gap-2 mt-1">
          <input
            type="checkbox"
            {...register(field.name)}
            className="w-4 h-4 rounded border-zinc-600 bg-zinc-900 accent-zinc-400"
          />
          <span className="text-sm text-zinc-400">{field.label || field.name}</span>
        </div>
      );

    case 'radio':
      return (
        <div className="flex flex-col gap-2 mt-1">
          {(field.options || []).map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="radio"
                value={opt}
                {...register(field.name)}
                className="accent-zinc-400"
              />
              {opt}
            </label>
          ))}
        </div>
      );

    case 'date':
      return (
        <input
          type="date"
          {...register(field.name)}
          className={`${baseInputClass} ${errorClass}`}
        />
      );

    case 'password':
      return (
        <input
          type="password"
          {...register(field.name)}
          placeholder={field.placeholder}
          className={`${baseInputClass} ${errorClass}`}
        />
      );

    case 'tags':
      return (
        <Controller
          name={field.name}
          control={control}
          defaultValue={[]}
          render={({ field: controlField }) => (
            <TagInput value={controlField.value} onChange={controlField.onChange} />
          )}
        />
      );

    default:
      return (
        <input
          type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'}
          {...register(field.name, { valueAsNumber: field.type === 'number' })}
          placeholder={field.placeholder}
          className={`${baseInputClass} ${errorClass}`}
        />
      );
  }
}

// Simple tags input component
function TagInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('');
  const tags: string[] = Array.isArray(value) ? value : [];

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
  };

  return (
    <div className="flex flex-wrap gap-1 p-2 bg-zinc-900 border border-zinc-700 rounded-md min-h-10">
      {tags.map((tag) => (
        <span key={tag} className="flex items-center gap-1 bg-zinc-700 text-zinc-100 text-xs px-2 py-1 rounded">
          {tag}
          <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))} className="text-zinc-400 hover:text-red-400">&times;</button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
        onBlur={addTag}
        placeholder="Add tag…"
        className="flex-1 min-w-20 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 outline-none"
      />
    </div>
  );
}

export default function DynamicForm({ entity, appId, onSuccess, initialValues, title }: DynamicFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const fields = entity?.fields || [];
  const formSchema = React.useMemo(() => buildFormSchema(fields), [fields]);
  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues || {},
  });

  const watchedValues = watch();

  // Evaluate conditional visibility
  const isVisible = useCallback(
    (field: FieldDefinition) => {
      if (!field.showIf) return true;
      return watchedValues[field.showIf.field] === field.showIf.equals;
    },
    [watchedValues]
  );

  const onSubmit = async (data: any) => {
    if (!entity?.name) {
      setSubmitError("Cannot submit: Entity schema name could not be resolved.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityName: entity.name, data }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error || 'Submission failed');
        logger.warn('DynamicForm', `Form submission failed: ${json.error}`, { entity: entity.name });
      } else {
        setSubmitSuccess(true);
        reset();
        onSuccess?.(json.record);
        setTimeout(() => setSubmitSuccess(false), 3000);
        logger.info('DynamicForm', `Record created for entity: ${entity.name}`);
      }
    } catch (err: any) {
      setSubmitError('Network error — could not reach the server');
      logger.error('DynamicForm', 'Network error during form submission', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Defensive Guard: prevent rendering if entity metadata hydration failed
  if (!entity || !entity.fields || !Array.isArray(entity.fields)) {
    logger.warn('DynamicForm', 'Entity resolution failed for dynamic form widget');
    return (
      <ComponentFallback
        componentType="form"
        reason="Unable to resolve entity metadata. Verify configured entity bindings."
      />
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
      {title && (
        <h3 className="text-base font-semibold text-zinc-100 mb-5">{title}</h3>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {entity.fields.map((field) => {
          if (!isVisible(field)) return null;
          return (
            <div key={field.name} className="flex flex-col gap-1.5">
              {field.type !== 'checkbox' && (
                <label className="text-sm font-medium text-zinc-300">
                  {field.label || field.name}
                  {field.required && <span className="ml-1 text-red-400">*</span>}
                </label>
              )}
              {renderFieldInput(field, register, control, errors)}
              {errors[field.name] && (
                <p className="text-xs text-red-400">{String((errors[field.name] as any)?.message)}</p>
              )}
            </div>
          );
        })}

        {submitError && (
          <div className="bg-red-950 border border-red-800 text-red-300 text-sm px-4 py-3 rounded-md">
            {submitError}
          </div>
        )}

        {submitSuccess && (
          <div className="bg-emerald-950 border border-emerald-800 text-emerald-300 text-sm px-4 py-3 rounded-md">
            ✓ Record saved successfully
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-zinc-100 text-zinc-900 text-sm font-medium rounded-md hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Saving…' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  );
}
