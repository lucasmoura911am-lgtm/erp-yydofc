import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Plus, Eye, FileText, Clock, CheckCircle, Archive, MapPin, Camera, Shield, Monitor, Hash } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_COLORS = {
  "Pendente": "bg-yellow-100 text-yellow-800",
  "Assinado": "bg-green-100 text-green-800",
  "Arquivado": "bg-gray-100 text-gray-600"
};
const STATUS_ICONS = { "Pendente": Clock, "Assinado": CheckCircle, "Arquivado": Archive };

export default function DigitalSignatureAdmin() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Todos");
  const [selectedDoc, setSelectedDoc] = useState(null);

  useEffect(() => {
    base44.entities.DigitalSignature.list("-created_date", 100).then(d => { setDocs(d); setLoading(false); });
  }, []);

  const filtered = docs.filter(d => {
    const matchFilter = filter === "Todos" || d.status === filter;
    const matchSearch = !search || d.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
      d.document_type?.toLowerCase().includes(search.toLowerCase()) ||
      d.protocol_number?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const counts = { Pendente: docs.filter(d => d.status === "Pendente").length, Assinado: docs.filter(d => d.status === "Assinado").length, Arquivado: docs.filter(d => d.status === "Arquivado").length };

  const archiveDoc = async (id) => {
    await base44.entities.DigitalSignature.update(id, { status: "Arquivado" });
    setDocs(prev => prev.map(d => d.id === id ? { ...d, status: "Arquivado" } : d));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6 text-purple-600" /> Assinaturas Digitais</h1>
          <p className="text-gray-500 text-sm">Gerencie documentos enviados para assinatura</p>
        </div>
        <Link to="/DigitalSignatureSend">
          <Button className="bg-purple-600 hover:bg-purple-700 flex items-center gap-2"><Plus className="w-4 h-4" /> Enviar Documento</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[["Todos", docs.length, "bg-blue-50 border-blue-200 text-blue-700"],
          ["Pendente", counts.Pendente, "bg-yellow-50 border-yellow-200 text-yellow-700"],
          ["Assinado", counts.Assinado, "bg-green-50 border-green-200 text-green-700"],
          ["Arquivado", counts.Arquivado, "bg-gray-50 border-gray-200 text-gray-600"]].map(([label, count, cls]) => (
          <Card key={label} className={`border cursor-pointer ${cls} ${filter === label ? "ring-2 ring-purple-400" : ""}`} onClick={() => setFilter(label)}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-sm">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <Input placeholder="Buscar por colaborador, tipo ou protocolo..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Nenhum documento encontrado</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-3 text-gray-600 font-medium">Protocolo</th>
                    <th className="text-left p-3 text-gray-600 font-medium">Colaborador</th>
                    <th className="text-left p-3 text-gray-600 font-medium">Tipo</th>
                    <th className="text-left p-3 text-gray-600 font-medium">Prazo</th>
                    <th className="text-left p-3 text-gray-600 font-medium">Status</th>
                    <th className="text-left p-3 text-gray-600 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(doc => {
                    const Icon = STATUS_ICONS[doc.status] || Clock;
                    return (
                      <tr key={doc.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-mono text-purple-700 font-medium">{doc.protocol_number}</td>
                        <td className="p-3">
                          <p className="font-medium">{doc.employee_name}</p>
                          <p className="text-xs text-gray-400">{doc.employee_position}</p>
                        </td>
                        <td className="p-3">{doc.document_type}</td>
                        <td className="p-3">{doc.deadline}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[doc.status]}`}>
                            <Icon className="w-3 h-3" />{doc.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <a href={`/DigitalSignatureSign?id=${doc.id}`} target="_blank" rel="noreferrer">
                              <Button size="sm" variant="outline" className="flex items-center gap-1 text-xs"><Eye className="w-3 h-3" /> Ver</Button>
                            </a>
                            {doc.status !== "Arquivado" && (
                              <Button size="sm" variant="ghost" className="text-gray-400 hover:text-gray-600 text-xs" onClick={() => archiveDoc(doc.id)}>Arquivar</Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}