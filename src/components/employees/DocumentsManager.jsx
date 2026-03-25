import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Trash2, Eye, Plus, FileText, Loader2, FileCheck, Clock, CheckCircle, ExternalLink, Merge } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

const DOC_TYPES = {
  contrato: { label: "Contrato", color: "bg-blue-100 text-blue-700" },
  atestado: { label: "Atestado", color: "bg-yellow-100 text-yellow-700" },
  exame: { label: "Exame", color: "bg-purple-100 text-purple-700" },
  documento_pessoal: { label: "Doc. Pessoal", color: "bg-gray-100 text-gray-700" },
  ferias: { label: "Férias", color: "bg-green-100 text-green-700" },
  alteracao_salarial: { label: "Alt. Salarial", color: "bg-orange-100 text-orange-700" },
  alteracao_cargo: { label: "Alt. Cargo", color: "bg-indigo-100 text-indigo-700" },
  acidente_trabalho: { label: "Acidente", color: "bg-red-100 text-red-700" },
  outros: { label: "Outros", color: "bg-slate-100 text-slate-700" },
};

const EMPTY_FORM = { document_name: "", document_type: "outros", notes: "" };

export default function DocumentsManager({ employeeId, companyId, currentUserEmail, readOnly = false }) {
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [mergingId, setMergingId] = useState(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["employee-docs", employeeId],
    queryFn: () => base44.entities.EmployeeDocument.filter({ employee_id: employeeId }),
    enabled: !!employeeId,
  });

  const { data: digitalSigs = [] } = useQuery({
    queryKey: ["digital-sigs-employee", employeeId],
    queryFn: () => base44.entities.DigitalSignature.filter({ employee_id: employeeId }),
    enabled: !!employeeId,
  });

  const openMergedDoc = async (sig) => {
    if (!sig.file_url || !sig.comprovante_url) {
      window.open(sig.file_url || sig.comprovante_url, "_blank");
      return;
    }
    setMergingId(sig.id);
    try {
      const res = await base44.functions.invoke('mergePdfs', { pdf1_url: sig.file_url, pdf2_url: sig.comprovante_url });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e) {
      toast({ title: "Erro ao mesclar PDFs", description: e.message, variant: "destructive" });
    } finally {
      setMergingId(null);
    }
  };

  const createMut = useMutation({
    mutationFn: async (payload) => base44.entities.EmployeeDocument.create(payload),
    onSuccess: () => {
      qc.invalidateQueries(["employee-docs", employeeId]);
      setShowDialog(false);
      setForm(EMPTY_FORM);
      setFile(null);
      toast({ title: "Documento adicionado com sucesso!" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.EmployeeDocument.delete(id),
    onSuccess: () => {
      qc.invalidateQueries(["employee-docs", employeeId]);
      toast({ title: "Documento excluído" });
    },
  });

  const handleSubmit = async () => {
    if (!form.document_name.trim()) {
      return toast({ title: "Informe o nome do documento", variant: "destructive" });
    }
    if (!file) {
      return toast({ title: "Selecione um arquivo", variant: "destructive" });
    }

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await createMut.mutateAsync({
        ...form,
        employee_id: employeeId,
        company_id: companyId,
        file_url,
        upload_date: format(new Date(), "yyyy-MM-dd"),
        uploaded_by: currentUserEmail || "",
      });
    } finally {
      setUploading(false);
    }
  };

  const closeDialog = () => {
    setShowDialog(false);
    setForm(EMPTY_FORM);
    setFile(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando documentos...
      </div>
    );
  }

  const signedDigs = digitalSigs.filter(s => s.status === "Assinado");
  const pendingDigs = digitalSigs.filter(s => s.status === "Pendente");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <span className="font-semibold text-gray-800 dark:text-gray-200">
            Pasta do Colaborador
          </span>
          <Badge variant="outline">{documents.length} doc{documents.length !== 1 ? "s" : ""}</Badge>
        </div>
        {!readOnly && (
          <Button size="sm" onClick={() => setShowDialog(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-1" /> Adicionar Documento
          </Button>
        )}
      </div>

      {/* Documents list */}
      {documents.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed rounded-lg text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum documento arquivado</p>
          {!readOnly && (
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowDialog(true)}>
              <Upload className="w-4 h-4 mr-1" /> Adicionar primeiro documento
            </Button>
          )}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Documento</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Enviado por</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map(doc => (
              <TableRow key={doc.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{doc.document_name}</p>
                    {doc.notes && <p className="text-xs text-gray-400 truncate max-w-[200px]">{doc.notes}</p>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={`text-xs ${DOC_TYPES[doc.document_type]?.color || "bg-gray-100 text-gray-700"}`}>
                    {DOC_TYPES[doc.document_type]?.label || doc.document_type}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {doc.upload_date ? format(new Date(doc.upload_date + "T00:00:00"), "dd/MM/yyyy") : "—"}
                </TableCell>
                <TableCell className="text-xs text-gray-400">{doc.uploaded_by || "—"}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(doc.file_url, "_blank")}
                      title="Visualizar"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    {!readOnly && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-500 hover:bg-red-50"
                        onClick={() => { if (confirm("Excluir este documento?")) deleteMut.mutate(doc.id); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Assinaturas Digitais */}
      {digitalSigs.length > 0 && (
        <div className="space-y-3 mt-4">
          <div className="flex items-center gap-2 border-t pt-4">
            <FileCheck className="w-5 h-5 text-purple-600" />
            <span className="font-semibold text-gray-800 dark:text-gray-200">Assinaturas Digitais</span>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{digitalSigs.length}</span>
          </div>
          <div className="space-y-2">
            {digitalSigs.map(sig => (
              <div key={sig.id} className="flex items-center justify-between gap-3 bg-gray-50 border rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-800 truncate">{sig.document_type}</p>
                  <p className="text-xs text-gray-500 font-mono">{sig.protocol_number}</p>
                  <p className="text-xs text-gray-400">Prazo: {sig.deadline}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {sig.status === "Pendente" ? (
                    <>
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Pendente
                      </span>
                      <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white text-xs"
                        onClick={() => window.open(`/DigitalSignatureSign?id=${sig.id}`, "_blank")}>
                        ✍️ Assinar
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Assinado
                      </span>
                      <Button size="sm" variant="outline" className="text-xs" disabled={mergingId === sig.id}
                        onClick={() => openMergedDoc(sig)}>
                        {mergingId === sig.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3 mr-1" />}
                        Doc + Comprovante
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showDialog} onOpenChange={open => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" /> Adicionar Documento
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label>Nome do documento *</Label>
              <Input
                value={form.document_name}
                onChange={e => setForm({ ...form, document_name: e.target.value })}
                placeholder="Ex: Contrato de trabalho, Atestado médico..."
              />
            </div>

            <div>
              <Label>Tipo de documento</Label>
              <Select value={form.document_type} onValueChange={v => setForm({ ...form, document_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Arquivo *</Label>
              <div className="mt-1">
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div className="text-center">
                    {file ? (
                      <div className="flex items-center gap-2 text-blue-600">
                        <FileText className="w-5 h-5" />
                        <span className="text-sm font-medium">{file.name}</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                        <p className="text-sm text-gray-500">Clique para selecionar o arquivo</p>
                        <p className="text-xs text-gray-400">PDF, JPG, PNG, DOCX</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={e => setFile(e.target.files[0] || null)}
                  />
                </label>
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Informações adicionais sobre o documento..."
                className="h-20"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={uploading}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={uploading || !form.document_name.trim() || !file}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" /> Salvar Documento</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}