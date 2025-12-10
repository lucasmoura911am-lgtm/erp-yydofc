import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Shield, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Supervisors() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Team.filter({ company_id: user.company_id }) : [],
    enabled: !!user?.company_id,
  });

  const companyUsers = allUsers.filter(u => u.company_id === user?.company_id);
  const supervisors = companyUsers.filter(u => u.is_supervisor);

  const updateUserMutation = useMutation({
    mutationFn: ({ email, data }) => base44.entities.User.update(email, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['allUsers']);
      setDialogOpen(false);
    },
  });

  const handleEdit = (supervisor) => {
    setEditing(supervisor);
    setDialogOpen(true);
  };

  const handleToggleSupervisor = async (userEmail, currentStatus) => {
    const userData = allUsers.find(u => u.email === userEmail);
    await updateUserMutation.mutateAsync({
      email: userEmail,
      data: { 
        ...userData,
        is_supervisor: !currentStatus,
        supervised_teams: !currentStatus ? (userData.supervised_teams || []) : []
      }
    });
  };

  const handleUpdateTeams = async (supervisorEmail, teamIds) => {
    const userData = allUsers.find(u => u.email === supervisorEmail);
    await updateUserMutation.mutateAsync({
      email: supervisorEmail,
      data: { ...userData, supervised_teams: teamIds }
    });
    setDialogOpen(false);
  };

  const getTeamName = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    return team?.name || "Time desconhecido";
  };

  const filteredUsers = companyUsers.filter(u =>
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Supervisores</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Gerencie supervisores e suas equipes
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuários da Empresa</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Buscar usuários..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-4"
          />

          <div className="space-y-4">
            {filteredUsers.map((u) => (
              <div key={u.email} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4 flex-1">
                  <Avatar>
                    <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white">
                      {u.full_name?.charAt(0) || u.email?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{u.full_name || u.email}</p>
                    <p className="text-sm text-gray-500">{u.email}</p>
                    {u.is_supervisor && u.supervised_teams?.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {u.supervised_teams.map(teamId => (
                          <Badge key={teamId} variant="outline" className="text-xs">
                            {getTeamName(teamId)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {u.is_supervisor && (
                    <Button variant="outline" size="sm" onClick={() => handleEdit(u)}>
                      <Edit className="w-4 h-4 mr-1" />
                      Times
                    </Button>
                  )}
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={u.is_supervisor}
                      onCheckedChange={() => handleToggleSupervisor(u.email, u.is_supervisor)}
                    />
                    <Label className="text-sm">Supervisor</Label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Times do Supervisor</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="font-medium">{editing.full_name || editing.email}</p>
                <p className="text-sm text-gray-500">{editing.email}</p>
              </div>

              <div className="space-y-2">
                <Label>Times Supervisionados</Label>
                <div className="space-y-2">
                  {teams.map((team) => (
                    <div key={team.id} className="flex items-center space-x-2">
                      <Switch
                        checked={(editing.supervised_teams || []).includes(team.id)}
                        onCheckedChange={(checked) => {
                          const currentTeams = editing.supervised_teams || [];
                          const newTeams = checked
                            ? [...currentTeams, team.id]
                            : currentTeams.filter(t => t !== team.id);
                          handleUpdateTeams(editing.email, newTeams);
                        }}
                      />
                      <Label>{team.name}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}