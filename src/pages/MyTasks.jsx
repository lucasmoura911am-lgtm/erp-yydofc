import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, MapPin, Play, CheckCircle, AlertCircle, RefreshCw, ListTodo, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import TaskActionDialog from "@/components/tasks/TaskActionDialog";
import { getCurrentEmployee, QK, STATUS_META, PRIORITY_META } from "@/lib/taskHelpers";

// Aliases para retrocompatibilidade interna
const STATUS_LABEL = STATUS_META;
const PRIORITY_COLOR = {
  baixa: "bg-blue-50 text-blue-600 border-blue-200",
  media: "bg-yellow-50 text-yellow-700 border-yellow-200",
  alta:  "bg-red-50 text-red-700 border-red-200",
};

export default function MyTasks() {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [loadingEmployee, setLoadingEmployee] = useState(true);
  const [dialog, setDialog] = useState({ open: false, task: null, mode: null });

  const queryClient = useQueryClient();

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    setLoadingEmployee(true);
    const userData = await base44.auth.me();
    setUser(userData);
    let empData = [];
    if (userData.employee_id) {
      empData = await base44.entities.Employee.filter({ id: userData.employee_id });
    }
    if (empData.length === 0 && userData.email) {
      empData = await base44.entities.Employee.filter({ user_email: userData.email });
    }
    if (empData.length > 0) setEmployee(empData[0]);
    setLoadingEmployee(false);
  };

  const { data: myTasks = [], isLoading: loadingTasks, refetch } = useQuery({
    queryKey: ["myTasks", employee?.id],
    queryFn: async () => {
      if (!employee?.id) return [];

      const byEmployee = await base44.entities.Task.filter({ employee_id: employee.id });

      const extra = [];
      if (employee.current_allocation_id) {
        const byAlloc = await base44.entities.Task.filter({ allocation_id: employee.current_allocation_id });
        byAlloc.forEach(t => { if (!byEmployee.find(x => x.id === t.id)) extra.push(t); });
      }

      const combined = [...byEmployee, ...extra];

      // Include recurring scheduled for today
      const dayNames = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
      const todayDow = dayNames[new Date().getDay()];
      combined.forEach(t => {
        if (t.frequency === "diaria" || (t.frequency === "semanal" && t.scheduled_days?.includes(todayDow))) {
          // already included if in byEmployee; just tag it
        }
      });

      return combined.sort((a, b) => {
        // Sort: atrasada first, then em_andamento, then pendente, then concluida
        const order = { atrasada: 0, em_andamento: 1, pendente: 2, pausada: 3, concluida: 4 };
        return (order[a.status] ?? 5) - (order[b.status] ?? 5);
      });
    },
    enabled: !!employee?.id,
    staleTime: 0,
    refetchInterval: 30000,
    refetchOnMount: true,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myTasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks_kanban"] });
      setDialog({ open: false, task: null, mode: null });
    },
  });

  const handleActionSuccess = (updateData) => {
    updateMutation.mutate({ id: dialog.task.id, data: updateData });
  };

  const openDialog = (task, mode) => setDialog({ open: true, task, mode });

  const pending = myTasks.filter(t => t.status === "pendente" || t.status === "pausada");
  const inProgress = myTasks.filter(t => t.status === "em_andamento" || t.status === "atrasada");
  const done = myTasks.filter(t => t.status === "concluida");

  const totalToday = myTasks.length;
  const doneToday = done.length;

  if (loadingEmployee) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-12 h-12 mx-auto text-yellow-500 mb-3" />
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Perfil não encontrado</h2>
        <p className="text-sm text-gray-500 mt-1">Seu usuário ainda não está vinculado a um funcionário. Fale com o gestor.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <ListTodo className="w-5 h-5 text-purple-600" />
              Minhas Tarefas
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={loadingTasks}
            className="gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingTasks ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* Progress bar */}
        {totalToday > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{doneToday}/{totalToday} tarefas concluídas</span>
              <span>{Math.round((doneToday / totalToday) * 100)}%</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-green-500 rounded-full transition-all duration-500"
                style={{ width: `${totalToday > 0 ? (doneToday / totalToday) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 space-y-6 max-w-2xl mx-auto">

        {/* Atrasadas + Em andamento */}
        {inProgress.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
              Em Execução ({inProgress.length})
            </h2>
            <div className="space-y-3">
              {inProgress.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStart={() => openDialog(task, "start")}
                  onComplete={() => openDialog(task, "complete")}
                />
              ))}
            </div>
          </section>
        )}

        {/* Pendentes */}
        {pending.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
              Pendentes ({pending.length})
            </h2>
            <div className="space-y-3">
              {pending.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStart={() => openDialog(task, "start")}
                  onComplete={() => openDialog(task, "complete")}
                />
              ))}
            </div>
          </section>
        )}

        {/* Concluídas */}
        {done.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              Concluídas hoje ({done.length})
            </h2>
            <div className="space-y-2">
              {done.map(task => (
                <TaskCard key={task.id} task={task} done />
              ))}
            </div>
          </section>
        )}

        {totalToday === 0 && !loadingTasks && (
          <div className="text-center py-16 text-gray-400">
            <CheckCircle2 className="w-14 h-14 mx-auto mb-3 opacity-30" />
            <p className="text-base font-medium">Nenhuma tarefa para hoje</p>
            <p className="text-sm mt-1">O gestor ainda não atribuiu tarefas para você.</p>
          </div>
        )}
      </div>

      {/* Action Dialog */}
      <TaskActionDialog
        open={dialog.open}
        onClose={() => setDialog({ open: false, task: null, mode: null })}
        task={dialog.task}
        mode={dialog.mode}
        onSuccess={handleActionSuccess}
      />
    </div>
  );
}

function TaskCard({ task, onStart, onComplete, done }) {
  const statusCfg = STATUS_LABEL[task.status] || STATUS_LABEL.pendente;
  const priorityCfg = PRIORITY_COLOR[task.priority] || PRIORITY_COLOR.media;
  const isLate = task.status === "atrasada";

  return (
    <Card className={`${isLate ? "border-red-400 border-2" : ""} ${done ? "opacity-70" : ""}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-sm ${done ? "line-through text-gray-400" : "text-gray-900 dark:text-gray-100"}`}>
              {task.title}
            </p>
            {task.description && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>
            )}
          </div>
          <Badge variant="outline" className={`text-xs flex-shrink-0 ${priorityCfg}`}>
            {task.priority}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
          {task.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {task.location}
            </span>
          )}
          {(task.scheduled_start_time || task.scheduled_end_time) && (
            <span className="flex items-center gap-1 text-purple-600 font-medium">
              <Clock className="w-3 h-3" />
              {task.scheduled_start_time || "?"}{task.scheduled_end_time ? ` – ${task.scheduled_end_time}` : ""}
            </span>
          )}
          {task.due_date && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {format(parseISO(task.due_date), "dd/MM HH:mm")}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <Badge variant="outline" className={`text-xs ${statusCfg.color}`}>
            {statusCfg.label}
          </Badge>

          {/* Photos proof */}
          <div className="flex gap-1">
            {task.photo_before_url && (
              <a href={task.photo_before_url} target="_blank" rel="noreferrer">
                <img src={task.photo_before_url} alt="Antes" className="w-8 h-8 object-cover rounded border" title="Foto antes" />
              </a>
            )}
            {task.photo_after_url && (
              <a href={task.photo_after_url} target="_blank" rel="noreferrer">
                <img src={task.photo_after_url} alt="Depois" className="w-8 h-8 object-cover rounded border" title="Foto depois" />
              </a>
            )}
          </div>
        </div>

        {!done && (
          <div className="flex gap-2 pt-1">
            {(task.status === "pendente" || task.status === "pausada") && (
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm"
                onClick={onStart}
              >
                <Play className="w-4 h-4 mr-1.5" />
                Iniciar
              </Button>
            )}
            {(task.status === "em_andamento" || task.status === "atrasada") && (
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm"
                onClick={onComplete}
              >
                <CheckCircle className="w-4 h-4 mr-1.5" />
                {isLate ? "Concluir (atrasado)" : "Concluir"}
              </Button>
            )}
          </div>
        )}

        {done && task.completed_at && (
          <p className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Concluída às {format(parseISO(task.completed_at), "HH:mm")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}