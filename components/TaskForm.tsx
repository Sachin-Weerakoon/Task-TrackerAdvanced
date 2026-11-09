"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { statuses, statusLabels, type TaskData } from "@/lib/validation";
export type TaskInput = { title: string; description: string; status: TaskData["status"] };
export function TaskForm({ task, onSave, onClose }: { task?: TaskData; onSave: (data: TaskInput) => Promise<void>; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setError("");
    try { await onSave({ title: String(data.get("title")), description: String(data.get("description")), status: data.get("status") as TaskData["status"] }); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to save task"); setBusy(false); }
  }
  return <dialog ref={dialog} className="task-dialog" onCancel={e => { if (busy) e.preventDefault(); else onClose(); }} aria-labelledby="task-form-title">
    <div className="dialog-heading"><div><p className="eyebrow">MAKE YOUR NEXT MOVE</p><h2 id="task-form-title">{task ? "Task details" : "Create a task"}</h2></div><button className="icon-button" type="button" aria-label="Close task" disabled={busy} onClick={onClose}>×</button></div>
    <form onSubmit={submit} className="stack"><label>Title<input name="title" placeholder="What needs to get done?" defaultValue={task?.title} maxLength={160} required disabled={busy} /></label><label>Description<textarea name="description" placeholder="Add a little context, notes, or next steps…" defaultValue={task?.description} maxLength={5000} rows={5} disabled={busy} /></label><label>Status<select name="status" defaultValue={task?.status ?? "todo"} disabled={busy}>{statuses.map(s => <option value={s} key={s}>{statusLabels[s]}</option>)}</select></label>
    {task && <small className="muted">Created {new Date(task.createdAt).toLocaleString()} · Updated {new Date(task.updatedAt).toLocaleString()}</small>}
    {error && <p className="error" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="primary" disabled={busy}>{busy ? "Saving…" : task ? "Save changes" : "Create task"}</button></div></form>
  </dialog>;
}
