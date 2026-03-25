import { redirect } from "next/navigation";

import { LoginForm } from "../../components/auth/login-form";
import { getDefaultAdminRoute, getSessionUser } from "../../lib/admin-session";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) {
    redirect(getDefaultAdminRoute(user));
  }

  return (
    <main className="min-h-screen bg-[#edf1f7] px-4 py-8 text-[#152033] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <LoginForm />
      </div>
    </main>
  );
}
