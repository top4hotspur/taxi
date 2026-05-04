import type { ReactNode } from "react";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";
import AdminNav from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentSessionUser();
  const adminEmailConfigured = Boolean(process.env.ADMIN_EMAIL?.trim());
  const isAdmin = isAdminUser(user);

  if (!adminEmailConfigured) {
    return (
      <section className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Admin access is not configured</h1>
        <p className="text-sm text-slate-700">
          Add <code>ADMIN_EMAIL</code> in Amplify environment variables, then redeploy.
        </p>
      </section>
    );
  }

  if (!user || !isAdmin) {
    return (
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Admin access required</h1>
        <p className="text-sm text-slate-700">
          Sign in with the configured admin account to access this area.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <AdminNav />
      {children}
    </section>
  );
}
