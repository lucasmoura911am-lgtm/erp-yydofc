import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, Search, ClipboardList, Eye } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS = {
  rascunho: "bg-gray-100 text-gray-600",
  gerado: "bg-blue-100 text-blue-700",
  assinado: "bg-green-100 text-green-700",
};

export default function EPIRecords() {
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", user?.company_id],
    queryFn: () => base44.entities.Employee.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id,
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ["epi-deliveries", user?.company_id],
    queryFn: () => base44.entities.EPIDelivery.filter({ company_id: user.company_id }, "-created_date"),
    enabled: !!user?.company_id,
  });

  const { data: allItems = [] } = useQuery({
    queryKey: ["epi-delivery-items"],
    queryFn: () => base44.entities.EPIDeliveryItem.list(),
    enabled: !!user?.company_id,
  });

  const { data: epis = [] } = useQuery({
    queryKey: ["epis", user?.company_id],
    queryFn: () => base44.entities.EPI.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id,
  });

  const { data: company } = useQuery({
    queryKey: ["company", user?.company_id],
    queryFn: async () => {
      const list = await base44.entities.Company.filter({ id: user.company_id });
      return list[0] || null;
    },
    enabled: !!user?.company_id,
  });

  const filtered = deliveries.filter(d => {
    const emp = employees.find(e => e.id === d.employee_id);
    return emp?.full_name?.toLowerCase().includes(search.toLowerCase());
  });

  const generatePDF = (delivery) => {
    const emp = employees.find(e => e.id === delivery.employee_id);
    const dItems = allItems.filter(i => i.delivery_id === delivery.id);

    const rows = dItems.map(item => `
      <tr>
        <td style="border:1px solid #ccc;padding:8px">${item.epi_name || "—"}</td>
        <td style="border:1px solid #ccc;padding:8px;text-align:center">${item.quantity}</td>
        <td style="border:1px solid #ccc;padding:8px;text-align:center">${item.ca_number || "—"}</td>
        <td style="border:1px solid #ccc;padding:8px;text-align:center">${item.validity_date ? format(new Date(item.validity_date + "T00:00:00"), "dd/MM/yyyy") : "—"}</td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Ficha de EPI - ${emp?.full_name}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; padding: 30px; }
      h1 { font-size: 14pt; text-align: center; margin-bottom: 4px; text-transform: uppercase; }
      h2 { font-size: 11pt; text-align: center; color: #444; margin-bottom: 20px; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; border: 1px solid #ccc; padding: 12px; border-radius: 4px; }
      .info-item label { font-size: 8pt; color: #666; display: block; text-transform: uppercase; }
      .info-item span { font-weight: bold; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
      th { background: #f0f0f0; border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 9pt; text-transform: uppercase; }
      .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
      .sig-box { text-align: center; }
      .sig-line { border-top: 1px solid #000; margin: 60px 20px 8px; }
      .footer { margin-top: 30px; font-size: 8pt; color: #666; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
      .legal { font-size: 8pt; color: #444; margin-bottom: 20px; padding: 8px; border: 1px solid #eee; background: #fafafa; }
      @media print { .no-print { display: none; } }
    </style></head><body>
    ${company?.logo_url ? `<div style="text-align:center;margin-bottom:16px"><img src="${company.logo_url}" style="max-height:60px;max-width:200px"></div>` : ""}
    <h1>${company?.name || "EMPRESA"}</h1>
    <h2>Ficha de Controle e Entrega de EPI</h2>
    <div class="info-grid">
      <div class="info-item"><label>Funcionário</label><span>${emp?.full_name || "—"}</span></div>
      <div class="info-item"><label>CPF</label><span>${emp?.cpf || "—"}</span></div>
      <div class="info-item"><label>Cargo / Função</label><span>${emp?.job_function || emp?.category || "—"}</span></div>
      <div class="info-item"><label>Data da Entrega</label><span>${delivery.delivery_date ? format(new Date(delivery.delivery_date + "T00:00:00"), "dd/MM/yyyy") : "—"}</span></div>
      <div class="info-item"><label>Responsável</label><span>${delivery.responsible_user || "—"}</span></div>
      <div class="info-item"><label>Matrícula</label><span>${emp?.employee_number || "—"}</span></div>
    </div>
    <table>
      <thead><tr>
        <th>Equipamento de Proteção Individual</th>
        <th style="width:80px;text-align:center">Qtd.</th>
        <th style="width:100px;text-align:center">Nº CA</th>
        <th style="width:100px;text-align:center">Validade</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="legal">
      <strong>DECLARAÇÃO:</strong> Declaro ter recebido os Equipamentos de Proteção Individual (EPIs) listados acima,
      em perfeito estado de conservação, e me comprometo a utilizá-los adequadamente, conservá-los e comunicar
      qualquer defeito ou dano ao responsável, conforme determina o Art. 158 da CLT e a NR-6.
      ${delivery.observations ? `<br><br><strong>Observações:</strong> ${delivery.observations}` : ""}
    </div>
    <div class="signatures">
      <div class="sig-box">
        <div class="sig-line"></div>
        <p><strong>${emp?.full_name || "Funcionário"}</strong></p>
        <p style="font-size:8pt;color:#666">Assinatura do Funcionário</p>
        <p style="font-size:8pt;color:#666">Data: ____/____/________</p>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <p><strong>Responsável pela Entrega</strong></p>
        <p style="font-size:8pt;color:#666">Assinatura / Carimbo</p>
        <p style="font-size:8pt;color:#666">Data: ____/____/________</p>
      </div>
    </div>
    <div class="footer">
      Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} • Sistema PontoFlex • ${company?.cnpj ? `CNPJ: ${company.cnpj}` : ""}
    </div>
    <div class="no-print" style="position:fixed;bottom:20px;right:20px">
      <button onclick="window.print()" style="background:#f97316;color:#fff;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:15px;box-shadow:0 4px 12px rgba(0,0,0,0.2)">
        🖨️ Imprimir / Salvar PDF
      </button>
    </div>
    </body></html>`;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
  };

  // Group by employee
  const byEmployee = {};
  filtered.forEach(d => {
    const emp = employees.find(e => e.id === d.employee_id);
    const name = emp?.full_name || d.employee_id;
    if (!byEmployee[name]) byEmployee[name] = { emp, deliveries: [] };
    byEmployee[name].deliveries.push(d);
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Fichas de EPI</h1>
          <p className="text-gray-500 text-sm">Histórico de entregas e fichas geradas</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <Input placeholder="Buscar por funcionário..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {Object.entries(byEmployee).length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma ficha registrada ainda</p>
        </div>
      ) : (
        Object.entries(byEmployee).map(([name, { emp, deliveries: empDeliveries }]) => (
          <Card key={name}>
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">{name}</p>
                  <p className="text-xs text-gray-500">{emp?.cpf} • {emp?.job_function || emp?.category || "—"}</p>
                </div>
                <Badge variant="outline">{empDeliveries.length} {empDeliveries.length === 1 ? "entrega" : "entregas"}</Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Itens</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empDeliveries.map(d => {
                    const dItems = allItems.filter(i => i.delivery_id === d.id);
                    return (
                      <TableRow key={d.id}>
                        <TableCell>{d.delivery_date ? format(new Date(d.delivery_date + "T00:00:00"), "dd/MM/yyyy") : "—"}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {dItems.map((i, idx) => (
                              <span key={idx} className="inline-block bg-orange-50 text-orange-700 text-xs px-2 py-0.5 rounded mr-1 mb-1">
                                {i.epi_name} x{i.quantity}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">{d.responsible_user || "—"}</TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[d.status] || ""}>
                            {d.status === "rascunho" ? "Rascunho" : d.status === "gerado" ? "Ficha Gerada" : "Assinado"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => generatePDF(d)} title="Gerar PDF">
                              <FileDown className="w-4 h-4" />
                            </Button>
                            {d.signed_file_url && (
                              <Button size="sm" variant="outline" onClick={() => window.open(d.signed_file_url, "_blank")} title="Ver assinado">
                                <Eye className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}