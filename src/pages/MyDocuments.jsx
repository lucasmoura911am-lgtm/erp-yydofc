import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Eye, Folder, Loader2, PenLine, Clock, CheckCircle } from "lucide-react";
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

export default function MyDocuments() {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      const emps = await base44.entities.Employee.filter({ user_email: u.email });
      if (emps.length > 0) setEmployee(emps[0]);
    });
  }, []);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["my-docs", employee?.id],
    queryFn: () => base44.entities.EmployeeDocument.filter({ employee_id: employee.id }),
    enabled: !!employee?.id,
  });

  const { data: pendingSignatures = [] } = useQuery({
    queryKey: ["my-signatures", employee?.id],
    queryFn: () => base44.entities.DigitalSignature.filter({ employee_id: employee.id }),
    enabled: !!employee?.id,
  });

  if (!employee && !isLoading) {
    return (
      <div className="p-6 text-center py-20 text-gray-400">
        <Folder className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>Nenhum registro de funcionário vinculado à sua conta.</p>
        <p className="text-sm mt-1">Entre em contato com o RH.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
          <Folder className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Meus Documentos</h1>
          <p className="text-gray-500 text-sm">Documentos arquivados pelo RH</p>
        </div>
      </div>

      {/* Assinaturas Digitais Pendentes */}
      {pendingSignatures.filter(s => s.status === "Pendente").length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <PenLine className="w-5 h-5 text-orange-500" />
            Documentos Aguardando sua Assinatura
          </h2>
          <div className="space-y-2">
            {pendingSignatures.filter(s => s.status === "Pendente").map(sig => (
              <Card key={sig.id} className="border-orange-200 bg-orange-50">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{sig.document_type}</p>
                      <p className="text-xs text-gray-500">Protocolo: {sig.protocol_number} · Prazo: {sig.deadline}</p>
                      {sig.message && <p className="text-xs text-orange-700 mt-0.5">{sig.message}</p>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="bg-orange-500 hover:bg-orange-600 text-white shrink-0"
                    onClick={() => window.open(`/DigitalSignatureSign?id=${sig.id}`, "_blank")}
                  >
                    <PenLine className="w-4 h-4 mr-1" /> Assinar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Documentos já assinados digitalmente */}
      {pendingSignatures.filter(s => s.status === "Assinado").length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Documentos Assinados
          </h2>
          <div className="space-y-2">
            {pendingSignatures.filter(s => s.status === "Assinado").map(sig => (
              <Card key={sig.id} className="border-green-200 bg-green-50">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{sig.document_type}</p>
                      <p className="text-xs text-gray-500">Protocolo: {sig.protocol_number}</p>
                    </div>
                  </div>
                  {sig.comprovante_url && (
                    <Button size="sm" variant="outline" onClick={() => window.open(sig.comprovante_url, "_blank")}>
                      <Eye className="w-4 h-4 mr-1" /> Comprovante
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Documentos do RH */}
      <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
        <Folder className="w-5 h-5 text-blue-500" />
        Documentos do RH
      </h2>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando...
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum documento disponível ainda</p>
          <p className="text-sm text-gray-400 mt-1">O RH irá adicionar seus documentos aqui</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Visualizar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map(doc => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                        <div>
                          <p className="font-medium text-sm">{doc.document_name}</p>
                          {doc.notes && <p className="text-xs text-gray-400">{doc.notes}</p>}
                        </div>
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
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(doc.file_url, "_blank")}
                      >
                        <Eye className="w-4 h-4 mr-1" /> Abrir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}