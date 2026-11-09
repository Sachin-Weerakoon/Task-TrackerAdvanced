"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "./Brand";
import { TaskCard } from "./TaskCard";
import { DeleteTaskDialog } from "./DeleteTaskDialog";
import { TaskForm, type TaskInput } from "./TaskForm";
import { api } from "@/lib/client-api";
import { statuses, statusLabels, type TaskData, type PublicUser } from "@/lib/validation";
export function TaskBoard({ user }: { user: PublicUser }) {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [loggingOut, setLoggingOut] = useState(false);
  const [editing, setEditing] = useState<TaskData | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [deleting, setDeleting] = useState<TaskData | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const data = await api<{ tasks: TaskData[] }>("/api/tasks"); setTasks(data.tasks); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load tasks"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    api<{ tasks: TaskData[] }>("/api/tasks", { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setTasks(data.tasks); })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Unable to load tasks"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  async function save(data: TaskInput) {
    const existing = editing && editing !== "new" ? editing : null;
    const result = await api<{ task: TaskData }>(existing ? `/api/tasks/${existing.id}` : "/api/tasks", { method: existing ? "PATCH" : "POST", body: JSON.stringify(data) });
    setTasks(prev => existing ? prev.map(t => t.id === existing.id ? result.task : t) : [result.task, ...prev]);
    setNotice(existing ? "Task updated" : "Task created");
  }
  async function mutate(task: TaskData, status?: TaskData["status"]) {
    setBusyIds(prev => new Set(prev).add(task.id)); setError("");
    try {
      if (status) {
        const { task: updated } = await api<{ task: TaskData }>(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
        setTasks(prev => prev.map(t => t.id === task.id ? updated : t)); setNotice(`Task moved to ${statusLabels[status]}`);
      } else {
        await api(`/api/tasks/${task.id}`, { method: "DELETE" }); setTasks(prev => prev.filter(t => t.id !== task.id)); setDeleting(null); setNotice("Task deleted");
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update task"); }
    finally { setBusyIds(prev => { const next = new Set(prev); next.delete(task.id); return next; }); }
  }
  async function logout() {
    setLoggingOut(true); setError("");
    try { await api("/api/auth/logout", { method: "POST" }); router.replace("/login"); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to log out"); setLoggingOut(false); }
  }
  const completed = tasks.filter(t => t.status === "done").length;
  const filtered = tasks.filter(t => `${t.title} ${t.description}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="workspace"><aside className="sidebar"><Brand /><p className="nav-caption">WORKSPACE</p><div className="nav-active"><span aria-hidden="true">▦</span> My board <span className="nav-count">{tasks.length}</span></div><div className="sidebar-tip"><span aria-hidden="true">✦</span><h3>Small steps.<br />Real progress.</h3><p>Make space for what matters. Your next move starts here.</p></div><div className="sidebar-profile"><span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><small>Personal workspace</small></div></div></aside>
    <div className="workspace-main"><header className="topbar"><span>Workspace <span className="slash">/</span> <strong>My board</strong></span><button className="secondary logout" onClick={logout} disabled={loggingOut}>{loggingOut ? "Logging out…" : "Log out ↗"}</button></header>
    <main className="board-content"><div className="board-heading"><div><p className="eyebrow">A LITTLE FOCUS GOES A LONG WAY</p><h1>My task board<span className="brand-dot">.</span></h1><p className="muted">Hi {user.name.split(" ")[0]}, let’s turn your plans into progress.</p></div><button className="primary new-task" disabled={loading} onClick={() => setEditing("new")}>+ <span>New task</span></button></div>
    <section className="stats" aria-label="Task overview"><div><span className="stat-icon total">▦</span><div><small>Total tasks</small><strong>{tasks.length}<span>on your board</span></strong></div></div><div><span className="stat-icon progress">◷</span><div><small>In progress</small><strong>{tasks.filter(t => t.status === "in_progress").length}<span>moving forward</span></strong></div></div><div><span className="stat-icon complete">✓</span><div><small>Completed</small><strong>{completed}<span>nice work!</span></strong></div></div></section>
    <div className="board-toolbar"><h2><span aria-hidden="true">▦</span> Board view</h2><label className="search"><span className="sr-only">Search tasks</span><input placeholder="Search your tasks…" value={query} onChange={e => setQuery(e.target.value)} type="search" /></label></div>
    {error && <div className="error" role="alert">{error} <button className="text-button" onClick={load}>Refresh board</button></div>}<p className="sr-only" role="status">{notice}</p>
    <div className="task-board" aria-busy={loading}>{statuses.map(status => {
      const column = filtered.filter(t => t.status === status);
      return <section className={`task-column ${status}`} key={status} aria-label={statusLabels[status]}><div className="column-heading"><h2><span className={`status-dot ${status}`} />{statusLabels[status]} <span className="column-count">{column.length}</span></h2><span aria-hidden="true">···</span></div><div className="column-body">{loading ? <p className="empty" role="status">Loading tasks…</p> : column.length ? column.map(task => <TaskCard key={task.id} task={task} busy={busyIds.has(task.id)} onEdit={() => setEditing(task)} onStatus={s => { void mutate(task, s); }} onDelete={() => setDeleting(task)} />) : <div className="empty"><span aria-hidden="true">{status === "done" ? "✓" : "＋"}</span><p>{query ? "No matching tasks" : status === "done" ? "Good things take a little time" : "A little room for your next idea"}</p><small>{query ? "Try a different search." : status === "done" ? "Finished tasks will feel right at home here." : "Create a task to get things flowing."}</small></div>}</div></section>;
    })}</div><footer className="board-bottom">YOUR PACE. YOUR PROGRESS.<span>{tasks.length ? Math.round(completed / tasks.length * 100) : 0}% complete</span></footer>
    </main></div>{editing && <TaskForm task={editing === "new" ? undefined : editing} onSave={save} onClose={() => setEditing(null)} />}
    {deleting && <DeleteTaskDialog task={deleting} busy={busyIds.has(deleting.id)} onCancel={() => setDeleting(null)} onDelete={() => { void mutate(deleting); }} />}
  </div>;
}
