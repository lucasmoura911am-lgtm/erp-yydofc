import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";

export function useEntityPermission(entityName) {
  const [hasPermission, setHasPermission] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkPermission();
  }, [entityName]);

  const checkPermission = async () => {
    try {
      const user = await base44.auth.me();
      
      // Admins têm acesso total
      if (user.role === 'admin') {
        setHasPermission(true);
        setLoading(false);
        return;
      }

      // Busca o registro do usuário
      const users = await base44.entities.User.filter({ email: user.email });
      
      if (users.length === 0) {
        // Se não há registro, permite acesso (backward compatibility)
        setHasPermission(true);
        setLoading(false);
        return;
      }

      const userRecord = users[0];
      const allowedEntities = userRecord.allowed_entities || [];

      // Se a lista está vazia, permite tudo
      if (allowedEntities.length === 0) {
        setHasPermission(true);
        setLoading(false);
        return;
      }

      // Verifica se tem permissão para esta entidade
      const permitted = allowedEntities.includes(entityName);
      setHasPermission(permitted);
      setLoading(false);

      // Redireciona se não tiver permissão
      if (!permitted) {
        navigate('/Dashboard');
      }
    } catch (error) {
      console.error("Erro ao verificar permissões:", error);
      setHasPermission(false);
      setLoading(false);
    }
  };

  return { hasPermission, loading };
}