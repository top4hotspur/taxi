import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";
import AdminNav from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) {
    redirect("/");
  }

  return (
    <section className="space-y-6">
      <AdminNav />
      {children}
    </section>
  );
}
