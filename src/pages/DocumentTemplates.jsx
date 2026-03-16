import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, FileText, Eye, PanelRight } from "lucide-react";
import ReactQuill from "react-quill";
import VariablePanel from "../components/documents/VariablePanel";
import DocumentPreview from "../components/documents/DocumentPreview";
import { toast } from "@/components/ui/use-toast";

const TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  [{ font: [] }, { size: ["small", false, "large", "huge"] }],
  ["bold", "italic", "underline", "strike"],
  [{ color: [] }, { background: [] }],
  [{ align: [] }],
  [{ list: "ordered" }, { list: "bullet" }],
  [{ indent: "-1" }, { indent: "+1" }],
  ["blockquote", "link", "image"],
  ["clean"],
];

const CATEGORIES = {
  contrato: { label: "Contrato", color: "bg-blue-100 text-blue-800" },
  termo: { label: "Termo", color: "bg-purple-100 text-purple-800" },
  declaracao: { label: "Declaração", color: "bg-green-100 text-green-800" },
  notificacao: { label: "Notificação", color: "bg-orange-100 text-orange-800" },
  outro: { label: "Outro", color: "bg-gray-100 text-gray-800" },
};

export default function DocumentTemplates() {
  const [user, setUser] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showVars, setShowVars] = useState(true);
  const [editing, setEditing] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", category: "contrato", html_content: "" });
  const quillRef = useRef(null);
  const qc = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

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
    setForm({ name: "", description: "", category: "contrato", html_content: "" });
    setShowEditor(true);
  };

  const openEdit = (t) => {
    setEditing(t);
    setForm({ name: t.name, description: t.description || "", category: t.category || "contrato", html_content: t.html_content || "" });
    setShowEditor(true);
  };

  const closeEditor = () => { setShowEditor(false); setEditing(null); };

  const handleSave = () => {
    const payload = { ...form, company_id: user.company_id };
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const insertVariable = (variable) => {
    const editor = quillRef.current?.getEditor();
    if (editor) {
      const range = editor.getSelection(true);
      const idx = range ? range.index : editor.getLength();
      editor.insertText(idx, variable);
      editor.setSelection(idx + variable.length);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Templates de Documentos</h1>
          <p className="text-gray-500 mt-1">Crie e gerencie modelos de contratos, termos e declarações</p>
        </div>
        <Button onClick={openNew} className="bg-gradient-to-r from-purple-600 to-blue-600">
          <Plus className="w-4 h-4 mr-2" /> Novo Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Nenhum template criado ainda.</p>
            <p className="text-gray-400 text-sm mt-1">Crie seu primeiro template para começar a gerar documentos.</p>
            <Button onClick={openNew} className="mt-4 bg-gradient-to-r from-purple-600 to-blue-600">
              <Plus className="w-4 h-4 mr-2" /> Criar Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <Card key={t.id} className="hover:shadow-lg transition-shadow border-2 hover:border-purple-200">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    {t.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{t.description}</p>}
                  </div>
                  <Badge className={`ml-2 text-xs shrink-0 ${CATEGORIES[t.category]?.color || "bg-gray-100 text-gray-800"}`}>
                    {CATEGORIES[t.category]?.label || t.category}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={() => { setPreviewTemplate(t); setShowPreview(true); }} className="flex-1">
                    <Eye className="w-4 h-4 mr-1" /> Visualizar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(t)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-500 hover:text-red-600" onClick={() => deleteMut.mutate(t.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle>{editing ? "Editar Template" : "Novo Template"}</DialogTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowVars(!showVars)}
                className="gap-1"
              >
                <PanelRight className="w-4 h-4" />
                {showVars ? "Ocultar" : "Variáveis"}
              </Button>
            </div>
          </DialogHeader>

          <div className="flex flex-1 overflow-hidden">
            {/* Main editor area */}
            <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4">
              <div className="grid grid-cols-3 gap-3 shrink-0">
                <div className="space-y-1">
                  <Label>Nome do Template *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex: Contrato de Trabalho CLT"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Categoria</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORIES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Descrição</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Breve descrição..."
                  />
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                <ReactQuill
                  ref={quillRef}
                  theme="snow"
                  value={form.html_content}
                  onChange={(v) => setForm({ ...form, html_content: v })}
                  modules={{ toolbar: TOOLBAR }}
                  style={{ height: "100%", minHeight: "350px" }}
                  placeholder="Digite o conteúdo aqui. Use o painel de variáveis para inserir dados dinâmicos..."
                />
              </div>
            </div>

            {/* Variable panel */}
            {showVars && (
              <div className="w-72 border-l border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col shrink-0">
                <VariablePanel onInsert={insertVariable} />
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-3 border-t shrink-0">
            <Button variant="outline" onClick={closeEditor}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={!form.name || !form.html_content}
              className="bg-gradient-to-r from-purple-600 to-blue-600"
            >
              {editing ? "Salvar Alterações" : "Criar Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Preview: {previewTemplate?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <DocumentPreview
              html={previewTemplate?.html_content}
              company={company}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}