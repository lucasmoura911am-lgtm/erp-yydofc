import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, FileCheck, CheckCircle, MapPin, Monitor, Hash, Camera, FileText, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function SignedDocumentsPage() {
  const [user, setUser] = useState(null);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      base44.entities.DigitalSignature.filter({ company_id: u.company_id, status: "Assinado" })
        .then(d => { setDocs(d); setLoading(false); });
    });
  }, []);

  const filtered = docs.filter(d =>
    !search ||
    d.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
    d.document_type?.toLowerCase().includes(search.toLowerCase()) ||
    d.protocol_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-teal-600 rounded-xl flex items-center justify-center">
          <FileCheck className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Documentos Assinados Digitalmente</h1>
          <p className="text-gray-500 text-sm">{docs.length} documento{docs.length !== 1 ? "s" : ""} assinado{docs.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <Input placeholder="Buscar por colaborador, tipo ou protocolo..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum documento assinado encontrado</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-3 text-gray-600 font-medium">Protocolo</th>
                    <th className="text-left p-3 text-gray-600 font-medium">Colaborador</th>
                    <th className="text-left p-3 text-gray-600 font-medium">Tipo de Documento</th>
                    <th className="text-left p-3 text-gray-600 font-medium">Assinado em</th>
                    <th className="text-left p-3 text-gray-600 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(doc => (
                    <tr key={doc.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-mono text-purple-700 font-medium">{doc.protocol_number}</td>
                      <td className="p-3">
                        <p className="font-medium">{doc.employee_name}</p>
                        <p className="text-xs text-gray-400">{doc.employee_position}</p>
                      </td>
                      <td className="p-3">{doc.document_type}</td>
                      <td className="p-3 text-gray-500 text-xs">
                        {doc.signed_at ? format(new Date(doc.signed_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="text-xs flex items-center gap-1" onClick={() => setSelected(doc)}>
                            <CheckCircle className="w-3 h-3" /> Ver Evidências
                          </Button>
                          {doc.comprovante_url && (
                            <a href={doc.comprovante_url} target="_blank" rel="noreferrer">
                              <Button size="sm" variant="outline" className="text-xs flex items-center gap-1 text-green-700 border-green-300">
                                <ExternalLink className="w-3 h-3" /> Comprovante
                              </Button>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de evidências */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Evidências — {selected.protocol_number}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Colaborador</p>
                  <p className="font-semibold">{selected.employee_name}</p>
                  <p className="text-gray-400 text-xs">{selected.employee_position}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Documento</p>
                  <p className="font-semibold">{selected.document_type}</p>
                  <p className="text-gray-400 text-xs">{selected.file_name}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 col-span-2">
                  <p className="text-gray-500 text-xs mb-1">Assinado em</p>
                  <p className="font-semibold text-green-700">
                    {selected.signed_at ? format(new Date(selected.signed_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }) : "—"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">Evidências Coletadas</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded border border-blue-100">
                    <Monitor className="w-3 h-3 text-blue-500 shrink-0" />
                    <span><strong>IP:</strong> {selected.ip_address || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded border border-blue-100">
                    <MapPin className="w-3 h-3 text-blue-500 shrink-0" />
                    <span><strong>GPS:</strong> {selected.latitude && selected.longitude ? `${selected.latitude.toFixed(6)}, ${selected.longitude.toFixed(6)}` : "—"}</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 bg-blue-50 rounded border border-blue-100">
                    <Monitor className="w-3 h-3 text-blue-500 mt-0.5 shrink-0" />
                    <span className="break-all"><strong>Dispositivo:</strong> {selected.user_agent || "—"}</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 bg-blue-50 rounded border border-blue-100">
                    <Hash className="w-3 h-3 text-blue-500 mt-0.5 shrink-0" />
                    <span className="break-all font-mono"><strong>Hash SHA-256:</strong> {selected.hash_sha256 || "—"}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {selected.photo_url && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 flex items-center gap-1 mb-2"><Camera className="w-4 h-4" /> Foto</p>
                    <img src={selected.photo_url} alt="Foto" className="w-full rounded-lg border object-cover" style={{ transform: "scaleX(-1)", maxHeight: 160 }} />
                  </div>
                )}
                {selected.signature_image && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">Assinatura</p>
                    <div className="bg-white border rounded-lg p-3">
                      <img src={selected.signature_image} alt="Assinatura" className="w-full max-h-24 object-contain" />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                {selected.comprovante_url && (
                  <a href={selected.comprovante_url} target="_blank" rel="noreferrer" className="flex-1">
                    <Button variant="outline" className="w-full flex items-center gap-2 text-green-700 border-green-300">
                      <FileCheck className="w-4 h-4" /> Comprovante com Evidências (PDF)
                    </Button>
                  </a>
                )}
                {selected.file_url && (
                  <a href={selected.file_url} target="_blank" rel="noreferrer" className="flex-1">
                    <Button variant="outline" className="w-full flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Documento Original
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}