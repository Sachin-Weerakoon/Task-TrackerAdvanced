"use client";

import { statuses, statusLabels, type TaskData } from "@/lib/validation";
import { Icon } from "./Icon";

type TaskCardProps = {
  task: TaskData;
  busy: boolean;
  onEdit: () => void;
  onStatus: (status: TaskData["status"]) => void;
  onDelete: () => void;
};

export function TaskCard({ task, busy, onEdit, onStatus, onDelete }: TaskCardProps) {
  return (
    <article className={`task-card ${task.status}`} aria-busy={busy}>
      <div className="card-top">
        <span className={`status-tag ${task.status}`}>
          <span className={`status-dot ${task.status}`} />
          {statusLabels[task.status]}
        </span>
        <button className="card-open" disabled={busy} onClick={onEdit} aria-label={`View or edit ${task.title}`}>
          <Icon name="arrow" size={16} />
        </button>
      </div>
      <button className="card-title" disabled={busy} onClick={onEdit}>{task.title}</button>
      {task.description && <p className="card-description">{task.description}</p>}
      <div className="card-footer">
        <select aria-label={`Status for ${task.title}`} value={task.status} disabled={busy} onChange={event => onStatus(event.target.value as TaskData["status"])}>
          {statuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}
        </select>
        <button className="delete-button" disabled={busy} onClick={onDelete} aria-label={`Delete ${task.title}`}>
          <Icon name="trash" size={15} />
        </button>
      </div>
    </article>
  );
}
