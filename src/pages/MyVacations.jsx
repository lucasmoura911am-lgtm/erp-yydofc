import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Clock, CheckCircle, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MyVacations() {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    start_date: "",
    end_date: "",
    notes: ""
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
    
    const employees = await base44.entities.Employee.filter({ user_email: userData.email });
    if (employees.length > 0) {
      setEmployee(employees[0]);
    }
  };

  const { data: vacations = [] } = useQuery({
    queryKey: ['vacations', employee?.id],
    queryFn: () => employee ? base44.entities.VacationRequest.filter({ employee_id: employee.id }, '-created_date') : [],
    enabled: !!employee,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.VacationRequest.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['vacations']);
      setDialogOpen(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setFormData({
      start_date: "",
      end_date: "",
      notes: ""
    });
  };

  const calculateDays = () => {
    if (formData.start_date && formData.end_date) {
      const days = differenceInDays(new Date(formData.end_date), new Date(formData.start_date)) + 1;
      return days > 0 ? days : 0;
    }
    return 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const days = calculateDays();
    if (days < 1) {
      alert("Selecione um período válido");
      return;
    }

    await createMutation.mutateAsync({
      employee_id: employee.id,
      company_id: employee.company_id,
      start_date: formData.start_date,
      end_date: formData.end_date,
      days: days,
      notes: formData.notes,
      status: "pendente"
    });
  };

  const statusColors = {
    pendente: "bg-yellow-100 text-yellow-800",
    aprovado: "bg-green-100 text-green-800",
    rejeitado: "bg-red-100 text-red-800"
  };

  const statusIcons = {
    pendente: Clock,
    aprovado: CheckCircle,
    rejeitado: XCircle
  };

  if (!employee) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Minhas Férias</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Solicite e acompanhe seus pedidos de férias
          </p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-gradient-to-r from-purple-600 to-blue-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Solicitar Férias
        </Button>
      </div>

      <div className="grid gap-4">
        {vacations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Nenhuma solicitação de férias
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Clique em "Solicitar Férias" para fazer seu primeiro pedido
              </p>
            </CardContent>
          </Card>
        ) : (
          vacations.map((vacation) => {
            const StatusIcon = statusIcons[vacation.status];
            return (
              <Card key={vacation.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <Badge className={statusColors[vacation.status]}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {vacation.status}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          {vacation.days} {vacation.days === 1 ? 'dia' : 'dias'}
                        </span>
                      </div>
                      
                      <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        {format(new Date(vacation.start_date), "dd/MM/yyyy")} até {format(new Date(vacation.end_date), "dd/MM/yyyy")}
                      </p>
                      
                      {vacation.notes && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          <strong>Observações:</strong> {vacation.notes}
                        </p>
                      )}
                      
                      {vacation.supervisor_notes && (
                        <Alert className={vacation.status === 'aprovado' ? 'bg-green-50' : 'bg-red-50'}>
                          <AlertDescription className={vacation.status === 'aprovado' ? 'text-green-800' : 'text-red-800'}>
                            <strong>Resposta do supervisor:</strong> {vacation.supervisor_notes}
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      <p className="text-xs text-gray-500 mt-3">
                        Solicitado em {format(new Date(vacation.created_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Férias</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Data de Início *</Label>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Data de Término *</Label>
              <Input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                required
              />
            </div>

            {formData.start_date && formData.end_date && (
              <Alert className="bg-blue-50">
                <AlertDescription className="text-blue-800">
                  <strong>Total:</strong> {calculateDays()} {calculateDays() === 1 ? 'dia' : 'dias'}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Adicione detalhes sobre sua solicitação (opcional)"
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-gradient-to-r from-purple-600 to-blue-600">
                Enviar Solicitação
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}