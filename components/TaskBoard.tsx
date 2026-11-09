"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "./Brand";
import { Icon } from "./Icon";
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
  const [initialStatus, setInitialStatus] = useState<TaskData["status"]>("todo");
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
  const completion = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  function openNewTask(status: TaskData["status"] = "todo") {
    setInitialStatus(status);
    setEditing("new");
  }

  return (
    <div className="workspace">
      <aside className="sidebar">
        <Brand />
        <p className="nav-caption">WORKSPACE</p>
        <div className="nav-active" aria-current="page">
          <Icon name="board" /> My board <span className="nav-count">{tasks.length}</span>
        </div>
        <div className="sidebar-tip">
          <span className="tip-spark" aria-hidden="true">✦</span>
          <p className="tip-label">FIND YOUR FLOW</p>
          <h3>Small steps.<br />Real progress.</h3>
          <p>Make space for what matters. One task at a time.</p>
        </div>
        <div className="sidebar-profile">
          <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
          <div><strong>{user.name}</strong><small>Personal workspace</small></div>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="topbar">
          <span>Workspace <span className="slash">/</span> <strong>My board</strong></span>
          <button className="secondary logout" onClick={logout} disabled={loggingOut}>
            {loggingOut ? "Logging out…" : <><Icon name="logout" size={15} /> Log out</>}
          </button>
        </header>

        <main className="board-content">
          <div className="board-heading">
            <div>
              <p className="eyebrow"><span className="heading-dot" /> YOUR PERSONAL WORKSPACE</p>
              <h1>A little focus.<br /><span>A lot of progress.</span></h1>
              <p className="muted">Hi {user.name.split(" ")[0]}, make room for your next great idea.</p>
            </div>
            <button className="primary new-task" disabled={loading} onClick={() => openNewTask()}>
              <Icon name="plus" size={18} /> New task
            </button>
          </div>

          <section className="stats" aria-label="Task overview">
            <div><span className="stat-icon total"><Icon name="board" size={22} /></span><div><small>Total tasks</small><strong>{loading ? "—" : tasks.length}<span>on your board</span></strong></div></div>
            <div><span className="stat-icon progress"><Icon name="clock" size={23} /></span><div><small>In progress</small><strong>{loading ? "—" : tasks.filter(task => task.status === "in_progress").length}<span>moving forward</span></strong></div></div>
            <div><span className="stat-icon complete"><Icon name="check" size={23} /></span><div><small>Completed</small><strong>{loading ? "—" : completed}<span>little wins add up</span></strong></div></div>
          </section>

          <section className="momentum" aria-label="Board completion">
            <div><span className="momentum-icon"><Icon name="check" size={16} /></span><p>Your momentum <span>{loading ? "Loading your progress…" : `${completed} of ${tasks.length} tasks complete`}</span></p></div>
            <div className="momentum-meter"><progress value={completion} max={100} aria-label="Tasks completed" /><strong>{completion}%</strong></div>
          </section>

          <div className="board-toolbar">
            <h2><Icon name="board" size={17} /> My task board</h2>
            <label className="search">
              <span className="sr-only">Search tasks</span><Icon name="search" size={17} />
              <input placeholder="Find a task…" value={query} onChange={event => setQuery(event.target.value)} type="search" />
            </label>
          </div>
          {error && <div className="error" role="alert">{error} <button className="text-button" onClick={load}>Refresh board</button></div>}
          <div className="task-board" aria-busy={loading}>
            {statuses.map(status => {
              const column = filtered.filter(task => task.status === status);
              return (
                <section className={`task-column ${status}`} key={status} aria-label={statusLabels[status]}>
                  <div className="column-heading">
                    <h2><span className={`status-dot ${status}`} />{statusLabels[status]} <span className="column-count">{loading ? "—" : column.length}</span></h2>
                    <button className="column-add" disabled={loading} onClick={() => openNewTask(status)} aria-label={`Create a task in ${statusLabels[status]}`}><Icon name="plus" size={17} /></button>
                  </div>
                  <div className="column-body">
                    {loading ? (
                      <div className="board-skeleton" role="status"><span className="sr-only">Loading tasks…</span><div /><div /><div /></div>
                    ) : column.length ? column.map(task => (
                      <TaskCard key={task.id} task={task} busy={busyIds.has(task.id)} onEdit={() => setEditing(task)} onStatus={next => { void mutate(task, next); }} onDelete={() => setDeleting(task)} />
                    )) : (
                      <div className="empty">
                        <span><Icon name={status === "done" ? "check" : status === "in_progress" ? "clock" : "board"} size={24} /></span>
                        <p>{query ? "Nothing here just yet" : status === "done" ? "Make room for little wins" : status === "in_progress" ? "Ready when you are" : "Every great idea starts here"}</p>
                        <small>{query ? "Try another title or keyword." : status === "done" ? "Your finished tasks will land here." : status === "in_progress" ? "Move a task here to get it going." : "Add your first task and find your flow."}</small>
                        {status === "todo" && !query && <button className="empty-action" onClick={() => openNewTask()}><Icon name="plus" size={15} /> Add a task</button>}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
          <footer className="board-bottom"><span>Made for a little more flow.</span><span>YOUR PACE. YOUR PROGRESS.</span></footer>
        </main>
      </div>
      {notice && <div className="success-notice" role="status"><span><Icon name="check" size={17} />{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice("")}>×</button></div>}
      {editing && <TaskForm task={editing === "new" ? undefined : editing} initialStatus={initialStatus} onSave={save} onClose={() => setEditing(null)} />}
      {deleting && <DeleteTaskDialog task={deleting} busy={busyIds.has(deleting.id)} onCancel={() => setDeleting(null)} onDelete={() => { void mutate(deleting); }} />}
    </div>
  );
}
