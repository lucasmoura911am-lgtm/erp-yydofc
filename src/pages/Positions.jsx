import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2, Briefcase } from "lucide-react";
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

export default function Positions() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPos, setEditingPos] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    level: "",
    description: ""
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const { data: positions = [] } = useQuery({
    queryKey: ['positions', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Position.filter({ company_id: user.company_id }, '-created_date') : [],
    enabled: !!user?.company_id,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Employee.filter({ company_id: user.company_id }) : [],
    enabled: !!user?.company_id,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Position.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['positions']);
      setDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Position.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['positions']);
      setDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Position.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['positions']);
    },
  });

  const resetForm = () => {
    setFormData({ name: "", level: "", description: "" });
    setEditingPos(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...formData, company_id: user.company_id };
    
    if (editingPos) {
      updateMutation.mutate({ id: editingPos.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (pos) => {
    setEditingPos(pos);
    setFormData({
      name: pos.name || "",
      level: pos.level || "",
      description: pos.description || ""
    });
    setDialogOpen(true);
  };

  const handleDelete = (id) => {
    if (confirm("Tem certeza que deseja excluir este cargo?")) {
      deleteMutation.mutate(id);
    }
  };

  const getEmployeeCount = (posId) => {
    return employees.filter(e => e.position_id === posId).length;
  };

  const levelColors = {
    junior: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    pleno: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    senior: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    coordenador: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    gerente: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    diretor: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400"
  };

  const levelLabels = {
    junior: "Júnior",
    pleno: "Pleno",
    senior: "Sênior",
    coordenador: "Coordenador",
    gerente: "Gerente",
    diretor: "Diretor"
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Cargos</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Gerencie os cargos da empresa
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
          Novo Cargo
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {positions.map((pos) => (
          <Card key={pos.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg">
                    <Briefcase className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{pos.name}</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      {getEmployeeCount(pos.id)} funcionários
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(pos)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(pos.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {pos.level && (
                <Badge variant="outline" className={`${levelColors[pos.level]} mb-3`}>
                  {levelLabels[pos.level]}
                </Badge>
              )}
              {pos.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {pos.description}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPos ? "Editar Cargo" : "Novo Cargo"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Cargo *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Nível Hierárquico</Label>
              <Select
                value={formData.level}
                onValueChange={(value) => setFormData({ ...formData, level: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="junior">Júnior</SelectItem>
                  <SelectItem value="pleno">Pleno</SelectItem>
                  <SelectItem value="senior">Sênior</SelectItem>
                  <SelectItem value="coordenador">Coordenador</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="diretor">Diretor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
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
                {editingPos ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}