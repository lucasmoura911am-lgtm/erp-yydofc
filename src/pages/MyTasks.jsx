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
  const [selectedTask, setSelectedTask] = useState(null);
  const [photoBefore, setPhotoBefore] = useState(null);
  const [photoAfter, setPhotoAfter] = useState(null);
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
    setPhotoBefore(null);
    setPhotoAfter(null);
    setObservation("");
  };

  const handleStart = async (task) => {
    const now = new Date().toISOString();
    const newStatus = isPast(parseISO(task.due_date)) ? 'atrasada' : 'em_andamento';
    
    await updateTaskMutation.mutateAsync({
      id: task.id,
      data: { ...task, status: newStatus, started_at: now }
    });
  };

  const handleComplete = (task) => {
    setSelectedTask(task);
    setDialogOpen(true);
  };

  const handlePhotoUpload = async (file, type) => {
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (type === 'before') {
        setPhotoBefore(file_url);
      } else {
        setPhotoAfter(file_url);
      }
    } catch (error) {
      alert('Erro ao fazer upload da foto');
    }
  };

  const handleSubmitCompletion = async () => {
    if (!photoBefore || !photoAfter) {
      alert('É obrigatório enviar as fotos antes e depois!');
      return;
    }

    setUploading(true);
    try {
      await updateTaskMutation.mutateAsync({
        id: selectedTask.id,
        data: {
          ...selectedTask,
          status: 'concluida',
          completed_at: new Date().toISOString(),
          photo_before_url: photoBefore,
          photo_after_url: photoAfter,
          observation: observation
        }
      });
    } catch (error) {
      alert('Erro ao concluir tarefa');
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
                      <Button onClick={() => handleStart(task)} className="flex-1 bg-blue-600">
                        <Play className="w-4 h-4 mr-2" />
                        Iniciar
                      </Button>
                    )}
                    {task.status === 'em_andamento' && (
                      <Button onClick={() => handleComplete(task)} className="flex-1 bg-green-600">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Concluir
                      </Button>
                    )}
                    {task.status === 'atrasada' && (
                      <Button onClick={() => handleComplete(task)} className="flex-1 bg-orange-600">
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

      {/* Completion Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Concluir Tarefa</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="font-medium">{selectedTask.title}</p>
                <p className="text-sm text-gray-500">{selectedTask.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Foto ANTES *</Label>
                  <div className="border-2 border-dashed rounded-lg p-4 text-center">
                    {photoBefore ? (
                      <img src={photoBefore} alt="Antes" className="w-full h-40 object-cover rounded" />
                    ) : (
                      <label className="cursor-pointer block">
                        <Camera className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500">Tire uma foto</p>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => handlePhotoUpload(e.target.files[0], 'before')}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Foto DEPOIS *</Label>
                  <div className="border-2 border-dashed rounded-lg p-4 text-center">
                    {photoAfter ? (
                      <img src={photoAfter} alt="Depois" className="w-full h-40 object-cover rounded" />
                    ) : (
                      <label className="cursor-pointer block">
                        <Camera className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500">Tire uma foto</p>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => handlePhotoUpload(e.target.files[0], 'after')}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observação</Label>
                <Textarea
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  rows={3}
                  placeholder="Adicione comentários sobre a execução..."
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSubmitCompletion} 
                  disabled={!photoBefore || !photoAfter || uploading}
                  className="bg-green-600"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {uploading ? 'Enviando...' : 'Concluir Tarefa'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}