"use client";
import { useEffect, useRef } from "react";
import type { TaskData } from "@/lib/validation";
export function DeleteTaskDialog({ task, busy, onCancel, onDelete }: { task: TaskData; busy: boolean; onCancel: () => void; onDelete: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} className="task-dialog" aria-labelledby="delete-title" onCancel={event => {
    if (busy) event.preventDefault(); else onCancel();
  }}>
    <h2 id="delete-title">Delete this task?</h2>
    <p className="muted">“{task.title}” will be permanently deleted.</p>
    <div className="dialog-actions">
      <button className="secondary" disabled={busy} onClick={onCancel}>Keep task</button>
      <button className="danger" disabled={busy} onClick={onDelete}>{busy ? "Deleting…" : "Delete task"}</button>
    </div>
  </dialog>;
}
