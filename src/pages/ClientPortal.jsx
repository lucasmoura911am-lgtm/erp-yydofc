import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  FileText, AlertCircle, Plus, X, Camera, Download, CheckCircle2,
  Clock, AlertTriangle, Receipt, FileCheck, LogOut, Ticket,
  ChevronRight, Bell, BarChart3, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const TYPE_CONFIG = {
  chamado: { label: "Chamado", color: "bg-slate-100 text-slate-700 border border-slate-200" },
  ocorrencia: { label: "Ocorrência", color: "bg-amber-50 text-amber-700 border border-amber-200" },
  solicitacao: { label: "Solicitação", color: "bg-blue-50 text-blue-700 border border-blue-200" },
  reclamacao: { label: "Reclamação", color: "bg-red-50 text-red-700 border border-red-200" },
  elogio: { label: "Elogio", color: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
};

const STATUS_TICKET = {
  aberto: { label: "Aberto", dot: "bg-amber-400", text: "text-amber-700 bg-amber-50 border border-amber-200", icon: Clock },
  em_atendimento: { label: "Em Atendimento", dot: "bg-blue-400", text: "text-blue-700 bg-blue-50 border border-blue-200", icon: AlertCircle },
  aguardando_cliente: { label: "Aguardando Retorno", dot: "bg-purple-400", text: "text-purple-700 bg-purple-50 border border-purple-200", icon: Clock },
  resolvido: { label: "Resolvido", dot: "bg-emerald-400", text: "text-emerald-700 bg-emerald-50 border border-emerald-200", icon: CheckCircle2 },
  fechado: { label: "Fechado", dot: "bg-gray-400", text: "text-gray-600 bg-gray-50 border border-gray-200", icon: CheckCircle2 },
};

const DOC_TYPE = {
  nota_fiscal: { label: "Nota Fiscal", icon: FileCheck, accent: "text-blue-600", bg: "bg-blue-50" },
  boleto: { label: "Boleto", icon: Receipt, accent: "text-orange-600", bg: "bg-orange-50" },
  contrato: { label: "Contrato", icon: FileText, accent: "text-violet-600", bg: "bg-violet-50" },
  relatorio: { label: "Relatório", icon: BarChart3, accent: "text-teal-600", bg: "bg-teal-50" },
  outro: { label: "Outro", icon: FileText, accent: "text-gray-500", bg: "bg-gray-50" },
};

const DOC_STATUS = {
  pendente: { label: "A Pagar", color: "bg-amber-50 text-amber-700 border border-amber-200" },
  pago: { label: "Pago", color: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  vencido: { label: "Vencido", color: "bg-red-50 text-red-700 border border-red-200" },
  cancelado: { label: "Cancelado", color: "bg-gray-50 text-gray-500 border border-gray-200" },
};

const NAV = [
  { id: "dashboard", label: "Início", icon: BarChart3 },
  { id: "chamados", label: "Chamados", icon: Ticket },
  { id: "financeiro", label: "Financeiro", icon: Receipt },
  { id: "documentos", label: "Documentos", icon: FileText },
];

export default function ClientPortal() {
  const [authStep, setAuthStep] = useState("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [logging, setLogging] = useState(false);
  const [client, setClient] = useState(null);
  const [company, setCompany] = useState(null);
  const [cid, setCid] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState({ title: "", description: "", type: "chamado", priority: "media" });
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState([]);
  const qc = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get("email");
    if (email) setLoginEmail(email);
    const saved = sessionStorage.getItem("client_portal");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setClient(parsed.client);
        setCid(parsed.cid);
        setCompany(parsed.company || null);
        setAuthStep("portal");
      } catch {}
    }
  }, []);

  const handleLogin = async () => {
    setLoginError("");
    if (!loginEmail || !loginPassword) { setLoginError("Preencha email e senha."); return; }
    setLogging(true);
    try {
      const all = await base44.entities.Client.filter({ portal_email: loginEmail, portal_active: true });
      const found = all.find(c => c.portal_password === loginPassword);
      if (!found) { setLoginError("Email ou senha incorretos."); setLogging(false); return; }
      let companyData = null;
      if (found.company_id) {
        const comps = await base44.entities.Company.filter({ id: found.company_id });
        if (comps[0]) companyData = comps[0];
      }
      setClient(found); setCid(found.company_id); setCompany(companyData);
      sessionStorage.setItem("client_portal", JSON.stringify({ client: found, cid: found.company_id, company: companyData }));
      setAuthStep("portal");
    } catch { setLoginError("Erro de conexão. Tente novamente."); }
    setLogging(false);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("client_portal");
    setClient(null); setCid(null); setCompany(null); setAuthStep("login");
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
        ...data, company_id: cid, client_id: client.id,
        client_name: client.name, number,
        opened_by: client.portal_email, photos, status: "aberto",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal_tickets"] });
      setTicketOpen(false);
      setTicketForm({ title: "", description: "", type: "chamado", priority: "media" });
      setPhotos([]);
      toast.success("Chamado aberto com sucesso!");
    },
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    try { const { file_url } = await base44.integrations.Core.UploadFile({ file }); setPhotos(p => [...p, file_url]); }
    catch { toast.error("Erro ao enviar foto"); }
    setUploading(false);
  };

  const openTickets = tickets.filter(t => !["resolvido", "fechado"].includes(t.status));
  const overdueDocs = documents.filter(d => d.status === "vencido");
  const boletos = documents.filter(d => d.type === "boleto");
  const notas = documents.filter(d => d.type === "nota_fiscal");
  const otherDocs = documents.filter(d => !["boleto", "nota_fiscal"].includes(d.type));

  // ── LOGIN ────────────────────────────────────────────────────────────────
  if (authStep === "login") {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        {/* Left panel - branding */}
        <div className="hidden lg:flex flex-col justify-between w-[420px] bg-slate-900 text-white p-10">
          <div>
            <div className="flex items-center gap-3 mb-12">
              <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-slate-900"/>
              </div>
              <span className="font-bold text-lg">Portal do Cliente</span>
            </div>
            <h2 className="text-3xl font-black leading-tight mb-4">Acesse seus documentos e chamados com facilidade</h2>
            <p className="text-slate-400 text-sm leading-relaxed">Visualize notas fiscais, boletos, acompanhe chamados e muito mais em um só lugar.</p>
          </div>
          <div className="space-y-3">
            {["Chamados e ocorrências em tempo real","Notas fiscais e boletos para download","Histórico completo de atendimento"].map(item => (
              <div key={item} className="flex items-center gap-3 text-sm text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0"/>
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Right panel - form */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm">
            {/* Mobile logo */}
            <div className="lg:hidden text-center mb-8">
              <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-white"/>
              </div>
              <h1 className="font-black text-xl text-slate-900">Portal do Cliente</h1>
            </div>

            <h2 className="text-2xl font-black text-slate-900 mb-1">Entrar</h2>
            <p className="text-slate-500 text-sm mb-7">Use as credenciais fornecidas pela equipe</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5 block">Email</label>
                <Input type="email" placeholder="seu@email.com" value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  className="h-11 border-slate-200 focus:ring-slate-900"/>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5 block">Senha</label>
                <Input type="password" placeholder="••••••••" value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  className="h-11 border-slate-200 focus:ring-slate-900"/>
              </div>
              {loginError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0"/>{loginError}
                </div>
              )}
              <Button onClick={handleLogin} disabled={logging}
                className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-semibold">
                {logging ? <><Loader2 className="w-4 h-4 animate-spin mr-2"/>Verificando...</> : "Acessar Portal"}
              </Button>
              <p className="text-center text-xs text-slate-400">Dúvidas? Entre em contato com o atendimento</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── PORTAL ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 md:px-8 h-14 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          {company?.logo_url
            ? <img src={company.logo_url} alt="" className="h-7 object-contain"/>
            : <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center"><FileText className="w-4 h-4 text-white"/></div>
          }
          <div className="h-4 w-px bg-gray-200"/>
          <span className="text-sm font-semibold text-slate-700">{client?.name}</span>
          {overdueDocs.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
              <Bell className="w-3 h-3"/>{overdueDocs.length} vencido(s)
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-500 hover:text-slate-700 text-xs gap-1.5">
          <LogOut className="w-3.5 h-3.5"/>Sair
        </Button>
      </header>

      {/* Nav tabs */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8">
        <div className="flex gap-0 overflow-x-auto">
          {NAV.map(n => {
            const Icon = n.icon;
            return (
              <button key={n.id} onClick={() => setTab(n.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === n.id
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}>
                <Icon className="w-4 h-4"/>
                {n.label}
                {n.id === "chamados" && openTickets.length > 0 && (
                  <span className="ml-1 min-w-[18px] h-[18px] bg-amber-400 text-white text-xs rounded-full flex items-center justify-center px-1">
                    {openTickets.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">

        {/* ══ DASHBOARD ══ */}
        {tab === "dashboard" && (
          <>
            <div>
              <h2 className="text-xl font-black text-slate-800">Bem-vindo, {client?.name}</h2>
              <p className="text-sm text-slate-500">Aqui está um resumo da sua conta</p>
            </div>

            {overdueDocs.length > 0 && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"/>
                <div>
                  <p className="font-semibold text-red-700 text-sm">{overdueDocs.length} boleto(s) com vencimento em aberto</p>
                  <p className="text-xs text-red-500 mt-0.5">Entre em contato com nosso time para regularizar.</p>
                </div>
                <button onClick={() => setTab("financeiro")} className="ml-auto text-xs text-red-600 font-semibold flex items-center gap-1 hover:underline">
                  Ver <ChevronRight className="w-3 h-3"/>
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Chamados Abertos", value: openTickets.length, action: () => setTab("chamados"), warn: openTickets.length > 0 },
                { label: "Boletos", value: boletos.length, action: () => setTab("financeiro"), warn: overdueDocs.length > 0 },
                { label: "Notas Fiscais", value: notas.length, action: () => setTab("financeiro") },
                { label: "Documentos", value: documents.length, action: () => setTab("documentos") },
              ].map(k => (
                <button key={k.label} onClick={k.action}
                  className={`text-left p-4 rounded-xl border transition-all hover:shadow-md ${k.warn ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"}`}>
                  <p className={`text-2xl font-black ${k.warn ? "text-amber-700" : "text-slate-800"}`}>{k.value}</p>
                  <p className={`text-xs mt-0.5 ${k.warn ? "text-amber-600" : "text-slate-500"}`}>{k.label}</p>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* recent tickets */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-800 text-sm">Últimos Chamados</h3>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setTicketOpen(true)}>
                    <Plus className="w-3 h-3"/>Abrir
                  </Button>
                </div>
                {tickets.length === 0
                  ? <p className="text-slate-400 text-sm text-center py-6">Nenhum chamado ainda</p>
                  : tickets.slice(0, 4).map(t => {
                    const st = STATUS_TICKET[t.status];
                    return (
                      <div key={t.id} className="flex items-center gap-3 py-2.5 border-b last:border-0 border-gray-100">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${st?.dot}`}/>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{t.title}</p>
                          <p className="text-xs text-slate-400">{t.number}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${st?.text}`}>{st?.label}</span>
                      </div>
                    );
                  })
                }
              </div>

              {/* recent docs */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-bold text-slate-800 text-sm mb-4">Documentos Recentes</h3>
                {documents.length === 0
                  ? <p className="text-slate-400 text-sm text-center py-6">Nenhum documento disponível</p>
                  : documents.slice(0, 4).map(d => {
                    const dt = DOC_TYPE[d.type];
                    const DIcon = dt.icon;
                    return (
                      <div key={d.id} className="flex items-center gap-3 py-2.5 border-b last:border-0 border-gray-100">
                        <div className={`w-8 h-8 ${dt.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                          <DIcon className={`w-4 h-4 ${dt.accent}`}/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{d.title}</p>
                          <p className="text-xs text-slate-400">{dt.label}{d.reference_month ? ` · ${d.reference_month}` : ""}</p>
                        </div>
                        <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-700">
                          <Download className="w-4 h-4"/>
                        </a>
                      </div>
                    );
                  })
                }
              </div>
            </div>
          </>
        )}

        {/* ══ CHAMADOS ══ */}
        {tab === "chamados" && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-800">Chamados & Ocorrências</h2>
                <p className="text-sm text-slate-500">Abra e acompanhe o status de atendimento</p>
              </div>
              <Button onClick={() => setTicketOpen(true)} className="bg-slate-900 hover:bg-slate-800 text-white gap-2 text-sm">
                <Plus className="w-4 h-4"/>Abrir Chamado
              </Button>
            </div>
            {tickets.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                <Ticket className="w-10 h-10 mx-auto mb-3 text-slate-300"/>
                <p className="text-slate-500 font-medium mb-1">Nenhum chamado ainda</p>
                <p className="text-slate-400 text-sm mb-4">Abra um chamado para nossa equipe entrar em contato</p>
                <Button onClick={() => setTicketOpen(true)} className="bg-slate-900 text-white"><Plus className="w-4 h-4 mr-1"/>Abrir chamado</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map(t => {
                  const st = STATUS_TICKET[t.status];
                  const StIcon = st?.icon || Clock;
                  return (
                    <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900">{t.title}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_CONFIG[t.type]?.color}`}>{TYPE_CONFIG[t.type]?.label}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{t.number} · {t.created_date?.slice(0,10)}</p>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 flex-shrink-0 ${st?.text}`}>
                          <StIcon className="w-3 h-3"/>{st?.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{t.description}</p>
                      {t.photos?.length > 0 && (
                        <div className="flex gap-2 mt-3">
                          {t.photos.map((p,i) => <img key={i} src={p} alt="" className="w-14 h-14 rounded-lg object-cover border border-gray-200"/>)}
                        </div>
                      )}
                      {t.response && (
                        <div className="mt-4 bg-blue-50 rounded-xl p-4 border border-blue-100">
                          <p className="text-xs font-semibold text-blue-600 mb-1.5 uppercase tracking-wide">Resposta da equipe</p>
                          <p className="text-sm text-slate-700 leading-relaxed">{t.response}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ══ FINANCEIRO ══ */}
        {tab === "financeiro" && (
          <>
            <div>
              <h2 className="text-xl font-black text-slate-800">Financeiro</h2>
              <p className="text-sm text-slate-500">Notas fiscais e boletos</p>
            </div>

            {/* Boletos */}
            <div>
              <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-3">Boletos</h3>
              {boletos.length === 0
                ? <div className="text-center py-8 bg-white rounded-xl border border-gray-200 text-slate-400 text-sm">Nenhum boleto disponível</div>
                : <div className="space-y-2">
                  {boletos.map(d => (
                    <div key={d.id} className={`bg-white rounded-xl border p-4 flex items-center gap-4 ${d.status==="vencido"?"border-red-300":d.status==="pago"?"border-emerald-200":"border-gray-200"}`}>
                      <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Receipt className="w-5 h-5 text-orange-500"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-800">{d.title}</p>
                        <div className="flex gap-3 text-xs text-slate-400 mt-0.5 flex-wrap">
                          {d.reference_month && <span>Ref. {d.reference_month}</span>}
                          {d.due_date && <span>Venc. {d.due_date}</span>}
                          {d.value > 0 && <span className="font-semibold text-slate-700">R$ {d.value.toLocaleString("pt-BR",{minimumFractionDigits:2})}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2.5 py-1 rounded-full ${DOC_STATUS[d.status]?.color}`}>{DOC_STATUS[d.status]?.label}</span>
                        <a href={d.file_url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs"><Download className="w-3.5 h-3.5"/>Baixar</Button>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              }
            </div>

            {/* Notas */}
            <div>
              <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-3">Notas Fiscais</h3>
              {notas.length === 0
                ? <div className="text-center py-8 bg-white rounded-xl border border-gray-200 text-slate-400 text-sm">Nenhuma nota fiscal disponível</div>
                : <div className="space-y-2">
                  {notas.map(d => (
                    <div key={d.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FileCheck className="w-5 h-5 text-blue-500"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-800">{d.title}</p>
                        <div className="flex gap-3 text-xs text-slate-400 mt-0.5 flex-wrap">
                          {d.reference_month && <span>Ref. {d.reference_month}</span>}
                          {d.value > 0 && <span className="font-semibold text-slate-700">R$ {d.value.toLocaleString("pt-BR",{minimumFractionDigits:2})}</span>}
                        </div>
                        {d.notes && <p className="text-xs text-slate-400 mt-1">{d.notes}</p>}
                      </div>
                      <a href={d.file_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs flex-shrink-0"><Download className="w-3.5 h-3.5"/>Baixar</Button>
                      </a>
                    </div>
                  ))}
                </div>
              }
            </div>
          </>
        )}

        {/* ══ DOCUMENTOS ══ */}
        {tab === "documentos" && (
          <>
            <div>
              <h2 className="text-xl font-black text-slate-800">Documentos</h2>
              <p className="text-sm text-slate-500">Contratos, relatórios e outros arquivos</p>
            </div>
            {otherDocs.length === 0 && boletos.length === 0 && notas.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                <FileText className="w-10 h-10 mx-auto mb-3 text-slate-300"/>
                <p className="text-slate-400 text-sm">Nenhum documento disponível</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map(d => {
                  const dt = DOC_TYPE[d.type]; const DIcon = dt.icon;
                  return (
                    <div key={d.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                      <div className={`w-10 h-10 ${dt.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                        <DIcon className={`w-5 h-5 ${dt.accent}`}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-slate-800">{d.title}</p>
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{dt.label}</span>
                          {d.type === "boleto" && <span className={`text-xs px-2 py-0.5 rounded-full ${DOC_STATUS[d.status]?.color}`}>{DOC_STATUS[d.status]?.label}</span>}
                        </div>
                        <div className="flex gap-3 text-xs text-slate-400 mt-0.5">
                          {d.reference_month && <span>Ref. {d.reference_month}</span>}
                          {d.value > 0 && <span>R$ {d.value.toLocaleString("pt-BR",{minimumFractionDigits:2})}</span>}
                        </div>
                      </div>
                      <a href={d.file_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs flex-shrink-0"><Download className="w-3.5 h-3.5"/>Baixar</Button>
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* ══ MODAL CHAMADO ══ */}
      {ticketOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white">
              <div>
                <h2 className="font-bold text-slate-900">Abrir Chamado</h2>
                <p className="text-xs text-slate-400">Nossa equipe responderá em breve</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setTicketOpen(false)}><X className="w-4 h-4"/></Button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5 block">Tipo</label>
                  <Select value={ticketForm.type} onValueChange={v=>setTicketForm(f=>({...f,type:v}))}>
                    <SelectTrigger className="border-slate-200"><SelectValue/></SelectTrigger>
                    <SelectContent>{Object.entries(TYPE_CONFIG).map(([v,c])=><SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5 block">Prioridade</label>
                  <Select value={ticketForm.priority} onValueChange={v=>setTicketForm(f=>({...f,priority:v}))}>
                    <SelectTrigger className="border-slate-200"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5 block">Assunto *</label>
                <Input value={ticketForm.title} onChange={e=>setTicketForm(f=>({...f,title:e.target.value}))} placeholder="Descreva brevemente" className="border-slate-200"/>
              </div>
              <div><label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5 block">Descrição *</label>
                <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-900" rows={4}
                  value={ticketForm.description} onChange={e=>setTicketForm(f=>({...f,description:e.target.value}))} placeholder="Detalhe o problema ou solicitação..."/>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5 block">Fotos (opcional)</label>
                <input type="file" id="ticket-photo" className="hidden" accept="image/*" capture="environment" onChange={handlePhotoUpload}/>
                <label htmlFor="ticket-photo" className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-slate-500 hover:bg-slate-50">
                  <Camera className="w-4 h-4"/>{uploading ? "Enviando..." : "Adicionar foto"}
                </label>
                {photos.length > 0 && <div className="flex gap-2 mt-2">{photos.map((p,i)=><img key={i} src={p} alt="" className="w-14 h-14 rounded-lg object-cover border border-gray-200"/>)}</div>}
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t sticky bottom-0 bg-white">
              <Button variant="outline" onClick={()=>setTicketOpen(false)}>Cancelar</Button>
              <Button disabled={!ticketForm.title||!ticketForm.description||createTicket.isPending}
                onClick={()=>createTicket.mutate(ticketForm)}
                className="bg-slate-900 hover:bg-slate-800 text-white">
                {createTicket.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-1"/>Enviando</> : "Enviar Chamado"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}