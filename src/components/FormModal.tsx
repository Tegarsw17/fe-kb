// One form component for every add/edit screen. Describe the fields, get a
// modal with labels, validation, number parsing and a save button.

import { useState, type ReactNode, type FormEvent } from 'react';
import { t } from '@kebun/shared';
import { Button, Modal, PhotoInput } from './ui';

export type FieldType = 'text' | 'number' | 'money' | 'date' | 'select' | 'textarea' | 'color' | 'checkbox' | 'photos' | 'password';

export interface Field {
  name: string;
  label: string;
  type?: FieldType;
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  help?: ReactNode;
  half?: boolean;          // two fields per row on wide screens
  step?: string;
  min?: number;
  suffix?: string;
  show?: (values: Record<string, any>) => boolean;  // conditional field
}

export function FormModal({ title, fields, initial = {}, onSubmit, onClose, submitLabel, extra, onChange }: {
  title: ReactNode;
  /** A list of fields, or a function of the current values (for dependent dropdowns). */
  fields: Field[] | ((values: Record<string, any>) => Field[]);
  initial?: Record<string, any>;
  onSubmit: (values: Record<string, any>) => Promise<void> | void;
  onClose: () => void;
  submitLabel?: string;
  extra?: (values: Record<string, any>, patch: (changes: Record<string, any>) => void) => ReactNode;
  /** Lets a form react to edits (e.g. fill a suggested amount). Return changes to apply. */
  onChange?: (name: string, values: Record<string, any>) => Record<string, any> | void;
}) {
  const fieldsFor = (v: Record<string, any>) => (typeof fields === 'function' ? fields(v) : fields);
  const [values, setValues] = useState<Record<string, any>>(() => {
    const v: Record<string, any> = {};
    for (const f of fieldsFor(initial)) v[f.name] = initial[f.name] ?? (f.type === 'checkbox' ? false : f.type === 'photos' ? [] : '');
    return { ...initial, ...v };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (name: string, val: any) => {
    setValues((prev) => {
      const next = { ...prev, [name]: val };
      const extraChanges = onChange?.(name, next);
      return extraChanges ? { ...next, ...extraChanges } : next;
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const out: Record<string, any> = { ...values };
    for (const f of fieldsFor(values)) {
      if (f.show && !f.show(values)) { delete out[f.name]; continue; }
      let v = values[f.name];
      if (f.type === 'number' || f.type === 'money') v = v === '' || v == null ? null : Number(String(v).replace(',', '.'));
      if ((f.type === 'select' || f.type === 'date') && v === '') v = null;
      if (f.required && (v == null || v === '' || (typeof v === 'number' && isNaN(v)))) {
        setError(`${f.label}: ${t('common.required')}`);
        return;
      }
      out[f.name] = v;
    }
    setBusy(true);
    try {
      await onSubmit(out);
      onClose();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" form="kd-form" variant="primary" busy={busy}>{submitLabel ?? t('common.save')}</Button>
        </>
      }
    >
      <form id="kd-form" className="form-grid" onSubmit={submit} noValidate>
        {fieldsFor(values).filter((f) => !f.show || f.show(values)).map((f) => (
          <div key={f.name} className={`field ${f.half ? 'half' : ''} ${f.type === 'checkbox' ? 'field-check' : ''}`}>
            {f.type === 'checkbox' ? (
              <label className="check">
                <input type="checkbox" checked={!!values[f.name]} onChange={(e) => set(f.name, e.target.checked)} />
                <span>{f.label}</span>
              </label>
            ) : (
              <>
                <label htmlFor={`f-${f.name}`}>{f.label}{f.required && <span className="req" aria-hidden> *</span>}</label>
                <FieldInput f={f} value={values[f.name]} onChange={(v) => set(f.name, v)} />
              </>
            )}
            {f.help && <small className="help">{f.help}</small>}
          </div>
        ))}
        {extra?.(values, (changes) => setValues((prev) => ({ ...prev, ...changes })))}
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}

function FieldInput({ f, value, onChange }: { f: Field; value: any; onChange: (v: any) => void }) {
  const id = `f-${f.name}`;
  switch (f.type) {
    case 'textarea':
      return <textarea id={id} rows={3} value={value ?? ''} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />;
    case 'select':
      return (
        <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          {!f.required && <option value="">{t('common.none')}</option>}
          {f.required && (value === '' || value == null) && <option value="">…</option>}
          {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    case 'photos':
      return <PhotoInput value={value ?? []} onChange={onChange} />;
    case 'color':
      return <input id={id} type="color" value={value || '#4f8a3c'} onChange={(e) => onChange(e.target.value)} />;
    case 'number':
    case 'money':
      return (
        <div className="input-suffix">
          {f.type === 'money' && <span className="prefix">Rp</span>}
          <input id={id} type="number" inputMode="decimal" step={f.step ?? 'any'} min={f.min} value={value ?? ''} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />
          {f.suffix && <span className="suffix">{f.suffix}</span>}
        </div>
      );
    default:
      return <input id={id} type={f.type ?? 'text'} value={value ?? ''} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} autoComplete={f.type === 'password' ? 'new-password' : 'off'} />;
  }
}
