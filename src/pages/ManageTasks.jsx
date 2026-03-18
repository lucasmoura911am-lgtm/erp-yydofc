import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2, Pause, Play, XCircle, Calendar, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ManageTasks() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const DAYS = [
    { id: "seg", label: "Seg" },
    { id: "ter", label: "Ter" },
    { id: "qua", label: "Qua" },
    { id: "qui", label: "Qui" },
    { id: "sex", label: "Sex" },
    { id: "sab", label: "Sáb" },
    { id: "dom", label: "Dom" },
  ];

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    employee_id: "",
    allocation_id: "",
    client_id: "",
    due_date: "",
    scheduled_start_time: "",
    scheduled_end_time: "",
    scheduled_days: [],
    location: "",
    priority: "media",
    frequency: "avulsa"
  });

  const toggleDay = (day) => {
    setFormData(prev => ({
      ...prev,
      scheduled_days: prev.scheduled_days.includes(day)
        ? prev.scheduled_days.filter(d => d !== day)
        : [...prev.scheduled_days, day]
    }));
  };

  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', user?.company_id],
    queryFn: async () => {
      if (!user?.company_id) return [];
      const allTasks = await base44.entities.Task.filter({ company_id: user.company_id }, '-created_date');
      await checkAndCreateRecurringTasks(allTasks);
      return allTasks;
    },
    enabled: !!user?.company_id,
    refetchInterval: 300000, // Recheck every 5 minutes
  });

  const { data: allEmployees = [] } = useQuery({
    queryKey: ['employees', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Employee.filter({ company_id: user.company_id, status: 'active' }) : [],
    enabled: !!user?.company_id,
  });

  const { data: allocations = [] } = useQuery({
    queryKey: ['allocations', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Allocation.filter({ company_id: user.company_id, status: 'ativo' }) : [],
    enabled: !!user?.company_id,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Client.filter({ company_id: user.company_id }) : [],
    enabled: !!user?.company_id,
  });

  const employees = user?.is_supervisor 
    ? allEmployees.filter(emp => emp.supervisor_email === user.email || user.supervised_teams?.some(teamId => emp.team_id === teamId))
    : allEmployees;

  const checkAndCreateRecurringTasks = async (existingTasks) => {
    const recurringTasks = existingTasks.filter(t => 
      (t.frequency === 'diaria' || t.frequency === 'semanal') && 
      t.status !== 'cancelada'
    );

    for (const task of recurringTasks) {
      const taskDueDate = new Date(task.due_date);
      const now = new Date();
      
      // Check if task is overdue and should spawn a new instance
      if (taskDueDate < now) {
        let nextDueDate = new Date(taskDueDate);
        
        if (task.frequency === 'diaria') {
          // Add days until we get to today or future
          while (nextDueDate < now) {
            nextDueDate.setDate(nextDueDate.getDate() + 1);
          }
        } else if (task.frequency === 'semanal') {
          // Add weeks
          while (nextDueDate < now) {
            nextDueDate.setDate(nextDueDate.getDate() + 7);
          }
        }

        // Check if a task already exists for this new due date
        const nextDueDateStr = nextDueDate.toISOString().substring(0, 16);
        const existingNextTask = existingTasks.find(t => 
          t.employee_id === task.employee_id &&
          t.title === task.title &&
          t.due_date.substring(0, 16) === nextDueDateStr
        );

        if (!existingNextTask) {
          // Create new recurring task instance
          await base44.entities.Task.create({
            title: task.title,
            description: task.description,
            employee_id: task.employee_id,
            company_id: task.company_id,
            supervisor_email: task.supervisor_email,
            due_date: nextDueDate.toISOString(),
            location: task.location,
            priority: task.priority,
            frequency: task.frequency,
            status: 'pendente'
          });
        }
      }
    }
  };

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks']);
      setDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks']);
      setDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks']);
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      employee_id: "",
      allocation_id: "",
      client_id: "",
      due_date: "",
      location: "",
      priority: "media",
      frequency: "avulsa"
    });
    setEditing(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { 
      title: formData.title,
      description: formData.description,
      employee_id: formData.employee_id,
      allocation_id: formData.allocation_id || "",
      client_id: formData.client_id || "",
      company_id: user.company_id,
      supervisor_email: user.email,
      due_date: formData.due_date,
      location: formData.location || (allocations.find(a => a.id === formData.allocation_id)?.post_location || ""),
      priority: formData.priority,
      frequency: formData.frequency,
      status: 'pendente'
    };
    
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (task) => {
    setEditing(task);
    setFormData({
      title: task.title,
      description: task.description || "",
      employee_id: task.employee_id,
      allocation_id: task.allocation_id || "",
      client_id: task.client_id || "",
      due_date: task.due_date,
      location: task.location || "",
      priority: task.priority,
      frequency: task.frequency
    });
    setDialogOpen(true);
  };

  const handleStatusChange = async (taskId, newStatus) => {
    const task = tasks.find(t => t.id === taskId);
    await updateMutation.mutateAsync({ id: taskId, data: { ...task, status: newStatus } });
  };

  const getEmployeeName = (id) => {
    const emp = allEmployees.find(e => e.id === id);
    return emp?.full_name || "Desconhecido";
  };

  const statusColors = {
    pendente: "bg-gray-100 text-gray-800",
    em_andamento: "bg-blue-100 text-blue-800",
    concluida: "bg-green-100 text-green-800",
    atrasada: "bg-red-100 text-red-800",
    cancelada: "bg-red-100 text-red-800",
    pausada: "bg-yellow-100 text-yellow-800"
  };

  const priorityColors = {
    baixa: "bg-blue-100 text-blue-800",
    media: "bg-yellow-100 text-yellow-800",
    alta: "bg-red-100 text-red-800"
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Gestão de Tarefas</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Crie e gerencie tarefas para sua equipe
          </p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-gradient-to-r from-purple-600 to-blue-600">
          <Plus className="w-4 h-4 mr-2" />
          Nova Tarefa
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Todas as Tarefas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarefa</TableHead>
                <TableHead>Funcionário</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{task.title}</p>
                      {task.description && (
                        <p className="text-sm text-gray-500 truncate max-w-xs">{task.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getEmployeeName(task.employee_id)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="w-3 h-3" />
                      {format(parseISO(task.due_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={priorityColors[task.priority]}>
                      {task.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[task.status]}>
                      {task.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(task)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      {task.status === 'pendente' && (
                        <Button variant="ghost" size="icon" onClick={() => handleStatusChange(task.id, 'pausada')}>
                          <Pause className="w-4 h-4" />
                        </Button>
                      )}
                      {task.status === 'pausada' && (
                        <Button variant="ghost" size="icon" onClick={() => handleStatusChange(task.id, 'pendente')}>
                          <Play className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleStatusChange(task.id, 'cancelada')}>
                        <XCircle className="w-4 h-4 text-red-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(task.id)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Lotação (Posto)</Label>
                <Select
                  value={formData.allocation_id}
                  onValueChange={(value) => {
                    const alloc = allocations.find(a => a.id === value);
                    setFormData({ ...formData, allocation_id: value, client_id: alloc?.client_id || "", employee_id: alloc?.employee_id || formData.employee_id });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a lotação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Sem lotação específica</SelectItem>
                    {allocations.map((a) => {
                      const cli = clients.find(c => c.id === a.client_id);
                      return (
                        <SelectItem key={a.id} value={a.id}>
                          {a.post_name}{cli ? ` — ${cli.name}` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Funcionário *</Label>
                <Select
                  value={formData.employee_id}
                  onValueChange={(value) => setFormData({ ...formData, employee_id: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data e Hora Limite *</Label>
                <Input
                  type="datetime-local"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Frequência</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="avulsa">Avulsa</SelectItem>
                    <SelectItem value="diaria">Diária</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Local (opcional)</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-gradient-to-r from-purple-600 to-blue-600">
                {editing ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}