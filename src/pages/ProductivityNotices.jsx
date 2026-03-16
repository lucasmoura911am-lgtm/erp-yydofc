import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, X, Bell, Pencil, Trash2, AlertTriangle, Info, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

const today = format(new Date(), "yyyy-MM-dd");

const TYPES = [
  { value: "empresa", label: "🏢 Aviso da Empresa", color: "from-blue-500 to-indigo-600" },
  { value: "equipe", label: "👥 Aviso da Equipe", color: "from-teal-500 to-cyan-600" },
  { value: "pessoal", label: "👤 Aviso Pessoal", color: "from-violet-500 to-purple-600" },
  { value: "lembrete", label: "🔔 Lembrete", color: "from-amber-500 to-orange-500" },
];

const PRIORITIES = [
  { value: "baixa", label: "Baixa", color: "bg-gray-100 text-gray-600 border-gray-200" },
  { value: "media", label: "Média", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "alta", label: "Alta", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "urgente", label: "Urgente", color: "bg-red-100 text-red-700 border-red-200" },
];

const EMPTY = { title: "", description: "", notice_date: today, priority: "media", type: "empresa", target_emails: [], active: true };

export default function ProductivityNotices() {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [emailInput, setEmailInput] = useState("");
  const qc = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const cid = user?.company_id;
  const enabled = !!cid;
  const isAdmin = user?.role === "admin";

  const { data: notices = [] } = useQuery({
    queryKey: ["pn_list", cid],
    queryFn: () => base44.entities.InternalNotice.filter({ company_id: cid }),
    enabled,
  });

  const save = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.InternalNotice.update(editing.id, data)
      : base44.entities.InternalNotice.create({ ...data, company_id: cid, responsible_email: user.email, responsible_name: user.full_name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pn_list"] }); qc.invalidateQueries({ queryKey: ["ph_notices"] }); setOpen(false); setEditing(null); setForm(EMPTY); toast.success(editing ? "Aviso atualizado!" : "Aviso criado!"); },
  });

  const del = useMutation({
    mutationFn: (id) => base44.entities.InternalNotice.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pn_list"] }); toast.success("Removido!"); },
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }) => base44.entities.InternalNotice.update(id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pn_list"] }),
  });

  const handleEdit = (n) => {
    setEditing(n);
    setForm({ title: n.title, description: n.description || "", notice_date: n.notice_date, priority: n.priority, type: n.type, target_emails: n.target_emails || [], active: n.active });
    setEmailInput("");
    setOpen(true);
  };

  // Visible notices for current user
  const visibleNotices = notices.filter(n => {
    if (!n.active) return isAdmin; // inactive only visible to admin
    if (n.type === "empresa") return true;
    if (n.responsible_email === user?.email) return true;
    if ((n.target_emails || []).includes(user?.email)) return true;
    return false;
  });

  const filtered = visibleNotices.filter(n => filterType === "all" || n.type === filterType)
    .sort((a, b) => {
      const pOrd = { urgente: 4, alta: 3, media: 2, baixa: 1 };
      return (pOrd[b.priority] || 0) - (pOrd[a.priority] || 0) || b.notice_date?.localeCompare(a.notice_date);
    });

  const addEmail = () => { if (emailInput.trim()) { setForm(f => ({ ...f, target_emails: [...(f.target_emails || []), emailInput.trim()] })); setEmailInput(""); } };

  const priorityBg = { urgente: "border-l-red-500 bg-red-50 dark:bg-red-900/10", alta: "border-l-orange-500 bg-orange-50 dark:bg-orange-900/10", media: "border-l-blue-500 bg-blue-50 dark:bg-blue-900/10", baixa: "border-l-gray-300 bg-gray-50 dark:bg-gray-800/50" };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-5">

        {/* HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">🔔 Avisos & Lembretes</h1>
            <p className="text-sm text-gray-400">Comunicados internos e lembretes da equipe</p>
          </div>
          <Button onClick={() => { setEditing(null); setForm(EMPTY); setEmailInput(""); setOpen(true); }} className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
            <Plus className="w-4 h-4" /> Novo Aviso
          </Button>
        </div>

        {/* FILTER */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilterType("all")} className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${filterType === "all" ? "bg-amber-500 text-white" : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100"}`}>Todos</button>
          {TYPES.map(t => (
            <button key={t.value} onClick={() => setFilterType(t.value)} className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${filterType === t.value ? "bg-amber-500 text-white" : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100"}`}>{t.label}</button>
          ))}
        </div>

        {/* LIST */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
            <Bell className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">Nenhum aviso encontrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(n => {
              const typeItem = TYPES.find(t => t.value === n.type);
              const priItem = PRIORITIES.find(p => p.value === n.priority);
              return (
                <div key={n.id} className={`border-l-4 ${priorityBg[n.priority]} rounded-xl p-4 ${!n.active ? "opacity-50" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-gradient-to-r ${typeItem?.color} text-white`}>{typeItem?.label}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${priItem?.color}`}>{priItem?.label}</span>
                        {!n.active && <Badge variant="outline" className="text-xs">Inativo</Badge>}
                      </div>
                      <h3 className="font-bold text-gray-800 dark:text-gray-100">{n.title}</h3>
                      {n.description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-line">{n.description}</p>}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 flex-wrap">
                        <span>📅 {n.notice_date}</span>
                        {n.responsible_name && <span>👤 {n.responsible_name}</span>}
                        {(n.target_emails || []).length > 0 && <span>📧 {n.target_emails.length} destinatário(s)</span>}
                      </div>
                    </div>
                    {(isAdmin || n.responsible_email === user?.email) && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => handleEdit(n)} className="p-1.5 rounded-lg hover:bg-white/50 text-gray-400 hover:text-gray-600"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => toggle.mutate({ id: n.id, active: !n.active })} className={`p-1.5 rounded-lg hover:bg-white/50 ${n.active ? "text-green-500" : "text-gray-400"}`}><Bell className="w-3.5 h-3.5" /></button>
                        <button onClick={() => del.mutate(n.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b dark:border-gray-800">
              <h2 className="font-bold text-gray-900 dark:text-gray-100">{editing ? "Editar Aviso" : "Novo Aviso"}</h2>
              <Button variant="ghost" size="icon" onClick={() => { setOpen(false); setEditing(null); }}><X className="w-4 h-4" /></Button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Título *</label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Título do aviso..." />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Descrição</label>
                <textarea className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-transparent dark:text-gray-100 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalhe o aviso..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Tipo</label>
                  <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Prioridade</label>
                  <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Data</label>
                <Input type="date" value={form.notice_date} onChange={e => setForm(f => ({ ...f, notice_date: e.target.value }))} />
              </div>
              {form.type !== "empresa" && (
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Destinatários (emails)</label>
                  <div className="flex gap-2">
                    <Input placeholder="email@empresa.com" value={emailInput} onChange={e => setEmailInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addEmail())} />
                    <Button type="button" variant="outline" size="sm" onClick={addEmail}>Add</Button>
                  </div>
                  {(form.target_emails || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {form.target_emails.map((e, i) => (
                        <span key={i} className="flex items-center gap-1 bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                          {e}
                          <button onClick={() => setForm(f => ({ ...f, target_emails: f.target_emails.filter((_, j) => j !== i) }))}><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t dark:border-gray-800">
              <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</Button>
              <Button onClick={() => save.mutate(form)} disabled={!form.title || save.isPending} className="bg-amber-600 hover:bg-amber-700 text-white">
                {save.isPending ? "Salvando..." : editing ? "Atualizar" : "Publicar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}