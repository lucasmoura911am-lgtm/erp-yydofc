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

  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  // 🔥 TASKS
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', user?.company_id],
    queryFn: () =>
      user?.company_id
        ? base44.entities.Task.filter({ company_id: user.company_id }, '-created_date')
        : [],
    enabled: !!user?.company_id,
  });

  const { data: allEmployees = [] } = useQuery({
    queryKey: ['employees', user?.company_id],
    queryFn: () =>
      user?.company_id
        ? base44.entities.Employee.filter({ company_id: user.company_id, status: 'active' })
        : [],
    enabled: !!user?.company_id,
  });

  const { data: allocations = [] } = useQuery({
    queryKey: ['allocations', user?.company_id],
    queryFn: () =>
      user?.company_id
        ? base44.entities.Allocation.filter({ company_id: user.company_id, status: 'ativo' })
        : [],
    enabled: !!user?.company_id,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', user?.company_id],
    queryFn: () =>
      user?.company_id
        ? base44.entities.Client.filter({ company_id: user.company_id })
        : [],
    enabled: !!user?.company_id,
  });

  // 🔥 CREATE
  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks', user.company_id]);
      setDialogOpen(false);
      resetForm();
    },
  });

  // 🔥 UPDATE
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks', user.company_id]);
      setDialogOpen(false);
      resetForm();
    },
  });

  // 🔥 DELETE
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks', user.company_id]);
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
      scheduled_start_time: "",
      scheduled_end_time: "",
      scheduled_days: [],
      location: "",
      priority: "media",
      frequency: "avulsa"
    });
    setEditing(null);
  };

  // 🔥 SUBMIT CORRIGIDO
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!user?.company_id) {
      alert("Erro: usuário não carregado");
      return;
    }

    if (!formData.employee_id) {
      alert("Selecione um funcionário");
      return;
    }

    const selectedEmployee = allEmployees.find(e => e.id === formData.employee_id);

    const data = { 
      title: formData.title,
      description: formData.description,
      employee_id: formData.employee_id,

      // 🔥 importante
      employee_email: selectedEmployee?.email || "",

      allocation_id: formData.allocation_id || "",
      client_id: formData.client_id || "",

      company_id: user.company_id,
      supervisor_email: user.email,

      due_date: formData.due_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),

      scheduled_start_time: formData.scheduled_start_time || "",
      scheduled_end_time: formData.scheduled_end_time || "",
      scheduled_days: formData.scheduled_days || [],

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

  // 🔥 STATUS FIX
  const handleStatusChange = async (taskId, newStatus) => {
    await updateMutation.mutateAsync({
      id: taskId,
      data: { status: newStatus }
    });
  };

  const getEmployeeName = (id) => {
    const emp = allEmployees.find(e => e.id === id);
    return emp?.full_name || "Desconhecido";
  };

  return (
    <div className="p-6 space-y-6">

      <div className="flex justify-between">
        <h1 className="text-2xl font-bold">Gestão de Tarefas</h1>

        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Tarefa
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tarefas</CardTitle>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarefa</TableHead>
                <TableHead>Funcionário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>{task.title}</TableCell>
                  <TableCell>{getEmployeeName(task.employee_id)}</TableCell>
                  <TableCell>{task.status}</TableCell>

                  <TableCell className="flex gap-2 justify-end">
                    <Button size="icon" onClick={() => handleStatusChange(task.id, 'pausada')}>
                      <Pause className="w-4 h-4" />
                    </Button>

                    <Button size="icon" onClick={() => handleStatusChange(task.id, 'pendente')}>
                      <Play className="w-4 h-4" />
                    </Button>

                    <Button size="icon" onClick={() => deleteMutation.mutate(task.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>

          </Table>
        </CardContent>
      </Card>

      {/* 🔥 DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>

          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">

            <Input
              placeholder="Título"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />

            <Select
              value={formData.employee_id}
              onValueChange={(value) => setFormData({ ...formData, employee_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione funcionário" />
              </SelectTrigger>

              <SelectContent>
                {allEmployees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DialogFooter>
              <Button type="submit">Salvar</Button>
            </DialogFooter>

          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}