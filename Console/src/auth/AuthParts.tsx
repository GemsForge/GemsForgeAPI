import { useState, type InputHTMLAttributes } from "react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { GemLogo } from "@gemsforge/ui";

/** Brand mark shared by the auth cards; the heading already names Gem Life for assistive tech. */
export function AuthBrand() {
  return (
    <div className="sign-in-brand" aria-hidden="true">
      <GemLogo />
    </div>
  );
}

/** Auth errors pair the danger colour with an icon so colour is not the only signal. */
export function AuthError({ message }: { message: string }) {
  return (
    <p className="sign-in-error" role="alert">
      <AlertCircle size={18} aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { id: string; label: string };

/** Password input with a show/hide toggle; the toggle keeps the field's accessible name unchanged. */
export function PasswordField({ id, label, ...input }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="sign-in-field">
      <label htmlFor={id}>{label}</label>
      <div className="sign-in-password">
        <input id={id} type={visible ? "text" : "password"} {...input} />
        <button
          type="button"
          className="sign-in-password-toggle"
          aria-label={`Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          aria-controls={id}
          onClick={() => setVisible((value) => !value)}
          disabled={input.disabled}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
