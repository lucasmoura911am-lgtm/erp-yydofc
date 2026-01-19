import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2, Megaphone, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export default function Announcements() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    type: "info",
    active: true,
    target_audience: "all",
    expires_at: ""
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
    } catch (error) {
      console.error("Erro ao carregar usuário:", error);
    }
  };

  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => base44.entities.Announcement.list('-created_date'),
    initialData: [],
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Announcement.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['announcements']);
      setDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Announcement.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['announcements']);
      setDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Announcement.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['announcements']);
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      message: "",
      type: "info",
      active: true,
      target_audience: "all",
      expires_at: ""
    });
    setEditingAnnouncement(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (editingAnnouncement) {
      updateMutation.mutate({ id: editingAnnouncement.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (announcement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title || "",
      message: announcement.message || "",
      type: announcement.type || "info",
      active: announcement.active !== undefined ? announcement.active : true,
      target_audience: announcement.target_audience || "all",
      expires_at: announcement.expires_at || ""
    });
    setDialogOpen(true);
  };

  const handleDelete = (id) => {
    if (confirm("Tem certeza que deseja excluir este aviso?")) {
      deleteMutation.mutate(id);
    }
  };

  const typeColors = {
    info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
  };

  const typeLabels = {
    info: "Informação",
    warning: "Aviso",
    success: "Sucesso",
    error: "Importante"
  };

  const audienceLabels = {
    all: "Todos",
    admin: "Administradores",
    employee: "Funcionários"
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Avisos do Sistema</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Gerencie avisos e comunicados na tela inicial
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Aviso
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {announcements.map((announcement) => (
          <Card key={announcement.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={typeColors[announcement.type]}>
                      {typeLabels[announcement.type]}
                    </Badge>
                    <Badge variant="outline">
                      {audienceLabels[announcement.target_audience]}
                    </Badge>
                    {announcement.active ? (
                      <Badge className="bg-green-500">Ativo</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-100">Inativo</Badge>
                    )}
                    {announcement.expires_at && (
                      <Badge variant="outline" className="text-xs">
                        Expira em: {new Date(announcement.expires_at).toLocaleDateString('pt-BR')}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-xl">{announcement.title}</CardTitle>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {announcement.message}
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(announcement)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(announcement.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}

        {announcements.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Megaphone className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Nenhum aviso cadastrado
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Crie avisos para exibir na tela inicial do sistema
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAnnouncement ? "Editar Aviso" : "Novo Aviso"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                placeholder="Ex: Manutenção programada"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Mensagem *</Label>
              <Textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                required
                rows={4}
                placeholder="Digite a mensagem do aviso..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Informação</SelectItem>
                    <SelectItem value="warning">Aviso</SelectItem>
                    <SelectItem value="success">Sucesso</SelectItem>
                    <SelectItem value="error">Importante</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Público Alvo</Label>
                <Select
                  value={formData.target_audience}
                  onValueChange={(value) => setFormData({ ...formData, target_audience: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="admin">Administradores</SelectItem>
                    <SelectItem value="employee">Funcionários</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Data de Expiração (opcional)</Label>
              <Input
                type="date"
                value={formData.expires_at}
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
              <Label htmlFor="active" className="cursor-pointer">
                Aviso ativo
              </Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-purple-600 to-blue-600"
              >
                {editingAnnouncement ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}