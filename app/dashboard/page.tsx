import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { TaskBoard } from "@/components/TaskBoard";
async function Dashboard() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <TaskBoard user={user} />;
}
export default function DashboardPage() {
  return <Suspense fallback={<main className="page-loading" role="status">Opening your workspace…</main>}><Dashboard /></Suspense>;
}
