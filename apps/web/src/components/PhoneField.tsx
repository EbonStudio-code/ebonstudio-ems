import { useEffect, useId, useRef, useState } from 'react';
import { PHONE_HINT, phoneValidationError } from '../core/phone';

export default function PhoneField({ defaultValue = '', wide = false }: { defaultValue?: string; wide?: boolean }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState(() => phoneValidationError(defaultValue));
  useEffect(() => {
    if (input.current) {
      const message = phoneValidationError(input.current.value);
      input.current.setCustomValidity(message);
      setError(message);
    }
  }, [defaultValue]);

  return <div className={`field${wide ? ' full' : ''}`}>
    <label htmlFor={id} className="field-label">Phone number (optional)</label>
    <input ref={input} id={id} name="phone" type="tel" inputMode="tel" maxLength={32} defaultValue={defaultValue}
      aria-invalid={Boolean(error)} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
      onChange={event => {
        const message = phoneValidationError(event.currentTarget.value);
        event.currentTarget.setCustomValidity(message);
        setError(message);
      }}
      onInvalid={event => setError(phoneValidationError(event.currentTarget.value))} />
    <small id={`${id}-hint`}>{PHONE_HINT}</small>
    {error && <div id={`${id}-error`} className="field-error" role="alert">{error}</div>}
  </div>;
}
