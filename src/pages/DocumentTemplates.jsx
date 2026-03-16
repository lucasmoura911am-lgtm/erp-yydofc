import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, FileText, Eye, PanelRight, Download, Sparkles } from "lucide-react";
import VariablePanel from "../components/documents/VariablePanel";
import DocumentPreview, { resolveVariables } from "../components/documents/DocumentPreview";
import { DEFAULT_TEMPLATES } from "../components/documents/defaultTemplates";
import { useToast } from "@/components/ui/use-toast";

const CATEGORIES = {
  contrato: { label: "Contrato", color: "bg-blue-100 text-blue-800" },
  termo: { label: "Termo", color: "bg-purple-100 text-purple-800" },
  declaracao: { label: "Declaração", color: "bg-green-100 text-green-800" },
  notificacao: { label: "Notificação", color: "bg-orange-100 text-orange-800" },
  outro: { label: "Outro", color: "bg-gray-100 text-gray-800" },
};

const EMPTY_FORM = { name: "", description: "", category: "contrato", html_content: "" };

export default function DocumentTemplates() {
  const [user, setUser] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showVars, setShowVars] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editorTab, setEditorTab] = useState("html");
  const [cursorPos, setCursorPos] = useState(null);
  const textareaRef = useRef(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const { data: templates = [] } = useQuery({
    queryKey: ["doc-templates", user?.company_id],
    queryFn: () => base44.entities.DocumentTemplate.filter({ company_id: user.company_id }),
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

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.DocumentTemplate.create(data),
    onSuccess: () => { qc.invalidateQueries(["doc-templates"]); closeEditor(); toast({ title: "Template criado!" }); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DocumentTemplate.update(id, data),
    onSuccess: () => { qc.invalidateQueries(["doc-templates"]); closeEditor(); toast({ title: "Template atualizado!" }); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.DocumentTemplate.delete(id),
    onSuccess: () => { qc.invalidateQueries(["doc-templates"]); toast({ title: "Template excluído" }); },
  });

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setEditorTab("html");
    setShowEditor(true);
  };

  const openEdit = (t) => {
    setEditing(t);
    setForm({ name: t.name, description: t.description || "", category: t.category || "contrato", html_content: t.html_content || "" });
    setEditorTab("html");
    setShowEditor(true);
  };

  const closeEditor = () => { setShowEditor(false); setEditing(null); };

  const handleSave = () => {
    if (!form.name.trim() || !form.html_content.trim()) {
      toast({ title: "Preencha nome e conteúdo", variant: "destructive" });
      return;
    }
    const payload = { ...form, company_id: user.company_id };
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  // Insert variable at cursor position in textarea
  const insertVariable = (variable) => {
    const ta = textareaRef.current;
    if (!ta) {
      setForm((f) => ({ ...f, html_content: f.html_content + variable }));
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const current = form.html_content;
    const newContent = current.substring(0, start) + variable + current.substring(end);
    setForm((f) => ({ ...f, html_content: newContent }));
    // Restore cursor after variable
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + variable.length, start + variable.length);
    }, 10);
  };

  const importDefaultTemplates = async () => {
    if (!user?.company_id) return;
    let count = 0;
    for (const t of DEFAULT_TEMPLATES) {
      await base44.entities.DocumentTemplate.create({ ...t, company_id: user.company_id });
      count++;
    }
    qc.invalidateQueries(["doc-templates"]);
    toast({ title: `${count} templates importados com sucesso!` });
  };

  const openFromDefault = (tpl) => {
    setEditing(null);
    setForm({ name: tpl.name, description: tpl.description, category: tpl.category, html_content: tpl.html_content });
    setEditorTab("html");
    setShowEditor(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Templates de Documentos</h1>
          <p className="text-gray-500 mt-1">Crie modelos reutilizáveis com variáveis automáticas</p>
        </div>
        <div className="flex gap-2">
          {templates.length === 0 && (
            <Button onClick={importDefaultTemplates} variant="outline" className="border-purple-300 text-purple-700 hover:bg-purple-50">
              <Sparkles className="w-4 h-4 mr-2" /> Importar Templates Prontos
            </Button>
          )}
          <Button onClick={openNew} className="bg-gradient-to-r from-purple-600 to-blue-600">
            <Plus className="w-4 h-4 mr-2" /> Novo Template
          </Button>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="space-y-6">
          {/* Default templates showcase */}
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/10 dark:to-blue-900/10 border border-purple-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h2 className="font-semibold text-gray-800 dark:text-gray-200">Templates prontos para usar</h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
              {DEFAULT_TEMPLATES.map((t) => (
                <div key={t.name} className="bg-white dark:bg-gray-800 border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => openFromDefault(t)}>
                  <Badge className={`text-xs mb-2 ${CATEGORIES[t.category]?.color}`}>{CATEGORIES[t.category]?.label}</Badge>
                  <p className="font-medium text-sm text-gray-800 dark:text-gray-200">{t.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{t.description}</p>
                  <p className="text-xs text-blue-600 mt-2">Clique para usar →</p>
                </div>
              ))}
            </div>
            <Button onClick={importDefaultTemplates} className="mt-4 bg-gradient-to-r from-purple-600 to-blue-600">
              <Sparkles className="w-4 h-4 mr-2" /> Importar Todos os Templates
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Import button when templates exist */}
          <div className="flex justify-end">
            <Button onClick={importDefaultTemplates} variant="outline" size="sm" className="border-purple-200 text-purple-600 hover:bg-purple-50">
              <Sparkles className="w-4 h-4 mr-1" /> Importar templates padrão
            </Button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((t) => (
              <Card key={t.id} className="hover:shadow-lg transition-shadow border-2 hover:border-purple-200">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{t.name}</CardTitle>
                      {t.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{t.description}</p>}
                    </div>
                    <Badge className={`text-xs shrink-0 ${CATEGORIES[t.category]?.color || "bg-gray-100 text-gray-800"}`}>
                      {CATEGORIES[t.category]?.label || t.category}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(t)} className="flex-1">
                      <Edit className="w-4 h-4 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => {
                      if (confirm(`Excluir "${t.name}"?`)) deleteMut.mutate(t.id);
                    }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={(open) => { if (!open) closeEditor(); }}>
        <DialogContent className="max-w-[95vw] w-full h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 py-3 border-b shrink-0 bg-white dark:bg-gray-900">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="text-base">{editing ? `Editando: ${editing.name}` : "Novo Template"}</DialogTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex gap-2">
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Nome do template *"
                    className="h-8 w-56 text-sm"
                  />
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger className="h-8 w-36 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORIES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowVars(!showVars)} className="h-8 gap-1">
                  <PanelRight className="w-4 h-4" />
                  {showVars ? "Ocultar vars" : "Variáveis"}
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex flex-1 overflow-hidden">
            {/* Editor area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <Tabs value={editorTab} onValueChange={setEditorTab} className="flex flex-col flex-1 overflow-hidden">
                <TabsList className="shrink-0 mx-4 mt-3 w-fit">
                  <TabsTrigger value="html">✏️ Editor HTML</TabsTrigger>
                  <TabsTrigger value="preview">👁️ Visualização</TabsTrigger>
                </TabsList>

                <TabsContent value="html" className="flex-1 overflow-hidden m-0 p-4">
                  <Textarea
                    ref={textareaRef}
                    value={form.html_content}
                    onChange={(e) => setForm({ ...form, html_content: e.target.value })}
                    className="h-full w-full font-mono text-xs resize-none leading-relaxed"
                    style={{ minHeight: "calc(100% - 8px)" }}
                    placeholder="Cole ou escreva o HTML do documento aqui. Use as variáveis do painel lateral como {{employee.full_name}}, {{company.logo}}, etc."
                    spellCheck={false}
                  />
                </TabsContent>

                <TabsContent value="preview" className="flex-1 overflow-auto m-0 p-4 bg-gray-100 dark:bg-gray-800">
                  <DocumentPreview
                    html={form.html_content}
                    company={company}
                    employee={{
                      full_name: "João da Silva",
                      cpf: "123.456.789-00",
                      rg: "1.234.567",
                      rg_issuer: "SSP",
                      rg_issuer_state: "SP",
                      job_function: "Vigilante",
                      hire_date: "2024-01-15",
                      salary: 2500,
                      employee_number: "0042",
                      ctps_number: "12345",
                      ctps_series: "001",
                      ctps_state: "SP",
                      pis_number: "123.45678.90-1",
                      address_street: "Rua das Flores",
                      address_number: "123",
                      address_neighborhood: "Centro",
                      address_city: "São Paulo",
                      address_state: "SP",
                      address_zipcode: "01310-100",
                      cbo: "5174-05",
                    }}
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* Variable panel */}
            {showVars && (
              <div className="w-64 border-l border-gray-200 dark:border-gray-700 shrink-0 overflow-hidden flex flex-col">
                <VariablePanel onInsert={(v) => { setEditorTab("html"); insertVariable(v); }} />
              </div>
            )}
          </div>

          <DialogFooter className="px-5 py-3 border-t shrink-0 bg-white dark:bg-gray-900 flex items-center justify-between">
            <p className="text-xs text-gray-400">Use {{"{{"}}company.logo{"}}"}}, {{"{{"}}employee.full_name{"}}"}} etc. no HTML</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={closeEditor}>Cancelar</Button>
              <Button
                onClick={handleSave}
                disabled={!form.name.trim() || !form.html_content.trim()}
                className="bg-gradient-to-r from-purple-600 to-blue-600"
              >
                {editing ? "Salvar Alterações" : "Criar Template"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}