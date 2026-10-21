"use client";

interface DemoAccount {
  label: string;
  email: string;
}

// Demo-only helper: click an account to fill the (uncontrolled) login form fields.
export function DemoCredentials({
  accounts,
  password,
}: {
  accounts: DemoAccount[];
  password: string;
}) {
  function fill(email: string) {
    const emailInput = document.getElementById("email") as HTMLInputElement | null;
    const passwordInput = document.getElementById("password") as HTMLInputElement | null;
    if (emailInput) emailInput.value = email;
    if (passwordInput) passwordInput.value = password;
  }

  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Demo accounts <span className="font-normal normal-case">(click to fill)</span>
      </p>
      <ul className="space-y-2">
        {accounts.map((a) => (
          <li key={a.email}>
            <button
              type="button"
              onClick={() => fill(a.email)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:border-brand/60 hover:bg-muted/60"
            >
              <span className="block font-medium text-foreground">{a.label}</span>
              <span className="block font-mono text-xs text-muted-foreground">
                {a.email} <span className="px-1">/</span> {password}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
