import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileText, Upload, Trash2, Download, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function DocumentsManager({ employeeId, companyId }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    document_name: "",
    document_type: "outros",
    notes: ""
  });
  const [selectedFile, setSelectedFile] = useState(null);

  const queryClient = useQueryClient();

  const { data: documents = [] } = useQuery({
    queryKey: ['employeeDocuments', employeeId],
    queryFn: () => base44.entities.EmployeeDocument.filter({ employee_id: employeeId }, '-upload_date'),
    enabled: !!employeeId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.EmployeeDocument.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['employeeDocuments']);
      setDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.EmployeeDocument.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['employeeDocuments']);
    },
  });

  const resetForm = () => {
    setFormData({ document_name: "", document_type: "outros", notes: "" });
    setSelectedFile(null);
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !formData.document_name) {
      alert('Preencha o nome do documento e selecione um arquivo');
      return;
    }

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });
      
      const user = await base44.auth.me();
      
      await createMutation.mutateAsync({
        employee_id: employeeId,
        company_id: companyId,
        document_name: formData.document_name,
        document_type: formData.document_type,
        file_url,
        upload_date: new Date().toISOString().split('T')[0],
        uploaded_by: user.email,
        notes: formData.notes
      });

      alert('Documento enviado com sucesso!');
    } catch (error) {
      alert('Erro ao enviar documento: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (id) => {
    if (confirm('Tem certeza que deseja excluir este documento?')) {
      deleteMutation.mutate(id);
    }
  };

  const documentTypeLabels = {
    contrato: "Contrato",
    atestado: "Atestado",
    exame: "Exame",
    documento_pessoal: "Documento Pessoal",
    ferias: "Férias",
    alteracao_salarial: "Alteração Salarial",
    alteracao_cargo: "Alteração de Cargo",
    acidente_trabalho: "Acidente de Trabalho",
    outros: "Outros"
  };

  const documentTypeColors = {
    contrato: "bg-blue-100 text-blue-800",
    atestado: "bg-yellow-100 text-yellow-800",
    exame: "bg-green-100 text-green-800",
    documento_pessoal: "bg-purple-100 text-purple-800",
    ferias: "bg-pink-100 text-pink-800",
    alteracao_salarial: "bg-orange-100 text-orange-800",
    alteracao_cargo: "bg-indigo-100 text-indigo-800",
    acidente_trabalho: "bg-red-100 text-red-800",
    outros: "bg-gray-100 text-gray-800"
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Pasta do Colaborador ({documents.length})
          </CardTitle>
          <Button onClick={() => setDialogOpen(true)} size="sm" className="bg-gradient-to-r from-purple-600 to-blue-600">
            <Upload className="w-4 h-4 mr-2" />
            Adicionar Documento
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {documents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum documento cadastrado</p>
            </div>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3 flex-1">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div className="flex-1">
                    <p className="font-medium">{doc.document_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={documentTypeColors[doc.document_type]}>
                        {documentTypeLabels[doc.document_type]}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {doc.upload_date && format(new Date(doc.upload_date + 'T00:00:00'), 'dd/MM/yyyy')} • {doc.uploaded_by}
                      </span>
                    </div>
                    {doc.notes && <p className="text-xs text-gray-600 mt-1">{doc.notes}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => window.open(doc.file_url, '_blank')} title="Visualizar">
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => window.open(doc.file_url, '_blank')} title="Download">
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(doc.id)} className="text-red-600 hover:text-red-700" title="Excluir">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Adicionar Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Documento *</Label>
              <Input value={formData.document_name} onChange={(e) => setFormData({ ...formData, document_name: e.target.value })} placeholder="Ex: Contrato de Trabalho" />
            </div>
            <div className="space-y-2">
              <Label>Tipo do Documento *</Label>
              <Select value={formData.document_type} onValueChange={(value) => setFormData({ ...formData, document_type: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(documentTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Arquivo *</Label>
              <Input type="file" onChange={(e) => setSelectedFile(e.target.files[0])} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} placeholder="Observações sobre o documento..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} type="button">Cancelar</Button>
            <Button onClick={handleFileUpload} disabled={uploading} className="bg-gradient-to-r from-purple-600 to-blue-600" type="button">
              {uploading ? 'Enviando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}