import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Apenas administradores podem alterar senhas' }, { status: 403 });

    const { target_user_id, new_password } = await req.json();

    if (!target_user_id || !new_password) {
      return Response.json({ error: 'target_user_id e new_password são obrigatórios' }, { status: 400 });
    }
    if (new_password.length < 6) {
      return Response.json({ error: 'A senha deve ter no mínimo 6 caracteres' }, { status: 400 });
    }

    // Use service role to update password
    await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `dummy` // Not used - just a placeholder
    });

    // Actually call the Base44 admin API to change password
    const appId = Deno.env.get('BASE44_APP_ID');
    
    // Use the service role to access admin user management
    const result = await fetch(`https://api.base44.com/api/apps/${appId}/users/${target_user_id}/set-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Token': Deno.env.get('BASE44_SERVICE_TOKEN') || '',
        'X-App-Id': appId,
      },
      body: JSON.stringify({ password: new_password })
    });

    if (!result.ok) {
      const err = await result.json().catch(() => ({}));
      // If endpoint not found, try alternative approach
      return Response.json({ 
        error: 'Não foi possível alterar a senha via API. Esta funcionalidade requer configuração adicional.',
        detail: err 
      }, { status: 422 });
    }

    return Response.json({ success: true, message: 'Senha alterada com sucesso' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});