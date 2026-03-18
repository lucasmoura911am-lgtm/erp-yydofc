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

const DAY_LABELS = { seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb", dom: "Dom" };
const DAY_ORDER = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];

export default function TaskRow({ task, now, onComplete }) {
  const computedStatus = getTaskStatus(task, now);
  const cfg = STATUS_STYLES[computedStatus];
  const StatusIcon = cfg.icon;
  const isDone = computedStatus === "concluida";

  const hasSchedule = task.scheduled_start_time || task.scheduled_end_time;
  const hasDays = task.scheduled_days?.length > 0;

  // Time bar: progress between start and end
  let timeProgress = null;
  if (task.scheduled_start_time && task.scheduled_end_time && !isDone) {
    const [sh, sm] = task.scheduled_start_time.split(":").map(Number);
    const [eh, em] = task.scheduled_end_time.split(":").map(Number);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    if (endMins > startMins) {
      timeProgress = Math.min(100, Math.max(0, Math.round(((nowMins - startMins) / (endMins - startMins)) * 100)));
    }
  }

  return (
    <div className={`rounded-lg border ${cfg.border} ${cfg.bg} px-3 py-2 flex flex-col gap-1.5`}>
      <div className="flex items-start gap-2">
        <StatusIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.color}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium leading-tight truncate ${isDone ? "line-through text-gray-400" : "text-gray-800 dark:text-gray-100"}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {hasSchedule && (
              <span className="flex items-center gap-0.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
                <Clock className="w-2.5 h-2.5" />
                {task.scheduled_start_time || "?"}{task.scheduled_end_time ? ` – ${task.scheduled_end_time}` : ""}
              </span>
            )}
            {!hasSchedule && task.due_date && (
              <span className="flex items-center gap-0.5 text-xs text-gray-400">
                <Clock className="w-2.5 h-2.5" />
                {format(new Date(task.due_date), "HH:mm")}
              </span>
            )}
            <span className={`text-xs font-medium ${cfg.labelColor}`}>{cfg.label}</span>
          </div>
        </div>
        {!isDone && (
          <Button
            size="sm"
            variant="ghost"
            className={`h-6 px-2 text-xs flex-shrink-0 ${
              computedStatus === "em_andamento" || computedStatus === "atrasada"
                ? "text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30"
                : "text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30"
            }`}
            onClick={onComplete}
            title={computedStatus === "pendente" ? "Iniciar tarefa" : "Concluir tarefa"}
          >
            {computedStatus === "pendente" ? "▶" : "✓"}
          </Button>
        )}
      </div>

      {/* Time progress bar */}
      {timeProgress !== null && (
        <div className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${timeProgress >= 100 ? "bg-red-400" : timeProgress > 60 ? "bg-yellow-400" : "bg-blue-400"}`}
            style={{ width: timeProgress + "%" }}
          />
        </div>
      )}

      {/* Days of week chips */}
      {hasDays && (
        <div className="flex gap-0.5 flex-wrap">
          {DAY_ORDER.map(d => {
            const active = task.scheduled_days.includes(d);
            return (
              <span
                key={d}
                className={`text-[10px] px-1.5 py-0 rounded font-medium ${active ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" : "bg-gray-100 text-gray-300 dark:bg-gray-800 dark:text-gray-600"}`}
              >
                {DAY_LABELS[d]}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}