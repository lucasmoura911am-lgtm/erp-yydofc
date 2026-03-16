import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Pencil, Trash2, X, Clock, Paperclip, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

const today = format(new Date(), "yyyy-MM-dd");

const TYPES = [
  { value: "operacional", label: "Operacional" },
  { value: "administrativo", label: "Administrativo" },
  { value: "comercial", label: "Comercial" },
  { value: "atendimento", label: "Atendimento ao Cliente" },
  { value: "financeiro", label: "Financeiro" },
  { value: "reuniao", label: "Reunião" },
  { value: "suporte", label: "Suporte" },
  { value: "externo", label: "Externo" },
];

const STATUS = [
  { value: "em_andamento", label: "Em andamento", color: "bg-blue-100 text-blue-700" },
  { value: "finalizado", label: "Finalizado", color: "bg-green-100 text-green-700" },
  { value: "pausado", label: "Pausado", color: "bg-yellow-100 text-yellow-700" },
];

const typeColors = {
  operacional: "bg-blue-100 text-blue-700",
  administrativo: "bg-gray-100 text-gray-700",
  comercial: "bg-purple-100 text-purple-700",
  atendimento: "bg-green-100 text-green-700",
  financeiro: "bg-emerald-100 text-emerald-700",
  reuniao: "bg-orange-100 text-orange-700",
  suporte: "bg-cyan-100 text-cyan-700",
  externo: "bg-red-100 text-red-700",
};

const makeEmpty = (user) => ({
  date: today,
  start_time: "",
  end_time: "",
  type: "operacional",
  description: "",
  client_or_project: "",
  status: "em_andamento",
  attachment_url: "",
  employee_email: user?.email || "",
  employee_name: user?.full_name || "",
});

