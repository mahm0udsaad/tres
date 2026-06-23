"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { login } from "../actions";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="a-btn a-btn--primary a-btn--block" disabled={pending}>
      {pending ? "جارٍ الدخول…" : "دخول"}
    </button>
  );
}

export default function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <div className="a-field" style={{ margin: 0 }}>
        <input
          name="pin"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          placeholder="• • • • • •"
          className="a-input a-pin"
          aria-label="رمز الدخول"
        />
      </div>
      <p className="a-login-err">{state?.error ?? ""}</p>
      <SubmitBtn />
    </form>
  );
}
