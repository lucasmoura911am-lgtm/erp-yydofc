import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, CheckCircle, Camera, MapPin, Clock, AlertCircle } from "lucide-react";
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
import { format, parseISO, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MyTasks() {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState(null); // 'start' or 'complete'
  const [selectedTask, setSelectedTask] = useState(null);
  const [photoToUpload, setPhotoToUpload] = useState(null);
  const [observation, setObservation] = useState("");
  const [uploading, setUploading] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
    
    if (userData.employee_id) {
      const employeeData = await base44.entities.Employee.filter({ id: userData.employee_id });
      if (employeeData.length > 0) {
        setEmployee(employeeData[0]);
      }
    }
  };

  const { data: myTasks = [] } = useQuery({
    queryKey: ['myTasks', employee?.id],
    queryFn: () => employee?.id ? base44.entities.Task.filter({ employee_id: employee.id }, '-due_date') : [],
    enabled: !!employee?.id,
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['myTasks']);
      setDialogOpen(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setSelectedTask(null);
    setDialogType(null);
    setPhotoToUpload(null);
    setObservation("");
  };

  const handleStartClick = (task) => {
    setSelectedTask(task);
    setDialogType('start');
    setDialogOpen(true);
  };

  const handleCompleteClick = (task) => {
    setSelectedTask(task);
    setDialogType('complete');
    setDialogOpen(true);
  };

  const handleStartSubmit = async () => {
    if (!photoToUpload) {
      alert('É obrigatório enviar a foto ANTES de iniciar!');
      return;
    }

    setUploading(true);
    try {
      const now = new Date().toISOString();
      const newStatus = isPast(parseISO(selectedTask.due_date)) ? 'atrasada' : 'em_andamento';
      
      const updateData = {
        title: selectedTask.title,
        description: selectedTask.description,
        employee_id: selectedTask.employee_id,
        company_id: selectedTask.company_id,
        supervisor_email: selectedTask.supervisor_email,
        due_date: selectedTask.due_date,
        location: selectedTask.location,
        priority: selectedTask.priority,
        frequency: selectedTask.frequency,
        status: newStatus,
        started_at: now,
        photo_before_url: photoToUpload
      };
      
      await updateTaskMutation.mutateAsync({
        id: selectedTask.id,
        data: updateData
      });
    } catch (error) {
      console.error('Erro ao iniciar tarefa:', error);
      alert('Erro ao iniciar tarefa: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setUploading(false);
    }
  };

  const handleCompleteSubmit = async () => {
    if (!photoToUpload) {
      alert('É obrigatório enviar a foto DEPOIS de concluir!');
      return;
    }

    setUploading(true);
    try {
      const updateData = {
        title: selectedTask.title,
        description: selectedTask.description,
        employee_id: selectedTask.employee_id,
        company_id: selectedTask.company_id,
        supervisor_email: selectedTask.supervisor_email,
        due_date: selectedTask.due_date,
        location: selectedTask.location,
        priority: selectedTask.priority,
        frequency: selectedTask.frequency,
        status: 'concluida',
        started_at: selectedTask.started_at,
        completed_at: new Date().toISOString(),
        photo_before_url: selectedTask.photo_before_url,
        photo_after_url: photoToUpload,
        observation: observation
      };
      
      await updateTaskMutation.mutateAsync({
        id: selectedTask.id,
        data: updateData
      });
    } catch (error) {
      console.error('Erro ao concluir tarefa:', error);
      alert('Erro ao concluir tarefa: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setUploading(false);
    }
  };

  const pendingTasks = myTasks.filter(t => t.status === 'pendente' || t.status === 'em_andamento' || t.status === 'atrasada');
  const completedTasks = myTasks.filter(t => t.status === 'concluida');

  const statusColors = {
    pendente: "bg-gray-100 text-gray-800",
    em_andamento: "bg-blue-100 text-blue-800",
    concluida: "bg-green-100 text-green-800",
    atrasada: "bg-red-100 text-red-800"
  };

  const priorityColors = {
    baixa: "bg-blue-100 text-blue-800",
    media: "bg-yellow-100 text-yellow-800",
    alta: "bg-red-100 text-red-800"
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Minhas Tarefas</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Execute e comprove suas atividades
        </p>
      </div>

      {/* Pending Tasks */}
      <div>
        <h2 className="text-xl font-bold mb-4">📋 Tarefas Pendentes ({pendingTasks.length})</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {pendingTasks.map((task) => {
            const isLate = isPast(parseISO(task.due_date)) && task.status !== 'concluida';
            
            return (
              <Card key={task.id} className={`${isLate ? 'border-2 border-red-500' : ''}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{task.title}</CardTitle>
                    <Badge variant="outline" className={priorityColors[task.priority]}>
                      {task.priority}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {task.description && (
                    <p className="text-sm text-gray-600">{task.description}</p>
                  )}
                  
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    {format(parseISO(task.due_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>

                  {task.location && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <MapPin className="w-4 h-4" />
                      {task.location}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Badge variant="outline" className={statusColors[task.status]}>
                      {task.status}
                    </Badge>
                  </div>

                  {isLate && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Tarefa atrasada! Execute o quanto antes.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-2 pt-2">
                    {task.status === 'pendente' && (
                      <Button onClick={() => handleStartClick(task)} className="flex-1 bg-blue-600">
                        <Play className="w-4 h-4 mr-2" />
                        Iniciar
                      </Button>
                    )}
                    {task.status === 'em_andamento' && (
                      <Button onClick={() => handleCompleteClick(task)} className="flex-1 bg-green-600">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Concluir
                      </Button>
                    )}
                    {task.status === 'atrasada' && (
                      <Button onClick={() => handleCompleteClick(task)} className="flex-1 bg-orange-600">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Concluir Agora
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4 text-green-600">✅ Tarefas Concluídas ({completedTasks.length})</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {completedTasks.slice(0, 6).map((task) => (
              <Card key={task.id} className="bg-green-50 dark:bg-green-900/20">
                <CardContent className="p-4">
                  <p className="font-medium text-sm">{task.title}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Concluída em {format(parseISO(task.completed_at), "dd/MM/yyyy 'às' HH:mm")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Photo Upload Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogType === 'start' ? '📸 Iniciar Tarefa - Foto ANTES' : '✅ Concluir Tarefa - Foto DEPOIS'}
            </DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="font-medium">{selectedTask.title}</p>
                <p className="text-sm text-gray-500">{selectedTask.description}</p>
              </div>

              <div className="space-y-2">
                <Label>{dialogType === 'start' ? 'Foto ANTES de iniciar *' : 'Foto DEPOIS de executar *'}</Label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  {photoToUpload ? (
                    <div className="space-y-2">
                      <img src={photoToUpload} alt="Upload" className="w-full h-64 object-cover rounded" />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setPhotoToUpload(null)}
                      >
                        Trocar Foto
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block">
                      <Camera className="w-16 h-16 mx-auto text-gray-400 mb-3" />
                      <p className="text-base font-medium text-gray-700">
                        {dialogType === 'start' ? 'Tire uma foto do local ANTES' : 'Tire uma foto do trabalho CONCLUÍDO'}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">Clique para usar a câmera</p>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (file) {
                            try {
                              const { file_url } = await base44.integrations.Core.UploadFile({ file });
                              setPhotoToUpload(file_url);
                            } catch (error) {
                              alert('Erro ao fazer upload da foto');
                            }
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>

              {dialogType === 'complete' && (
                <div className="space-y-2">
                  <Label>Observação</Label>
                  <Textarea
                    value={observation}
                    onChange={(e) => setObservation(e.target.value)}
                    rows={3}
                    placeholder="Adicione comentários sobre a execução..."
                  />
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={dialogType === 'start' ? handleStartSubmit : handleCompleteSubmit}
                  disabled={!photoToUpload || uploading}
                  className={dialogType === 'start' ? 'bg-blue-600' : 'bg-green-600'}
                >
                  {uploading ? 'Enviando...' : dialogType === 'start' ? '▶️ Iniciar Tarefa' : '✅ Concluir Tarefa'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}