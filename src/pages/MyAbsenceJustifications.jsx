import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileCheck, Upload, Calendar, FileText, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function MyAbsenceJustifications() {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    absence_date: "",
    justification_type: "atestado_medico",
    file: null,
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

  const { data: justifications = [] } = useQuery({
    queryKey: ['myAbsenceJustifications', employee?.id],
    queryFn: () => employee ? base44.entities.AbsenceJustification.filter({ employee_id: employee.id }, '-created_date') : [],
    enabled: !!employee,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.AbsenceJustification.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myAbsenceJustifications'] });
      toast.success("Justificativa enviada com sucesso!");
      resetForm();
    },
    onError: (error) => {
      toast.error("Erro ao enviar justificativa: " + error.message);
    }
  });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, file });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.file) {
      toast.error("Por favor, anexe o documento");
      return;
    }

    setUploading(true);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: formData.file });

      const data = {
        employee_id: employee.id,
        company_id: employee.company_id,
        absence_date: formData.absence_date,
        justification_type: formData.justification_type,
        file_url: file_url,
        notes: formData.notes,
        status: "pendente"
      };

      createMutation.mutate(data);
    } catch (error) {
      toast.error("Erro ao fazer upload do arquivo");
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      absence_date: "",
      justification_type: "atestado_medico",
      file: null,
      notes: ""
    });
    setDialogOpen(false);
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

  if (!user || !employee) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Justificativas de Falta</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Justifique suas faltas enviando atestados e documentos
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-purple-600 to-blue-600">
              <FileCheck className="w-4 h-4 mr-2" />
              Nova Justificativa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Enviar Justificativa de Falta</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data da Falta *</Label>
                  <Input
                    type="date"
                    required
                    value={formData.absence_date}
                    onChange={(e) => setFormData({ ...formData, absence_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Tipo de Justificativa *</Label>
                  <Select
                    required
                    value={formData.justification_type}
                    onValueChange={(value) => setFormData({ ...formData, justification_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="atestado_medico">Atestado Médico</SelectItem>
                      <SelectItem value="atestado_odontologico">Atestado Odontológico</SelectItem>
                      <SelectItem value="licenca_maternidade">Licença Maternidade</SelectItem>
                      <SelectItem value="licenca_paternidade">Licença Paternidade</SelectItem>
                      <SelectItem value="casamento">Casamento</SelectItem>
                      <SelectItem value="falecimento">Falecimento</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Documento Comprobatório *</Label>
                <Input
                  type="file"
                  required
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
                <p className="text-xs text-gray-500 mt-1">Formatos aceitos: PDF, JPG, PNG</p>
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea
                  placeholder="Adicione informações adicionais se necessário..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={uploading}>
                  {uploading ? (
                    <>
                      <Upload className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Enviar Justificativa
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Minhas Justificativas</CardTitle>
        </CardHeader>
        <CardContent>
          {justifications.length === 0 ? (
            <div className="text-center py-12">
              <FileCheck className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Nenhuma justificativa enviada
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Quando você justificar uma falta, ela aparecerá aqui.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data da Falta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead>Documento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {justifications.map((just) => (
                  <TableRow key={just.id}>
                    <TableCell className="font-medium">
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
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(just.file_url, '_blank')}
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}