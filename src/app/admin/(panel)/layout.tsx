import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isAdminLoggedIn } from "@/lib/auth";

type Props = {
  children: ReactNode;
};

export default async function AdminPanelLayout({ children }: Props) {
  const adminLoggedIn = await isAdminLoggedIn();

  if (!adminLoggedIn) {
    redirect("/admin/login");
  }

  return <>{children}</>;
}
