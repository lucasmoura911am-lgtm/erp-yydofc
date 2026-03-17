import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { FileText, AlertCircle, Plus, X, Camera, Download, ExternalLink, CheckCircle2, Clock, AlertTriangle, Receipt, FileCheck, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const today = format(new Date(), "yyyy-MM-dd");

const TYPE_CONFIG = {
  chamado: { label: "Chamado", color: "bg-blue-100 text-blue-700" },
  ocorrencia: { label: "Ocorrência", color: "bg-orange-100 text-orange-700" },
  solicitacao: { label: "Solicitação", color: "bg-purple-100 text-purple-700" },
  reclamacao: { label: "Reclamação", color: "bg-red-100 text-red-700" },
  elogio: { label: "Elogio", color: "bg-green-100 text-green-700" },
};

const STATUS_TICKET = {
  aberto: { label: "Aberto", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  em_atendimento: { label: "Em Atendimento", color: "bg-blue-100 text-blue-700", icon: AlertCircle },
  aguardando_cliente: { label: "Aguardando Cliente", color: "bg-purple-100 text-purple-700", icon: Clock },
  resolvido: { label: "Resolvido", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  fechado: { label: "Fechado", color: "bg-gray-100 text-gray-600", icon: CheckCircle2 },
};

const DOC_TYPE = {
  nota_fiscal: { label: "Nota Fiscal", icon: FileCheck, color: "bg-blue-100 text-blue-700" },
  boleto: { label: "Boleto", icon: Receipt, color: "bg-orange-100 text-orange-700" },
  contrato: { label: "Contrato", icon: FileText, color: "bg-purple-100 text-purple-700" },
  relatorio: { label: "Relatório", icon: FileText, color: "bg-teal-100 text-teal-700" },
  outro: { label: "Outro", icon: FileText, color: "bg-gray-100 text-gray-600" },
};

const DOC_STATUS = {
  pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-700" },
  pago: { label: "Pago", color: "bg-green-100 text-green-700" },
  vencido: { label: "Vencido", color: "bg-red-100 text-red-700" },
  cancelado: { label: "Cancelado", color: "bg-gray-100 text-gray-500" },
};

export default function ClientPortal() {
  const [authStep, setAuthStep] = useState("login"); // login | portal
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [client, setClient] = useState(null);
  const [cid, setCid] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState({ title: "", description: "", type: "chamado", priority: "media" });
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState([]);
  const qc = useQueryClient();

  // Check URL params for pre-fill
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get("email");
    if (email) setLoginEmail(email);
    // Check session
    const saved = sessionStorage.getItem("client_portal");
    if (saved) {
      const parsed = JSON.parse(saved);
      setClient(parsed.client);
      setCid(parsed.cid);
      setAuthStep("portal");
    }
  }, []);

  const handleLogin = async () => {
    setLoginError("");
    if (!loginEmail || !loginPassword) { setLoginError("Preencha email e senha"); return; }
    try {
      // Find all clients with this portal email
      const all = await base44.entities.Client.filter({ portal_email: loginEmail, portal_active: true });
      const found = all.find(c => c.portal_password === loginPassword);
      if (!found) { setLoginError("Email ou senha inválidos"); return; }
      setClient(found);
      setCid(found.company_id);
      sessionStorage.setItem("client_portal", JSON.stringify({ client: found, cid: found.company_id }));
      setAuthStep("portal");
    } catch { setLoginError("Erro ao conectar. Tente novamente."); }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("client_portal");
    setClient(null); setCid(null); setAuthStep("login");
    setLoginEmail(""); setLoginPassword("");
  };

  const { data: tickets = [] } = useQuery({
    queryKey: ["portal_tickets", client?.id],
    queryFn: () => base44.entities.ClientTicket.filter({ client_id: client.id }),
    enabled: !!client?.id,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["portal_docs", client?.id],
    queryFn: () => base44.entities.ClientDocument.filter({ client_id: client.id }),
    enabled: !!client?.id,
  });

  const createTicket = useMutation({
    mutationFn: async (data) => {
      const number = `CH-${Date.now().toString().slice(-6)}`;
      return base44.entities.ClientTicket.create({
        ...data,
        company_id: cid,
        client_id: client.id,
        client_name: client.name,
        number,
        opened_by: loginEmail || client.portal_email,
        photos,
        status: "aberto",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal_tickets"] });
      setTicketOpen(false);
      setTicketForm({ title: "", description: "", type: "chamado", priority: "media" });
      setPhotos([]);
      toast.success("Chamado aberto com sucesso!");
    },
    onError: () => toast.error("Erro ao abrir chamado"),
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    try { const { file_url } = await base44.integrations.Core.UploadFile({ file }); setPhotos(p => [...p, file_url]); toast.success("Foto enviada!"); }
    catch { toast.error("Erro ao enviar foto"); }
    setUploading(false);
  };

  const openTickets = tickets.filter(t => !["resolvido","fechado"].includes(t.status));
  const resolvedTickets = tickets.filter(t => ["resolvido","fechado"].includes(t.status));
  const pendingDocs = documents.filter(d => d.status === "pendente");
  const overdueDocs = documents.filter(d => d.status === "vencido");
  const boletos = documents.filter(d => d.type === "boleto");
  const notas = documents.filter(d => d.type === "nota_fiscal");

  // ===== LOGIN PAGE =====
  if (authStep === "login") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-white"/>
            </div>
            <h1 className="text-2xl font-black text-white">Portal do Cliente</h1>
            <p className="text-white/70 text-sm mt-1">Acesse chamados, notas fiscais e boletos</p>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-8 space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wide">Email de acesso</label>
              <Input type="email" placeholder="seu@email.com" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} className="h-11"/>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wide">Senha</label>
              <Input type="password" placeholder="••••••••" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} className="h-11"
                onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
            </div>
            {loginError && <p className="text-red-500 text-sm flex items-center gap-1"><AlertCircle className="w-4 h-4"/>{loginError}</p>}
            <Button className="w-full h-11 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold text-base" onClick={handleLogin}>
              Entrar no Portal
            </Button>
            <p className="text-center text-xs text-gray-400">Em caso de problemas, entre em contato com a equipe de atendimento</p>
          </div>
        </div>
      </div>
    );
  }

  // ===== PORTAL =====
  const TABS = [
    { id: "dashboard", label: "🏠 Início" },
    { id: "chamados", label: "🎫 Chamados" },
    { id: "boletos", label: "💳 Boletos" },
    { id: "notas", label: "📄 Notas Fiscais" },
    { id: "documentos", label: "📁 Documentos" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* TOP BAR */}
      <header className="bg-gradient-to-r from-violet-700 to-indigo-700 text-white px-4 md:px-8 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5"/>
          </div>
          <div>
            <p className="font-black text-sm leading-none">{client?.name}</p>
            <p className="text-white/60 text-xs">Portal do Cliente</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-1"/>Sair
        </Button>
      </header>

      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">
        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${tab===t.id?"bg-violet-600 text-white shadow":"bg-white text-gray-600 hover:bg-gray-100"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ===== DASHBOARD ===== */}
        {tab === "dashboard" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {label:"Chamados Abertos",value:openTickets.length,color:"from-blue-500 to-cyan-500",action:()=>setTab("chamados")},
                {label:"Boletos Pendentes",value:pendingDocs.length + overdueDocs.length,color:overdueDocs.length>0?"from-red-500 to-orange-500":"from-orange-400 to-amber-400",action:()=>setTab("boletos")},
                {label:"Notas Fiscais",value:notas.length,color:"from-green-500 to-emerald-500",action:()=>setTab("notas")},
                {label:"Documentos",value:documents.length,color:"from-violet-500 to-purple-600",action:()=>setTab("documentos")},
              ].map(k=>(
                <div key={k.label} className={`bg-gradient-to-br ${k.color} rounded-2xl p-4 text-white shadow-md cursor-pointer hover:scale-105 transition-transform`} onClick={k.action}>
                  <p className="text-3xl font-black">{k.value}</p>
                  <p className="text-white/70 text-xs mt-1">{k.label}</p>
                </div>
              ))}
            </div>

            {overdueDocs.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"/>
                <div>
                  <p className="font-bold text-red-700">⚠️ {overdueDocs.length} boleto(s) vencido(s)</p>
                  <p className="text-xs text-red-500">Entre em contato com seu atendente para regularizar</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Recent tickets */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-800">Últimos Chamados</h3>
                    <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white text-xs h-7 gap-1" onClick={()=>setTicketOpen(true)}>
                      <Plus className="w-3 h-3"/>Abrir
                    </Button>
                  </div>
                  {tickets.length === 0
                    ? <p className="text-gray-400 text-sm text-center py-4">Nenhum chamado ainda</p>
                    : tickets.slice(0,4).map(t => {
                      const st = STATUS_TICKET[t.status];
                      return (
                        <div key={t.id} className="flex items-center gap-2 py-2 border-b last:border-0 dark:border-gray-800">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{t.title}</p>
                            <p className="text-xs text-gray-400">{t.number} · {TYPE_CONFIG[t.type]?.label}</p>
                          </div>
                          <Badge className={`${st?.color} text-xs flex-shrink-0`}>{st?.label}</Badge>
                        </div>
                      );
                    })
                  }
                </CardContent>
              </Card>

              {/* Recent docs */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <h3 className="font-bold text-gray-800 mb-3">Documentos Recentes</h3>
                  {documents.length === 0
                    ? <p className="text-gray-400 text-sm text-center py-4">Nenhum documento disponível</p>
                    : documents.slice(0,4).map(d => {
                      const dt = DOC_TYPE[d.type];
                      return (
                        <div key={d.id} className="flex items-center gap-2 py-2 border-b last:border-0 dark:border-gray-800">
                          <div className={`w-8 h-8 rounded-lg ${dt.color} flex items-center justify-center flex-shrink-0`}>
                            <dt.icon className="w-4 h-4"/>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{d.title}</p>
                            <p className="text-xs text-gray-400">{dt.label}{d.reference_month ? ` · ${d.reference_month}` : ""}</p>
                          </div>
                          <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-violet-500 hover:text-violet-700">
                            <Download className="w-4 h-4"/>
                          </a>
                        </div>
                      );
                    })
                  }
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* ===== CHAMADOS ===== */}
        {tab === "chamados" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-xl text-gray-800">Chamados & Ocorrências</h2>
              <Button className="bg-violet-600 hover:bg-violet-700 text-white gap-2" onClick={()=>setTicketOpen(true)}>
                <Plus className="w-4 h-4"/>Abrir Chamado
              </Button>
            </div>
            <div className="space-y-3">
              {tickets.length === 0 && <div className="text-center py-16 bg-white rounded-2xl text-gray-400">Nenhum chamado ainda. <br/><Button className="mt-2 bg-violet-600 text-white" onClick={()=>setTicketOpen(true)}>Abrir primeiro chamado</Button></div>}
              {tickets.map(t => {
                const st = STATUS_TICKET[t.status];
                const StIcon = st?.icon || Clock;
                return (
                  <Card key={t.id} className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-bold text-sm text-gray-900">{t.title}</span>
                            <Badge className={TYPE_CONFIG[t.type]?.color}>{TYPE_CONFIG[t.type]?.label}</Badge>
                            <Badge className={`${st?.color} flex items-center gap-1`}><StIcon className="w-3 h-3"/>{st?.label}</Badge>
                          </div>
                          <p className="text-xs text-gray-400 mb-2">{t.number} · Aberto em {t.created_date?.slice(0,10)}</p>
                          <p className="text-sm text-gray-600">{t.description}</p>
                          {t.response && (
                            <div className="mt-3 bg-blue-50 rounded-xl p-3">
                              <p className="text-xs font-bold text-blue-600 mb-1">💬 Resposta da equipe:</p>
                              <p className="text-sm text-gray-700">{t.response}</p>
                            </div>
                          )}
                          {t.photos?.length > 0 && (
                            <div className="flex gap-2 mt-2">
                              {t.photos.map((p,i) => <img key={i} src={p} alt="" className="w-14 h-14 rounded-lg object-cover border"/>)}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {/* ===== BOLETOS ===== */}
        {tab === "boletos" && (
          <>
            <h2 className="font-bold text-xl text-gray-800">Boletos</h2>
            {boletos.length === 0 && <div className="text-center py-16 bg-white rounded-2xl text-gray-400">Nenhum boleto disponível</div>}
            <div className="space-y-3">
              {boletos.map(d => (
                <Card key={d.id} className={`border-0 shadow-sm ${d.status==="vencido"?"border-l-4 border-l-red-400":d.status==="pendente"?"border-l-4 border-l-yellow-400":"border-l-4 border-l-green-400"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Receipt className="w-5 h-5 text-orange-500"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm text-gray-900">{d.title}</p>
                          <Badge className={DOC_STATUS[d.status]?.color}>{DOC_STATUS[d.status]?.label}</Badge>
                        </div>
                        <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                          {d.reference_month && <span>Ref: {d.reference_month}</span>}
                          {d.due_date && <span>Venc: {d.due_date}</span>}
                          {d.value > 0 && <span className="font-bold text-gray-700">R$ {d.value.toLocaleString("pt-BR",{minimumFractionDigits:2})}</span>}
                        </div>
                      </div>
                      <a href={d.file_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white gap-1 text-xs">
                          <Download className="w-3.5 h-3.5"/>Baixar
                        </Button>
                      </a>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* ===== NOTAS FISCAIS ===== */}
        {tab === "notas" && (
          <>
            <h2 className="font-bold text-xl text-gray-800">Notas Fiscais</h2>
            {notas.length === 0 && <div className="text-center py-16 bg-white rounded-2xl text-gray-400">Nenhuma nota fiscal disponível</div>}
            <div className="space-y-3">
              {notas.map(d => (
                <Card key={d.id} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FileCheck className="w-5 h-5 text-blue-500"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-gray-900">{d.title}</p>
                        <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                          {d.reference_month && <span>Ref: {d.reference_month}</span>}
                          {d.value > 0 && <span className="font-bold text-gray-700">R$ {d.value.toLocaleString("pt-BR",{minimumFractionDigits:2})}</span>}
                        </div>
                        {d.notes && <p className="text-xs text-gray-400 mt-1">{d.notes}</p>}
                      </div>
                      <a href={d.file_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-white gap-1 text-xs">
                          <Download className="w-3.5 h-3.5"/>Baixar
                        </Button>
                      </a>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* ===== DOCUMENTOS ===== */}
        {tab === "documentos" && (
          <>
            <h2 className="font-bold text-xl text-gray-800">Todos os Documentos</h2>
            {documents.length === 0 && <div className="text-center py-16 bg-white rounded-2xl text-gray-400">Nenhum documento disponível</div>}
            <div className="space-y-3">
              {documents.map(d => {
                const dt = DOC_TYPE[d.type];
                return (
                  <Card key={d.id} className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 ${dt.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                          <dt.icon className="w-5 h-5"/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-sm text-gray-900">{d.title}</p>
                            <Badge className={`${dt.color} text-xs`}>{dt.label}</Badge>
                            {d.status && d.type === "boleto" && <Badge className={DOC_STATUS[d.status]?.color}>{DOC_STATUS[d.status]?.label}</Badge>}
                          </div>
                          <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                            {d.reference_month && <span>Ref: {d.reference_month}</span>}
                            {d.due_date && <span>Venc: {d.due_date}</span>}
                            {d.value > 0 && <span>R$ {d.value.toLocaleString("pt-BR",{minimumFractionDigits:2})}</span>}
                          </div>
                        </div>
                        <a href={d.file_url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="gap-1 text-xs">
                            <Download className="w-3.5 h-3.5"/>Baixar
                          </Button>
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* MODAL: Abrir Chamado */}
      {ticketOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white">
              <h2 className="font-bold">Abrir Chamado</h2>
              <Button variant="ghost" size="icon" onClick={()=>setTicketOpen(false)}><X className="w-4 h-4"/></Button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Tipo</label>
                  <Select value={ticketForm.type} onValueChange={v=>setTicketForm(f=>({...f,type:v}))}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{Object.entries(TYPE_CONFIG).map(([v,c])=><SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Prioridade</label>
                  <Select value={ticketForm.priority} onValueChange={v=>setTicketForm(f=>({...f,priority:v}))}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Assunto *</label>
                <Input value={ticketForm.title} onChange={e=>setTicketForm(f=>({...f,title:e.target.value}))} placeholder="Descreva brevemente o problema"/>
              </div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Descrição detalhada *</label>
                <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400" rows={4} value={ticketForm.description} onChange={e=>setTicketForm(f=>({...f,description:e.target.value}))} placeholder="Descreva o problema com detalhes..."/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Fotos (opcional)</label>
                <input type="file" id="ticket-photo" className="hidden" accept="image/*" capture="environment" onChange={handlePhotoUpload}/>
                <label htmlFor="ticket-photo" className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-violet-400 w-fit">
                  <Camera className="w-4 h-4"/>{uploading?"Enviando...":"Adicionar foto"}
                </label>
                {photos.length > 0 && <div className="flex gap-2 mt-2">{photos.map((p,i)=><img key={i} src={p} alt="" className="w-16 h-16 rounded-xl object-cover border-2 border-violet-200"/>)}</div>}
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t sticky bottom-0 bg-white">
              <Button variant="outline" onClick={()=>setTicketOpen(false)}>Cancelar</Button>
              <Button disabled={!ticketForm.title||!ticketForm.description||createTicket.isPending} className="bg-violet-600 hover:bg-violet-700 text-white"
                onClick={()=>createTicket.mutate(ticketForm)}>
                {createTicket.isPending?"Enviando...":"Abrir Chamado"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}