export default function WorkActivities() {
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({});
  const [editing, setEditing] = useState(null);
  const [filterDate, setFilterDate] = useState(today);
  const [filterType, setFilterType] = useState("all");
  const [filterEmployee, setFilterEmployee] = useState("mine");
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then((u) => {
      setUser(u);
      setForm(makeEmpty(u));
      // load company
      if (u?.company_id) {
        base44.entities.Company.filter({ id: u.company_id }).then((cs) => {
          if (cs.length > 0) setCompany(cs[0]);
        });
      }
    });
  }, []);

  const isAdmin = user?.role === "admin";
  // Use company_id from user OR from loaded company
  const cid = user?.company_id || company?.id;
  const enabled = !!user?.email;

  // Load all employees for delegate selector
  const { data: employees = [] } = useQuery({
    queryKey: ["wa_emps", cid],
    queryFn: () => base44.entities.Employee.filter({ company_id: cid }),
    enabled: !!cid,
  });

  // Load activities — admin sees all, employee sees own
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["wa_list", cid, filterEmployee, user?.email],
    queryFn: async () => {
      if (!cid) {
        // fallback: filter by created_by
        return base44.entities.WorkActivity.filter({ employee_email: user.email });
      }
      if (isAdmin && filterEmployee === "all") {
        return base44.entities.WorkActivity.filter({ company_id: cid });
      }
      return base44.entities.WorkActivity.filter({
        company_id: cid,
        employee_email: filterEmployee === "mine" ? user.email : filterEmployee,
      });
    },
    enabled,
  });

  const save = useMutation({
    mutationFn: async (data) => {
      // calc duration
      let duration_minutes = 0;
      if (data.start_time && data.end_time) {
        const [sh, sm] = data.start_time.split(":").map(Number);
        const [eh, em] = data.end_time.split(":").map(Number);
        duration_minutes = Math.max(0, eh * 60 + em - (sh * 60 + sm));
      }

      const payload = {
        ...data,
        duration_minutes,
        company_id: cid || "unknown",
      };

      if (editing) {
        return base44.entities.WorkActivity.update(editing.id, payload);
      }
      return base44.entities.WorkActivity.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wa_list"] });
      qc.invalidateQueries({ queryKey: ["ph_act"] });
      setOpen(false);
      setEditing(null);
      setForm(makeEmpty(user));
      toast.success(editing ? "Atividade atualizada!" : "Atividade registrada com sucesso!");
    },
    onError: (err) => {
      toast.error("Erro ao salvar: " + (err?.message || "tente novamente"));
    },
  });

  const del = useMutation({
    mutationFn: (id) => base44.entities.WorkActivity.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wa_list"] });
      qc.invalidateQueries({ queryKey: ["ph_act"] });
      toast.success("Removida!");
    },
  });

  const handleEdit = (a) => {
    setEditing(a);
    setForm({
      date: a.date,
      start_time: a.start_time || "",
      end_time: a.end_time || "",
      type: a.type,
      description: a.description,
      client_or_project: a.client_or_project || "",
      status: a.status,
      attachment_url: a.attachment_url || "",
      employee_email: a.employee_email || user?.email || "",
      employee_name: a.employee_name || user?.full_name || "",
    });
    setOpen(true);
  };

  const handleOpenNew = () => {
    setEditing(null);
    setForm({ ...makeEmpty(user), date: filterDate !== "all" ? filterDate : today });
    setOpen(true);
  };

  const handleEmployeeSelect = (email) => {
    const emp = employees.find((e) => e.user_email === email);
    setForm((f) => ({
      ...f,
      employee_email: email,
      employee_name: emp?.full_name || email,
    }));
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm((f) => ({ ...f, attachment_url: file_url }));
    } catch {
      toast.error("Erro ao enviar arquivo");
    }
    setUploading(false);
  };

  const filtered = activities
    .filter((a) => {
      const d = !filterDate || filterDate === "all" || a.date === filterDate;
      const t = filterType === "all" || a.type === filterType;
      return d && t;
    })
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        (b.start_time || "").localeCompare(a.start_time || "")
    );

  const totalToday = activities.filter(
    (a) => a.date === today && a.employee_email === user?.email
  ).length;
  const totalMins = activities
    .filter((a) => a.date === today && a.employee_email === user?.email)
    .reduce((s, a) => s + (a.duration_minutes || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">
              📋 Diário de Atividades
            </h1>
            <p className="text-sm text-gray-400">Registre o que foi feito</p>
          </div>
          <Button
            onClick={handleOpenNew}
            className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
          >
            <Plus className="w-4 h-4" /> Nova Atividade
          </Button>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Minhas hoje", value: totalToday, color: "bg-violet-50 text-violet-700" },
            {
              label: "Horas hoje",
              value:
                totalMins > 0
                  ? `${Math.floor(totalMins / 60)}h${
                      totalMins % 60 > 0
                        ? String(totalMins % 60).padStart(2, "0") + "m"
                        : ""
                    }`
                  : "0h",
              color: "bg-blue-50 text-blue-700",
            },
            { label: "Total listado", value: filtered.length, color: "bg-green-50 text-green-700" },
          ].map((s) => (
            <div key={s.label} className={`${s.color} rounded-2xl p-3 text-center`}>
              <p className="text-2xl font-black">{s.value}</p>
              <p className="text-xs opacity-70">{s.label}</p>
            </div>
          ))}
        </div>

        {/* FILTERS */}
        <div className="flex gap-3 flex-wrap items-center">
          <Input
            type="date"
            value={filterDate === "all" ? "" : filterDate}
            onChange={(e) => setFilterDate(e.target.value || "all")}
            className="w-40"
          />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Select value={filterEmployee} onValueChange={setFilterEmployee}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Funcionário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mine">Somente minhas</SelectItem>
                <SelectItem value="all">Todos os funcionários</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.user_email || e.id}>
                    {e.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {(filterDate !== today || filterType !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterDate(today);
                setFilterType("all");
                setFilterEmployee("mine");
              }}
            >
              <X className="w-4 h-4 mr-1" /> Limpar
            </Button>
          )}
        </div>

        {/* LIST */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-gray-500 font-medium">Nenhuma atividade encontrada</p>
            <Button
              onClick={handleOpenNew}
              className="mt-3 bg-violet-600 text-white"
            >
              <Plus className="w-4 h-4 mr-1" /> Registrar atividade
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((a) => {
              const statusItem = STATUS.find((s) => s.value === a.status);
              return (
                <Card
                  key={a.id}
                  className="border-0 shadow-sm hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              typeColors[a.type]
                            }`}
                          >
                            {TYPES.find((t) => t.value === a.type)?.label}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusItem?.color}`}
                          >
                            {statusItem?.label}
                          </span>
                          {a.date && (
                            <span className="text-xs text-gray-400">{a.date}</span>
                          )}
                          {a.start_time && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {a.start_time}
                              {a.end_time ? ` - ${a.end_time}` : ""}
                            </span>
                          )}
                          {a.duration_minutes > 0 && (
                            <span className="text-xs text-gray-400">
                              (
                              {Math.floor(a.duration_minutes / 60)}h
                              {a.duration_minutes % 60 > 0
                                ? String(a.duration_minutes % 60).padStart(2, "0") + "m"
                                : ""}
                              )
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-800 dark:text-gray-200">
                          {a.description}
                        </p>
                        {a.client_or_project && (
                          <p className="text-xs text-gray-400 mt-1">
                            🔗 {a.client_or_project}
                          </p>
                        )}
                        {/* Show who registered (if viewing all) */}
                        {isAdmin && filterEmployee !== "mine" && a.employee_name && (
                          <p className="text-xs text-violet-500 mt-1 flex items-center gap-1">
                            <User className="w-3 h-3" /> {a.employee_name}
                          </p>
                        )}
                        {a.attachment_url && (
                          <a
                            href={a.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-violet-500 hover:underline flex items-center gap-1 mt-1"
                          >
                            <Paperclip className="w-3 h-3" /> Anexo
                          </a>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEdit(a)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-400 hover:text-red-600"
                          onClick={() => del.mutate(a.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b dark:border-gray-800">
              <h2 className="font-bold text-gray-900 dark:text-gray-100">
                {editing ? "Editar Atividade" : "Nova Atividade"}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setOpen(false);
                  setEditing(null);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-5 space-y-4">

              {/* Funcionário (admin pode delegar) */}
              {isAdmin && (
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                    Funcionário *
                  </label>
                  <Select
                    value={form.employee_email}
                    onValueChange={handleEmployeeSelect}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar funcionário" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={user.email}>
                        {user.full_name || user.email} (eu)
                      </SelectItem>
                      {employees
                        .filter((e) => e.user_email && e.user_email !== user.email)
                        .map((e) => (
                          <SelectItem key={e.id} value={e.user_email}>
                            {e.full_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                    Data *
                  </label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, date: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                    Tipo *
                  </label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                    Hora início
                  </label>
                  <Input
                    type="time"
                    value={form.start_time}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, start_time: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                    Hora fim
                  </label>
                  <Input
                    type="time"
                    value={form.end_time}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, end_time: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                  Descrição *
                </label>
                <textarea
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
                  rows={3}
                  placeholder="Descreva o que foi feito..."
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                  Cliente / Projeto (opcional)
                </label>
                <Input
                  placeholder="Nome do cliente ou projeto"
                  value={form.client_or_project}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, client_or_project: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                  Status
                </label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                  Anexo (opcional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    className="hidden"
                    id="attach-wa"
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={handleUpload}
                  />
                  <label
                    htmlFor="attach-wa"
                    className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-500 hover:border-violet-400 transition-colors"
                  >
                    <Paperclip className="w-4 h-4" />
                    {uploading
                      ? "Enviando..."
                      : form.attachment_url
                      ? "Trocar arquivo"
                      : "Selecionar arquivo"}
                  </label>
                  {form.attachment_url && (
                    <a
                      href={form.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-violet-500 hover:underline"
                    >
                      Ver
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-5 border-t dark:border-gray-800">
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  setEditing(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => save.mutate(form)}
                disabled={!form.description || !form.date || save.isPending}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                {save.isPending
                  ? "Salvando..."
                  : editing
                  ? "Atualizar"
                  : "Registrar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}