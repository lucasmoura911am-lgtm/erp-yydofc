import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileCheck, Calendar, FileText, Clock, CheckCircle, XCircle, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function ManageAbsenceJustifications() {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [reviewDialog, setReviewDialog] = useState(false);
  const [selectedJustification, setSelectedJustification] = useState(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const { data: justifications = [] } = useQuery({
    queryKey: ['allAbsenceJustifications', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.AbsenceJustification.filter({ company_id: user.company_id }, '-created_date') : [],
    enabled: !!user?.company_id,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Employee.filter({ company_id: user.company_id }) : [],
    enabled: !!user?.company_id,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, notes }) => {
      return await base44.entities.AbsenceJustification.update(id, {
        status,
        review_notes: notes,
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allAbsenceJustifications'] });
      toast.success("Justificativa atualizada com sucesso!");
      setReviewDialog(false);
      setSelectedJustification(null);
      setReviewNotes("");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar justificativa: " + error.message);
    }
  });

  const handleReview = (justification, status) => {
    setSelectedJustification(justification);
    setReviewDialog(true);
  };

  const handleSubmitReview = (status) => {
    if (selectedJustification) {
      updateMutation.mutate({
        id: selectedJustification.id,
        status,
        notes: reviewNotes
      });
    }
  };

  const getEmployeeName = (employeeId) => {
    const emp = employees.find(e => e.id === employeeId);
    return emp?.full_name || "Funcionário não encontrado";
  };

  const getStatusBadge = (status) => {
    const config = {
      pendente: { label: "Pendente", variant: "outline", icon: Clock },
      aprovado: { label: "Aprovado", variant: "default", icon: CheckCircle, className: "bg-green-500" },
      rejeitado: { label: "Rejeitado", variant: "destructive", icon: XCircle }
    };
    const { label, variant, icon: Icon, className } = config[status] || config.pendente;
    return <Badge variant={variant} className={className}><Icon className="w-3 h-3 mr-1" />{label}</Badge>;
  };

  const getTypeLabel = (type) => {
    const types = {
      atestado_medico: "Atestado Médico",
      atestado_odontologico: "Atestado Odontológico",
      licenca_maternidade: "Licença Maternidade",
      licenca_paternidade: "Licença Paternidade",
      casamento: "Casamento",
      falecimento: "Falecimento",
      outro: "Outro"
    };
    return types[type] || type;
  };

  const filteredJustifications = justifications.filter(just => {
    const employeeName = getEmployeeName(just.employee_id).toLowerCase();
    return employeeName.includes(searchTerm.toLowerCase());
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Justificativas de Falta</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Gerencie as justificativas de falta dos funcionários
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Buscar por funcionário..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Todas as Justificativas</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredJustifications.length === 0 ? (
            <div className="text-center py-12">
              <FileCheck className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Nenhuma justificativa encontrada
              </h3>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Data da Falta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJustifications.map((just) => (
                  <TableRow key={just.id}>
                    <TableCell className="font-medium">{getEmployeeName(just.employee_id)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {format(new Date(just.absence_date), "dd/MM/yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>{getTypeLabel(just.justification_type)}</TableCell>
                    <TableCell>{getStatusBadge(just.status)}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {format(new Date(just.created_date), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(just.file_url, '_blank')}
                        >
                          <FileText className="w-4 h-4 mr-1" />
                          Ver
                        </Button>
                        {just.status === "pendente" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReview(just)}
                          >
                            Analisar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={reviewDialog} onOpenChange={setReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Analisar Justificativa</DialogTitle>
          </DialogHeader>
          {selectedJustification && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Funcionário:</p>
                <p className="text-base">{getEmployeeName(selectedJustification.employee_id)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Data da Falta:</p>
                <p className="text-base">{format(new Date(selectedJustification.absence_date), "dd/MM/yyyy")}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo:</p>
                <p className="text-base">{getTypeLabel(selectedJustification.justification_type)}</p>
              </div>
              {selectedJustification.notes && (
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Observações do funcionário:</p>
                  <p className="text-base">{selectedJustification.notes}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Observações da análise:</label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Adicione comentários sobre a análise..."
                  rows={3}
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setReviewDialog(false)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleSubmitReview("rejeitado")}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Rejeitar
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleSubmitReview("aprovado")}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Aprovar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}