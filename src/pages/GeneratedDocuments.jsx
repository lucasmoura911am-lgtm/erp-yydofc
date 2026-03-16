import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Eye, Trash2, Download, Printer, Search, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function GeneratedDocuments() {
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState(null);
  const qc = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["generated-docs", user?.company_id],
    queryFn: () => base44.entities.GeneratedDocument.filter({ company_id: user.company_id }, "-generated_date"),
    enabled: !!user?.company_id,
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.GeneratedDocument.delete(id),
    onSuccess: () => qc.invalidateQueries(["generated-docs"]),
  });

  const filtered = docs.filter(
    (d) =>
      !search ||
      d.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
      d.template_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handlePrint = (doc) => {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>${doc.template_name}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.6; padding: 40px; color: #000; }
      @media print { .no-print { display:none; } }
    </style></head><body>
    ${doc.generated_html}
    <div class="no-print" style="position:fixed;bottom:20px;right:20px;">
      <button onclick="window.print()" style="background:#6366f1;color:#fff;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;">
        🖨️ Imprimir / PDF
      </button>
    </div>
    </body></html>`;
    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
  };

  const handleDownload = (doc) => {
    const blob = new Blob(
      [`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${doc.template_name}</title></head><body style="font-family:Arial;padding:40px">${doc.generated_html}</body></html>`],
      { type: "text/html" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${doc.template_name}_${doc.employee_name}_${doc.generated_date}.html`;
    a.click();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Documentos Gerados</h1>
        <p className="text-gray-500 mt-1">Histórico de todos os documentos gerados</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Buscar por funcionário ou template..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <FileText className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Nenhum documento gerado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="text-left px-4 py-3">Funcionário</th>
                <th className="text-left px-4 py-3">Template</th>
                <th className="text-center px-4 py-3">Data</th>
                <th className="text-center px-4 py-3">Gerado por</th>
                <th className="text-center px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc, i) => (
                <tr
                  key={doc.id}
                  className={`border-t border-gray-100 dark:border-gray-700 ${
                    i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/50"
                  }`}
                >
                  <td className="px-4 py-3 font-medium">{doc.employee_name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{doc.template_name}</td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {doc.generated_date ? format(new Date(doc.generated_date), "dd/MM/yyyy") : "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500 text-xs">{doc.generated_by || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setViewing(doc)} title="Visualizar">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handlePrint(doc)} title="Imprimir/PDF">
                        <Printer className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDownload(doc)} title="Baixar HTML">
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => deleteMut.mutate(doc.id)} title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{viewing?.template_name} — {viewing?.employee_name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-white rounded-lg border p-8">
            <div
              style={{ fontFamily: "Arial, sans-serif", fontSize: "11pt", lineHeight: 1.6 }}
              dangerouslySetInnerHTML={{ __html: viewing?.generated_html || "" }}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setViewing(null)}>Fechar</Button>
            <Button onClick={() => handleDownload(viewing)} variant="outline"><Download className="w-4 h-4 mr-2" />HTML</Button>
            <Button onClick={() => handlePrint(viewing)} className="bg-gradient-to-r from-purple-600 to-blue-600"><Printer className="w-4 h-4 mr-2" />Imprimir/PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}