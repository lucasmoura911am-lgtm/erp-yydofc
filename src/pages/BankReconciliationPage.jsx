import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Upload, Link2, AlertCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function BankReconciliationPage() {
  const [user, setUser] = useState(null);
  const [selectedBank, setSelectedBank] = useState("");
  const [csvRows, setCsvRows] = useState([]);
  const [parsedImport, setParsedImport] = useState([]);
  const fileRef = useRef();
  const qc = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const cid = user?.company_id;

  const { data: bankAccounts = [] } = useQuery({ queryKey: ["ba", cid], queryFn: () => base44.entities.BankAccount.filter({ company_id: cid }), enabled: !!cid });
  const { data: reconciliations = [] } = useQuery({ queryKey: ["recon", cid, selectedBank], queryFn: () => base44.entities.BankReconciliation.filter({ company_id: cid, bank_account_id: selectedBank }), enabled: !!cid && !!selectedBank });
  const { data: payables = [] } = useQuery({ queryKey: ["ap", cid], queryFn: () => base44.entities.AccountsPayable.filter({ company_id: cid }), enabled: !!cid });
  const { data: receivables = [] } = useQuery({ queryKey: ["ar", cid], queryFn: () => base44.entities.AccountsReceivable.filter({ company_id: cid }), enabled: !!cid });

  const importMutation = useMutation({
    mutationFn: async (rows) => {
      for (const row of rows) {
        await base44.entities.BankReconciliation.create({
          company_id: cid,
          bank_account_id: selectedBank,
          transaction_date: row.date,
          description: row.description,
          amount: Math.abs(row.amount),
          type: row.amount >= 0 ? "credito" : "debito",
          reconciled: false
        });
      }
    },
    onSuccess: () => { qc.invalidateQueries(["recon"]); toast.success("Extrato importado!"); setParsedImport([]); setCsvRows([]); }
  });

  const matchMutation = useMutation({
    mutationFn: ({ id, matchedId, matchedSource }) => base44.entities.BankReconciliation.update(id, { matched_record_id: matchedId, matched_source: matchedSource, reconciled: true }),
    onSuccess: () => { qc.invalidateQueries(["recon"]); toast.success("Conciliado!"); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.BankReconciliation.delete(id),
    onSuccess: () => { qc.invalidateQueries(["recon"]); toast.success("Removido!"); }
  });

  const handleCSVUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.split("\n").filter(l => l.trim());
      const rows = lines.slice(1).map(line => {
        const parts = line.split(/[;,]/);
        const date = parts[0]?.trim().replace(/"/g, "");
        const description = parts[1]?.trim().replace(/"/g, "") || "";
        const amountRaw = parts[2]?.trim().replace(/"/g, "").replace(",", ".").replace("R$", "").trim();
        const amount = parseFloat(amountRaw) || 0;
        return { date, description, amount };
      }).filter(r => r.date && !isNaN(r.amount) && r.amount !== 0);
      setParsedImport(rows);
      toast.success(`${rows.length} transações lidas`);
    };
    reader.readAsText(file);
  };

  const unreconciledCount = reconciliations.filter(r => !r.reconciled).length;
  const reconciledCount = reconciliations.filter(r => r.reconciled).length;

  // Auto-match helper
  const autoMatch = async () => {
    const unmatched = reconciliations.filter(r => !r.reconciled);
    let matched = 0;
    for (const rec of unmatched) {
      // Try to find a payable/receivable with same amount and similar date
      if (rec.type === "debito") {
        const match = payables.find(p => Math.abs(p.amount - rec.amount) < 0.01 && p.due_date === rec.transaction_date && p.status !== "cancelado");
        if (match) { await matchMutation.mutateAsync({ id: rec.id, matchedId: match.id, matchedSource: "pagar" }); matched++; }
      } else {
        const match = receivables.find(r => Math.abs(r.amount - rec.amount) < 0.01 && r.due_date === rec.transaction_date && r.status !== "cancelado");
        if (match) { await matchMutation.mutateAsync({ id: rec.id, matchedId: match.id, matchedSource: "receber" }); matched++; }
      }
    }
    toast.success(`${matched} registros conciliados automaticamente`);
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Conciliação Bancária</h1>
        <p className="text-gray-500 text-sm">Importe extratos e concilie com seus lançamentos</p>
      </div>

      {/* Select bank */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-48">
              <Label>Conta Bancária</Label>
              <Select value={selectedBank} onValueChange={setSelectedBank}>
                <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                <SelectContent>
                  {bankAccounts.map(b => <SelectItem key={b.id} value={b.id}>{b.bank_name} - {b.account_number}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {selectedBank && (
              <>
                <div>
                  <input type="file" accept=".csv,.txt" ref={fileRef} onChange={handleCSVUpload} className="hidden" />
                  <Button variant="outline" onClick={() => fileRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" /> Importar CSV
                  </Button>
                </div>
                {reconciliations.length > 0 && unreconciledCount > 0 && (
                  <Button variant="outline" onClick={autoMatch}>
                    <Link2 className="w-4 h-4 mr-2" /> Conciliar Automaticamente
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* CSV preview */}
      {parsedImport.length > 0 && (
        <Card className="border-blue-200">
          <CardHeader><CardTitle className="text-sm text-blue-700">{parsedImport.length} transações prontas para importar</CardTitle></CardHeader>
          <CardContent>
            <Alert className="mb-3 bg-blue-50 border-blue-200">
              <AlertDescription className="text-blue-700 text-xs">
                Formato esperado: data;descrição;valor (positivo=crédito, negativo=débito)
              </AlertDescription>
            </Alert>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {parsedImport.slice(0, 10).map((r, i) => (
                <div key={i} className="flex justify-between text-sm p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                  <span className="text-gray-500">{r.date}</span>
                  <span className="flex-1 mx-3 truncate">{r.description}</span>
                  <span className={r.amount >= 0 ? "text-green-700 font-medium" : "text-red-700 font-medium"}>{fmt(r.amount)}</span>
                </div>
              ))}
              {parsedImport.length > 10 && <p className="text-xs text-gray-400 text-center">...e mais {parsedImport.length - 10} registros</p>}
            </div>
            <div className="flex gap-2 mt-3">
              <Button className="bg-gradient-to-r from-purple-600 to-blue-600" onClick={() => importMutation.mutate(parsedImport)} disabled={importMutation.isPending}>
                {importMutation.isPending ? "Importando..." : `Importar ${parsedImport.length} registros`}
              </Button>
              <Button variant="outline" onClick={() => setParsedImport([])}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      {selectedBank && reconciliations.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Total importado</p><p className="text-lg font-bold">{reconciliations.length}</p></CardContent></Card>
          <Card className="border-green-200"><CardContent className="p-4"><p className="text-xs text-gray-500">Conciliados</p><p className="text-lg font-bold text-green-700">{reconciledCount}</p></CardContent></Card>
          <Card className="border-orange-200"><CardContent className="p-4"><p className="text-xs text-gray-500">Pendentes</p><p className="text-lg font-bold text-orange-700">{unreconciledCount}</p></CardContent></Card>
        </div>
      )}

      {/* Reconciliation list */}
      {selectedBank && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    {["Data", "Descrição", "Tipo", "Valor", "Status", "Vinculado a", "Ações"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {reconciliations.sort((a, b) => b.transaction_date?.localeCompare(a.transaction_date)).map(rec => {
                    const matchedPayable = rec.matched_source === "pagar" ? payables.find(p => p.id === rec.matched_record_id) : null;
                    const matchedReceivable = rec.matched_source === "receber" ? receivables.find(r => r.id === rec.matched_record_id) : null;
                    return (
                      <tr key={rec.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/30 ${rec.reconciled ? "opacity-70" : ""}`}>
                        <td className="px-4 py-3">{rec.transaction_date}</td>
                        <td className="px-4 py-3 max-w-48 truncate">{rec.description}</td>
                        <td className="px-4 py-3">
                          <Badge className={rec.type === "credito" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                            {rec.type}
                          </Badge>
                        </td>
                        <td className={`px-4 py-3 font-semibold ${rec.type === "credito" ? "text-green-700" : "text-red-700"}`}>
                          {fmt(rec.amount)}
                        </td>
                        <td className="px-4 py-3">
                          {rec.reconciled
                            ? <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle2 className="w-3.5 h-3.5" /> Conciliado</span>
                            : <span className="flex items-center gap-1 text-orange-600 text-xs"><AlertCircle className="w-3.5 h-3.5" /> Pendente</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {matchedPayable && `A Pagar: ${matchedPayable.supplier_name}`}
                          {matchedReceivable && `A Receber: ${matchedReceivable.description}`}
                          {!rec.reconciled && "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {!rec.reconciled && (
                              <Button size="sm" variant="ghost" className="h-7 text-green-600" onClick={() => matchMutation.mutate({ id: rec.id, matchedId: "", matchedSource: "" })}>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7" onClick={() => { if (confirm("Remover?")) deleteMutation.mutate(rec.id); }}>
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {reconciliations.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-10 text-gray-400">Importe um extrato para começar a conciliação</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {!selectedBank && (
        <div className="text-center py-16 text-gray-400">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Selecione uma conta bancária para iniciar</p>
        </div>
      )}
    </div>
  );
}