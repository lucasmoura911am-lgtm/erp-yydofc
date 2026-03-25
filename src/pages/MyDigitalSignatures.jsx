import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PenLine, Clock, CheckCircle, FileText, Eye, Loader2, Archive } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_CONFIG = {
  Pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  Assinado: { label: "Assinado", color: "bg-green-100 text-green-800", icon: CheckCircle },
  Arquivado: { label: "Arquivado", color: "bg-gray-100 text-gray-600", icon: Archive },
};

export default function MyDigitalSignatures() {
  const [employee, setEmployee] = useState(null);
  const [loadingEmployee, setLoadingEmployee] = useState(true);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      const emps = await base44.entities.Employee.filter({ user_email: u.email });
      if (emps.length > 0) setEmployee(emps[0]);
      setLoadingEmployee(false);
    });
  }, []);

  const { data: signatures = [], isLoading } = useQuery({
    queryKey: ["my-digital-signatures", employee?.id],
    queryFn: () => base44.entities.DigitalSignature.filter({ employee_id: employee.id }),
    enabled: !!employee?.id,
  });

  const pending = signatures.filter(s => s.status === "Pendente");
  const signed = signatures.filter(s => s.status === "Assinado");
  const archived = signatures.filter(s => s.status === "Arquivado");

  if (loadingEmployee || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-6 text-center py-20 text-gray-400">
        <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>Nenhum registro de funcionário vinculado à sua conta.</p>
        <p className="text-sm mt-1">Entre em contato com o RH.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
          <PenLine className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Minhas Assinaturas Digitais</h1>
          <p className="text-gray-500 text-sm">Documentos enviados para você assinar</p>
        </div>
      </div>

      {/* Pendentes */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2">
          <Clock className="w-4 h-4 text-yellow-500" />
          Aguardando Assinatura
          {pending.length > 0 && <span className="bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-0.5 rounded-full">{pending.length}</span>}
        </h2>

        {pending.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed rounded-xl text-gray-400">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum documento pendente de assinatura</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map(sig => (
              <Card key={sig.id} className="border-orange-200 bg-orange-50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-semibold text-gray-900">{sig.document_type}</p>
                      <p className="text-xs text-gray-500 font-mono">Protocolo: {sig.protocol_number}</p>
                      <p className="text-xs text-gray-500">Prazo: {sig.deadline}</p>
                      {sig.message && (
                        <p className="text-xs text-orange-700 bg-orange-100 rounded p-2 mt-1">{sig.message}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      {sig.file_url && (
                        <Button size="sm" variant="outline" onClick={() => window.open(sig.file_url, "_blank")}>
                          <Eye className="w-3 h-3 mr-1" /> Ver doc.
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                        onClick={() => window.open(`/DigitalSignatureSign?id=${sig.id}`, "_blank")}
                      >
                        <PenLine className="w-3 h-3 mr-1" /> Assinar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Assinados */}
      {signed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Assinados
          </h2>
          <div className="space-y-2">
            {signed.map(sig => (
              <Card key={sig.id} className="border-green-200">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm text-gray-900">{sig.document_type}</p>
                    <p className="text-xs text-gray-400 font-mono">Protocolo: {sig.protocol_number}</p>
                    {sig.signed_at && (
                      <p className="text-xs text-gray-400">
                        Assinado em: {format(new Date(sig.signed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className="bg-green-100 text-green-700 text-xs">Assinado</Badge>
                    {sig.comprovante_url && (
                      <Button size="sm" variant="outline" onClick={() => window.open(sig.comprovante_url, "_blank")}>
                        <FileText className="w-3 h-3 mr-1" /> Comprovante
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Arquivados */}
      {archived.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2">
            <Archive className="w-4 h-4 text-gray-400" />
            Arquivados
          </h2>
          <div className="space-y-2">
            {archived.map(sig => (
              <Card key={sig.id} className="border-gray-200 opacity-70">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-sm text-gray-700">{sig.document_type}</p>
                    <p className="text-xs text-gray-400 font-mono">Protocolo: {sig.protocol_number}</p>
                  </div>
                  <Badge className="bg-gray-100 text-gray-500 text-xs">Arquivado</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {signatures.length === 0 && !isLoading && (
        <div className="text-center py-16 border-2 border-dashed rounded-xl text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum documento enviado para você ainda</p>
        </div>
      )}
    </div>
  );
}