import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle, XCircle, Clock, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ManageVacations() {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedVacation, setSelectedVacation] = useState(null);
  const [supervisorNotes, setSupervisorNotes] = useState("");

  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const { data: vacations = [] } = useQuery({
    queryKey: ['allVacations', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.VacationRequest.filter({ company_id: user.company_id }, '-created_date') : [],
    enabled: !!user?.company_id,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Employee.filter({ company_id: user.company_id }) : [],
    enabled: !!user?.company_id,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.VacationRequest.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['allVacations']);
      setDialogOpen(false);
      setSelectedVacation(null);
      setSupervisorNotes("");
    },
  });

  const handleAction = (vacation, action) => {
    setSelectedVacation(vacation);
    setDialogOpen(true);
  };

  const handleApprove = async () => {
    await updateMutation.mutateAsync({
      id: selectedVacation.id,
      data: {
        status: "aprovado",
        supervisor_notes: supervisorNotes,
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString()
      }
    });
  };

  const handleReject = async () => {
    await updateMutation.mutateAsync({
      id: selectedVacation.id,
      data: {
        status: "rejeitado",
        supervisor_notes: supervisorNotes,
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString()
      }
    });
  };

  const getEmployeeName = (id) => {
    const employee = employees.find(e => e.id === id);
    return employee ? employee.full_name : "Desconhecido";
  };

  const filteredVacations = vacations.filter(vacation => {
    const employeeName = getEmployeeName(vacation.employee_id).toLowerCase();
    return employeeName.includes(searchTerm.toLowerCase());
  });

  const pendingCount = vacations.filter(v => v.status === 'pendente').length;
  const approvedCount = vacations.filter(v => v.status === 'aprovado').length;
  const rejectedCount = vacations.filter(v => v.status === 'rejeitado').length;

  const statusColors = {
    pendente: "bg-yellow-100 text-yellow-800",
    aprovado: "bg-green-100 text-green-800",
    rejeitado: "bg-red-100 text-red-800"
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Gestão de Férias</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Analise e aprove solicitações de férias
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-yellow-50 to-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              <p className="text-3xl font-bold text-yellow-600">{pendingCount}</p>
            </div>
            <p className="text-sm text-gray-600 mt-1">Pendentes</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-3xl font-bold text-green-600">{approvedCount}</p>
            </div>
            <p className="text-sm text-gray-600 mt-1">Aprovados</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-pink-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <p className="text-3xl font-bold text-red-600">{rejectedCount}</p>
            </div>
            <p className="text-sm text-gray-600 mt-1">Rejeitados</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Buscar por funcionário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {filteredVacations.map((vacation) => (
          <Card key={vacation.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {getEmployeeName(vacation.employee_id)}
                    </p>
                    <Badge className={statusColors[vacation.status]}>
                      {vacation.status}
                    </Badge>
                  </div>
                  
                  <p className="text-gray-700 dark:text-gray-300 mb-2">
                    📅 {format(new Date(vacation.start_date), "dd/MM/yyyy")} até {format(new Date(vacation.end_date), "dd/MM/yyyy")}
                  </p>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    <strong>Total:</strong> {vacation.days} {vacation.days === 1 ? 'dia' : 'dias'}
                  </p>
                  
                  {vacation.notes && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <strong>Observações:</strong> {vacation.notes}
                    </p>
                  )}
                  
                  {vacation.supervisor_notes && (
                    <Alert className={vacation.status === 'aprovado' ? 'bg-green-50' : 'bg-red-50'}>
                      <AlertDescription className={vacation.status === 'aprovado' ? 'text-green-800' : 'text-red-800'}>
                        <strong>Sua resposta:</strong> {vacation.supervisor_notes}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <p className="text-xs text-gray-500 mt-3">
                    Solicitado em {format(new Date(vacation.created_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                
                {vacation.status === 'pendente' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-600 hover:bg-red-50"
                      onClick={() => {
                        setSelectedVacation(vacation);
                        setDialogOpen(true);
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Rejeitar
                    </Button>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        setSelectedVacation(vacation);
                        setDialogOpen(true);
                      }}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Aprovar
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Analisar Solicitação de Férias</DialogTitle>
          </DialogHeader>
          {selectedVacation && (
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <p className="font-semibold mb-2">{getEmployeeName(selectedVacation.employee_id)}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {format(new Date(selectedVacation.start_date), "dd/MM/yyyy")} até {format(new Date(selectedVacation.end_date), "dd/MM/yyyy")} ({selectedVacation.days} dias)
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Observações (opcional)</Label>
                <Textarea
                  value={supervisorNotes}
                  onChange={(e) => setSupervisorNotes(e.target.value)}
                  placeholder="Adicione observações sobre sua decisão..."
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700"
                  onClick={handleReject}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Rejeitar
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleApprove}
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Aprovar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}