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

    const appId = Deno.env.get('BASE44_APP_ID');

    // Call the Base44 platform API to reset user password
    const result = await fetch(`https://api.base44.com/api/apps/${appId}/admin/users/${target_user_id}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Id': appId,
        'Authorization': `Bearer ${req.headers.get('Authorization')?.split(' ')[1] || ''}`,
      },
      body: JSON.stringify({ new_password })
    });

    if (result.ok) {
      return Response.json({ success: true, message: 'Senha alterada com sucesso' });
    }

    const errData = await result.json().catch(() => ({}));
    return Response.json({ 
      error: errData.message || errData.error || `Erro ${result.status} ao alterar senha`
    }, { status: result.status });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});