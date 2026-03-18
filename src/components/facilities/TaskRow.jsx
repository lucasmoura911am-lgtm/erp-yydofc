import React from "react";
import { format, parseISO } from "date-fns";
import { CheckCircle2, Clock, AlertTriangle, Circle, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function getTaskStatus(task, now) {
  if (task.status === "concluida" || task.status === "cancelada") return "concluida";
  if (!task.due_date) return "pendente";

  const due = new Date(task.due_date);
  const nowTime = now.getTime();
  const dueTime = due.getTime();

  // Window: task is "em andamento" within 30 min before due_date
  const windowStart = dueTime - 30 * 60 * 1000;

  if (nowTime > dueTime) return "atrasada";
  if (nowTime >= windowStart) return "em_andamento";
  return "pendente";
}

const STATUS_STYLES = {
  pendente: {
    icon: Circle,
    color: "text-gray-400",
    bg: "bg-gray-50 dark:bg-gray-800",
    border: "border-gray-200 dark:border-gray-700",
    label: "Pendente",
    labelColor: "text-gray-500",
  },
  em_andamento: {
    icon: PlayCircle,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800",
    label: "Em Andamento",
    labelColor: "text-blue-600 dark:text-blue-400",
  },
  atrasada: {
    icon: AlertTriangle,
    color: "text-red-500",
    bg: "bg-red-50 dark:bg-red-900/20",
    border: "border-red-200 dark:border-red-800",
    label: "Atrasada",
    labelColor: "text-red-600 dark:text-red-400",
  },
  concluida: {
    icon: CheckCircle2,
    color: "text-green-500",
    bg: "bg-green-50 dark:bg-green-900/20",
    border: "border-green-200 dark:border-green-800",
    label: "Concluída",
    labelColor: "text-green-600 dark:text-green-400",
  },
};

export default function TaskRow({ task, now, onComplete }) {
  const computedStatus = getTaskStatus(task, now);
  const cfg = STATUS_STYLES[computedStatus];
  const StatusIcon = cfg.icon;
  const isDone = computedStatus === "concluida";

  const dueLabel = task.due_date
    ? format(new Date(task.due_date), "HH:mm")
    : null;

  return (
    <div className={`rounded-lg border ${cfg.border} ${cfg.bg} px-3 py-2 flex items-start gap-2`}>
      <StatusIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.color}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium leading-tight truncate ${isDone ? "line-through text-gray-400" : "text-gray-800 dark:text-gray-100"}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {dueLabel && (
            <span className="flex items-center gap-0.5 text-xs text-gray-400">
              <Clock className="w-2.5 h-2.5" />
              {dueLabel}
            </span>
          )}
          <span className={`text-xs font-medium ${cfg.labelColor}`}>{cfg.label}</span>
        </div>
      </div>
      {!isDone && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 flex-shrink-0"
          onClick={onComplete}
          title="Marcar como concluída"
        >
          OK
        </Button>
      )}
    </div>
  );
}