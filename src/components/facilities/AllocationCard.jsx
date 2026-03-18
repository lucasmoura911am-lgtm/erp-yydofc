import React from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, CheckCircle2, AlertCircle, Timer, CircleDot } from "lucide-react";
import TaskRow from "./TaskRow";

const STATUS_CONFIG = {
  green: {
    border: "border-green-400",
    header: "bg-gradient-to-r from-green-500 to-emerald-500",
    badge: "bg-green-100 text-green-800 border-green-300",
    indicator: "bg-green-500",
    label: "No Posto",
    icon: CheckCircle2,
  },
  yellow: {
    border: "border-yellow-400",
    header: "bg-gradient-to-r from-yellow-500 to-amber-500",
    badge: "bg-yellow-100 text-yellow-800 border-yellow-300",
    indicator: "bg-yellow-500",
    label: "Atenção",
    icon: AlertCircle,
  },
  red: {
    border: "border-red-400",
    header: "bg-gradient-to-r from-red-500 to-rose-500",
    badge: "bg-red-100 text-red-800 border-red-300",
    indicator: "bg-red-500",
    label: "Fora do Posto",
    icon: Timer,
  },
};

export default function AllocationCard({
  allocation,
  employee,
  client,
  tasks,
  isPresent,
  status,
  now,
  onCompleteTask,
}) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.red;
  const StatusIcon = cfg.icon;

  const sortedTasks = [...tasks].sort((a, b) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

  const concluded = tasks.filter(t => t.status === "concluida").length;
  const total = tasks.length;

  return (
    <div
      className={`flex flex-col w-72 flex-shrink-0 rounded-xl border-2 ${cfg.border} bg-white dark:bg-gray-900 shadow-md overflow-hidden`}
      style={{ maxHeight: "calc(100vh - 200px)" }}
    >
      {/* Column Header */}
      <div className={`${cfg.header} px-4 py-3 text-white`}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{allocation.post_name}</p>
            {client && (
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 opacity-80" />
                <p className="text-xs opacity-90 truncate">{client.name}</p>
              </div>
            )}
            {allocation.post_location && (
              <p className="text-xs opacity-75 truncate mt-0.5">{allocation.post_location}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 ml-2">
            <div className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-white/20`}>
              <StatusIcon className="w-3 h-3" />
              {cfg.label}
            </div>
            {total > 0 && (
              <span className="text-xs opacity-80">{concluded}/{total} tarefas</span>
            )}
          </div>
        </div>
      </div>

      {/* Employee Card */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        {employee ? (
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="w-12 h-12 border-2 border-white shadow">
                <AvatarImage src={employee.photo_url} alt={employee.full_name} />
                <AvatarFallback className="text-sm font-bold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                  {employee.full_name?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              {/* Presence indicator dot */}
              <span
                className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${cfg.indicator}`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                {employee.full_name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {employee.employee_number ? `#${employee.employee_number}` : ""}
                {employee.job_function ? ` • ${employee.job_function}` : ""}
              </p>
              <div className={`inline-flex items-center gap-1 mt-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.indicator}`} />
                {isPresent ? "Presente" : "Ausente"}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-400">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <span className="text-xl">?</span>
            </div>
            <span className="text-sm">Funcionário não encontrado</span>
          </div>
        )}
      </div>

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {sortedTasks.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <CircleDot className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">Sem tarefas hoje</p>
          </div>
        ) : (
          sortedTasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              now={now}
              onComplete={() => onCompleteTask(task)}
            />
          ))
        )}
      </div>

      {/* Footer: schedule info */}
      {allocation.work_schedule && (
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 flex items-center gap-1.5 text-xs text-gray-400">
          <Clock className="w-3 h-3" />
          <span>{allocation.work_schedule}</span>
        </div>
      )}
    </div>
  );
}