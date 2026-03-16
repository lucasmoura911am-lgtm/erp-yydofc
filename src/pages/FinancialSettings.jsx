import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, ChevronRight, Building2, Target, BookOpen } from "lucide-react";
import { toast } from "sonner";

export default function FinancialSettings() {
  const [user, setUser] = useState(null);
  const qc = useQueryClient();
  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const cid = user?.company_id;

  // --- Bank Accounts ---
  const { data: bankAccounts = [] } = useQuery({ queryKey: ["ba", cid], queryFn: () => base44.entities.BankAccount.filter({ company_id: cid }), enabled: !!cid });
  const [baDialog, setBaDialog] = useState(false);
  const [baEditing, setBaEditing] = useState(null);
  const [baForm, setBaForm] = useState({ bank_name: "", account_number: "", agency: "", account_type: "corrente", initial_balance: 0, current_balance: 0, active: true });

  const baCreate = useMutation({ mutationFn: (d) => base44.entities.BankAccount.create({ ...d, company_id: cid }), onSuccess: () => { qc.invalidateQueries(["ba"]); toast.success("Conta criada!"); setBaDialog(false); resetBa(); } });
  const baUpdate = useMutation({ mutationFn: ({ id, d }) => base44.entities.BankAccount.update(id, d), onSuccess: () => { qc.invalidateQueries(["ba"]); toast.success("Atualizado!"); setBaDialog(false); setBaEditing(null); resetBa(); } });
  const baDelete = useMutation({ mutationFn: (id) => base44.entities.BankAccount.delete(id), onSuccess: () => { qc.invalidateQueries(["ba"]); toast.success("Excluído!"); } });
  const resetBa = () => { setBaForm({ bank_name: "", account_number: "", agency: "", account_type: "corrente", initial_balance: 0, current_balance: 0, active: true }); setBaEditing(null); };

  // --- Cost Centers ---
  const { data: costCenters = [] } = useQuery({ queryKey: ["cc", cid], queryFn: () => base44.entities.CostCenter.filter({ company_id: cid }), enabled: !!cid });
  const [ccDialog, setCcDialog] = useState(false);
  const [ccEditing, setCcEditing] = useState(null);
  const [ccForm, setCcForm] = useState({ name: "", description: "", manager: "", budget: 0, active: true });

  const ccCreate = useMutation({ mutationFn: (d) => base44.entities.CostCenter.create({ ...d, company_id: cid }), onSuccess: () => { qc.invalidateQueries(["cc"]); toast.success("Centro criado!"); setCcDialog(false); resetCc(); } });
  const ccUpdate = useMutation({ mutationFn: ({ id, d }) => base44.entities.CostCenter.update(id, d), onSuccess: () => { qc.invalidateQueries(["cc"]); toast.success("Atualizado!"); setCcDialog(false); setCcEditing(null); resetCc(); } });
  const ccDelete = useMutation({ mutationFn: (id) => base44.entities.CostCenter.delete(id), onSuccess: () => { qc.invalidateQueries(["cc"]); toast.success("Excluído!"); } });
  const resetCc = () => { setCcForm({ name: "", description: "", manager: "", budget: 0, active: true }); setCcEditing(null); };

  // --- Chart of Accounts ---
  const { data: accounts = [] } = useQuery({ queryKey: ["coa", cid], queryFn: () => base44.entities.ChartOfAccounts.filter({ company_id: cid }), enabled: !!cid });
  const [coaDialog, setCoaDialog] = useState(false);
  const [coaEditing, setCoaEditing] = useState(null);
  const [coaForm, setCoaForm] = useState({ code: "", name: "", type: "despesa", parent_account_id: "", description: "", active: true });

  const coaCreate = useMutation({ mutationFn: (d) => base44.entities.ChartOfAccounts.create({ ...d, company_id: cid }), onSuccess: () => { qc.invalidateQueries(["coa"]); toast.success("Conta criada!"); setCoaDialog(false); resetCoa(); } });
  const coaUpdate = useMutation({ mutationFn: ({ id, d }) => base44.entities.ChartOfAccounts.update(id, d), onSuccess: () => { qc.invalidateQueries(["coa"]); toast.success("Atualizado!"); setCoaDialog(false); setCoaEditing(null); resetCoa(); } });
  const coaDelete = useMutation({ mutationFn: (id) => base44.entities.ChartOfAccounts.delete(id), onSuccess: () => { qc.invalidateQueries(["coa"]); toast.success("Excluído!"); } });
  const resetCoa = () => { setCoaForm({ code: "", name: "", type: "despesa", parent_account_id: "", description: "", active: true }); setCoaEditing(null); };

  // seed default chart of accounts
  const seedCOA = async () => {
    const defaults = [
      { code: "1", name: "Receitas", type: "receita" },
      { code: "1.1", name: "Receita de Contratos", type: "receita" },
      { code: "1.2", name: "Receita de Serviços", type: "receita" },
      { code: "2", name: "Despesas", type: "despesa" },
      { code: "2.1", name: "Salários e Encargos", type: "despesa" },
      { code: "2.2", name: "Impostos", type: "despesa" },
      { code: "2.3", name: "Fornecedores", type: "despesa" },
      { code: "2.4", name: "Infraestrutura", type: "despesa" },
      { code: "2.5", name: "Administrativo", type: "despesa" },
    ];
    for (const d of defaults) {
      await base44.entities.ChartOfAccounts.create({ ...d, company_id: cid, active: true });
    }
    qc.invalidateQueries(["coa"]);
    toast.success("Plano de contas criado!");
  };

  const TYPE_COLORS = { receita: "bg-green-100 text-green-700", despesa: "bg-red-100 text-red-700", ativo: "bg-blue-100 text-blue-700", passivo: "bg-orange-100 text-orange-700", transferencia: "bg-gray-100 text-gray-600" };
  const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Configurações Financeiras</h1>
        <p className="text-gray-500 text-sm">Contas bancárias, centros de custo e plano de contas</p>
      </div>

      <Tabs defaultValue="bank">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="bank" className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> Contas</TabsTrigger>
          <TabsTrigger value="cc" className="flex items-center gap-1"><Target className="w-3.5 h-3.5" /> C. Custo</TabsTrigger>
          <TabsTrigger value="coa" className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> Plano Contas</TabsTrigger>
        </TabsList>

        {/* Bank Accounts */}
        <TabsContent value="bank">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Contas Bancárias</CardTitle>
              <Dialog open={baDialog} onOpenChange={setBaDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={resetBa} className="bg-gradient-to-r from-purple-600 to-blue-600"><Plus className="w-3.5 h-3.5 mr-1" /> Nova Conta</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{baEditing ? "Editar" : "Nova"} Conta Bancária</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); const d = { ...baForm, initial_balance: parseFloat(baForm.initial_balance) || 0, current_balance: parseFloat(baForm.current_balance) || 0 }; if (baEditing) baUpdate.mutate({ id: baEditing.id, d }); else baCreate.mutate(d); }} className="space-y-3">
                    <div><Label>Banco *</Label><Input value={baForm.bank_name} onChange={e => setBaForm({ ...baForm, bank_name: e.target.value })} required /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Agência</Label><Input value={baForm.agency} onChange={e => setBaForm({ ...baForm, agency: e.target.value })} /></div>
                      <div><Label>Conta</Label><Input value={baForm.account_number} onChange={e => setBaForm({ ...baForm, account_number: e.target.value })} /></div>
                      <div><Label>Tipo</Label>
                        <Select value={baForm.account_type} onValueChange={v => setBaForm({ ...baForm, account_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="corrente">Corrente</SelectItem>
                            <SelectItem value="poupanca">Poupança</SelectItem>
                            <SelectItem value="investimento">Investimento</SelectItem>
                            <SelectItem value="caixa">Caixa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Saldo Inicial</Label><Input type="number" step="0.01" value={baForm.initial_balance} onChange={e => setBaForm({ ...baForm, initial_balance: e.target.value })} /></div>
                      <div><Label>Saldo Atual</Label><Input type="number" step="0.01" value={baForm.current_balance} onChange={e => setBaForm({ ...baForm, current_balance: e.target.value })} /></div>
                    </div>
                    <div className="flex gap-3"><Button type="submit" className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600">Salvar</Button><Button type="button" variant="outline" onClick={() => setBaDialog(false)}>Cancelar</Button></div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {bankAccounts.map(ba => (
                  <div key={ba.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div>
                      <p className="font-semibold">{ba.bank_name}</p>
                      <p className="text-xs text-gray-500">Ag: {ba.agency} · Conta: {ba.account_number} · {ba.account_type}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-bold text-green-700">{fmt(ba.current_balance || ba.initial_balance)}</p>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => { setBaEditing(ba); setBaForm({ ...ba }); setBaDialog(true); }}><Edit className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => { if (confirm("Excluir?")) baDelete.mutate(ba.id); }}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
                {bankAccounts.length === 0 && <p className="text-center text-gray-400 py-6">Nenhuma conta bancária cadastrada</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cost Centers */}
        <TabsContent value="cc">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Centros de Custo</CardTitle>
              <Dialog open={ccDialog} onOpenChange={setCcDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={resetCc} className="bg-gradient-to-r from-purple-600 to-blue-600"><Plus className="w-3.5 h-3.5 mr-1" /> Novo</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{ccEditing ? "Editar" : "Novo"} Centro de Custo</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); const d = { ...ccForm, budget: parseFloat(ccForm.budget) || 0 }; if (ccEditing) ccUpdate.mutate({ id: ccEditing.id, d }); else ccCreate.mutate(d); }} className="space-y-3">
                    <div><Label>Nome *</Label><Input value={ccForm.name} onChange={e => setCcForm({ ...ccForm, name: e.target.value })} required /></div>
                    <div><Label>Descrição</Label><Input value={ccForm.description} onChange={e => setCcForm({ ...ccForm, description: e.target.value })} /></div>
                    <div><Label>Responsável</Label><Input value={ccForm.manager} onChange={e => setCcForm({ ...ccForm, manager: e.target.value })} /></div>
                    <div><Label>Orçamento Mensal (R$)</Label><Input type="number" step="0.01" value={ccForm.budget} onChange={e => setCcForm({ ...ccForm, budget: e.target.value })} /></div>
                    <div className="flex gap-3"><Button type="submit" className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600">Salvar</Button><Button type="button" variant="outline" onClick={() => setCcDialog(false)}>Cancelar</Button></div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {costCenters.map(cc => (
                  <div key={cc.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div>
                      <p className="font-semibold">{cc.name}</p>
                      <p className="text-xs text-gray-500">{cc.manager ? `Resp: ${cc.manager}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      {cc.budget > 0 && <p className="text-sm text-purple-700">Orç: {fmt(cc.budget)}/mês</p>}
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => { setCcEditing(cc); setCcForm({ ...cc }); setCcDialog(true); }}><Edit className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => { if (confirm("Excluir?")) ccDelete.mutate(cc.id); }}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
                {costCenters.length === 0 && <p className="text-center text-gray-400 py-6">Nenhum centro de custo</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chart of Accounts */}
        <TabsContent value="coa">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">Plano de Contas</CardTitle>
              <div className="flex gap-2">
                {accounts.length === 0 && (
                  <Button size="sm" variant="outline" onClick={seedCOA}>Criar Padrão</Button>
                )}
                <Dialog open={coaDialog} onOpenChange={setCoaDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={resetCoa} className="bg-gradient-to-r from-purple-600 to-blue-600"><Plus className="w-3.5 h-3.5 mr-1" /> Nova Conta</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{coaEditing ? "Editar" : "Nova"} Conta</DialogTitle></DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); if (coaEditing) coaUpdate.mutate({ id: coaEditing.id, d: coaForm }); else coaCreate.mutate(coaForm); }} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Código</Label><Input value={coaForm.code} onChange={e => setCoaForm({ ...coaForm, code: e.target.value })} placeholder="1.1.01" /></div>
                        <div><Label>Tipo *</Label>
                          <Select value={coaForm.type} onValueChange={v => setCoaForm({ ...coaForm, type: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="receita">Receita</SelectItem>
                              <SelectItem value="despesa">Despesa</SelectItem>
                              <SelectItem value="ativo">Ativo</SelectItem>
                              <SelectItem value="passivo">Passivo</SelectItem>
                              <SelectItem value="transferencia">Transferência</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2"><Label>Nome *</Label><Input value={coaForm.name} onChange={e => setCoaForm({ ...coaForm, name: e.target.value })} required /></div>
                        <div className="col-span-2"><Label>Conta Pai</Label>
                          <Select value={coaForm.parent_account_id || "none"} onValueChange={v => setCoaForm({ ...coaForm, parent_account_id: v === "none" ? "" : v })}>
                            <SelectTrigger><SelectValue placeholder="Sem conta pai (raiz)" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Raiz</SelectItem>
                              {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code ? `${a.code} - ` : ""}{a.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2"><Label>Descrição</Label><Input value={coaForm.description} onChange={e => setCoaForm({ ...coaForm, description: e.target.value })} /></div>
                      </div>
                      <div className="flex gap-3"><Button type="submit" className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600">Salvar</Button><Button type="button" variant="outline" onClick={() => setCoaDialog(false)}>Cancelar</Button></div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {accounts.sort((a, b) => (a.code || "").localeCompare(b.code || "")).map(acc => {
                  const isChild = !!acc.parent_account_id;
                  return (
                    <div key={acc.id} className={`flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 ${isChild ? "ml-6 border-l-2 border-gray-200 pl-4" : ""}`}>
                      <div className="flex items-center gap-2">
                        {isChild && <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                        <span className="text-xs text-gray-400 font-mono">{acc.code}</span>
                        <span className="text-sm font-medium">{acc.name}</span>
                        <Badge className={`text-xs ${TYPE_COLORS[acc.type]}`}>{acc.type}</Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => { setCoaEditing(acc); setCoaForm({ ...acc }); setCoaDialog(true); }}><Edit className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => { if (confirm("Excluir?")) coaDelete.mutate(acc.id); }}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                      </div>
                    </div>
                  );
                })}
                {accounts.length === 0 && <p className="text-center text-gray-400 py-6">Clique em "Criar Padrão" para gerar um plano de contas básico</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}