import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { DemoCredentials } from "./demo-credentials";
import { DataPulseMap } from "./data-pulse";
import { hexToHsl } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DEMO_PASSWORD = "Demo123!";
const DEMO_ACCOUNTS = [
  { label: "Admin", email: "admin@demo.local" },
  { label: "Client (Brasserie Labatt)", email: "client@demo.local" },
];

async function fetchPublicSetting(key: string, fallback: string): Promise<string> {
  try {
    const baseUrl = process.env.BACKEND_API_URL ?? "http://localhost:8010";
    const resp = await fetch(`${baseUrl}/auth/settings/public/${key}`, {
      next: { revalidate: 60 },
    });
    if (resp.ok) {
      const data = await resp.json();
      return data.value || fallback;
    }
  } catch {}
  return fallback;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token");
  if (token) redirect("/dashboard");

  const params = await searchParams;
  const hasError = params.error === "invalid_credentials";
  const hasServiceError = params.error === "service_unavailable";
  // Demo-only convenience (seeded accounts from scripts/seed_demo_users.py). Off unless
  // explicitly enabled, so credentials are never shown on a real deployment.
  const showDemoCredentials = process.env.SHOW_DEMO_CREDENTIALS === "true";

  const [footerText, brandColor] = await Promise.all([
    fetchPublicSetting("footer_text", "iSN Dashboard"),
    fetchPublicSetting("brand_color", "#16a34a"),
  ]);

  const brandOverride =
    brandColor !== "#16a34a"
      ? `:root { --brand: ${hexToHsl(brandColor)}; --primary: ${hexToHsl(brandColor)}; } .dark { --brand: ${hexToHsl(brandColor)}; --primary: ${hexToHsl(brandColor)}; }`
      : null;

  return (
    <div className="flex min-h-screen bg-background">
      {brandOverride && (
        <style dangerouslySetInnerHTML={{ __html: brandOverride }} />
      )}

      {/* LEFT PANEL — map */}
      <div className="hidden flex-[1.35] flex-col px-12 pb-8 pt-10 md:flex">
        <div className="flex items-center gap-3.5">
          {/* White chip so the navy logo stays readable on the dark theme too. */}
          <span className="inline-flex items-center rounded-xl bg-white px-3 py-1.5 shadow-sm ring-1 ring-black/5">
            <Image src="/logo.png" alt={footerText} width={250} height={96} priority className="h-9 w-auto" />
          </span>
        </div>

        <div className="relative my-5 min-h-0 flex-1">
          <DataPulseMap />
        </div>

        <div>
          <p className="text-[34px] font-bold leading-tight tracking-tight text-foreground">
            Real-time unified retail execution
          </p>
          <p className="mt-2.5 text-base text-muted-foreground">
            Monitor mystery shopping visits across regions in real time.
          </p>
        </div>

        <div className="mt-6 text-sm text-muted-foreground/60">
          &copy; {new Date().getFullYear()} {footerText}
        </div>
      </div>

      {/* RIGHT PANEL — form */}
      <div className="flex flex-1 items-center justify-center p-6 md:px-[72px]">
        <div className="w-full max-w-[540px] space-y-6">
          <div className="flex items-center justify-center gap-3 md:hidden">
            <span className="inline-flex items-center rounded-xl bg-white px-3 py-1.5 shadow-sm ring-1 ring-black/5">
              <Image src="/logo.png" alt={footerText} width={250} height={96} priority className="h-8 w-auto" />
            </span>
          </div>

          <div className="space-y-2 text-center">
            <h1 className="text-[30px] font-bold tracking-tight text-foreground">Sign in</h1>
            <p className="text-base text-muted-foreground">
              Use your credentials to access the dashboard.
            </p>
          </div>

          <LoginForm initialError={hasError ? "error" : hasServiceError ? "service_error" : undefined} callbackUrl={params.callbackUrl} />

          {showDemoCredentials && (
            <DemoCredentials accounts={DEMO_ACCOUNTS} password={DEMO_PASSWORD} />
          )}
        </div>
      </div>
    </div>
  );
}
