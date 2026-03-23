import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Apenas administradores podem realizar esta ação' }, { status: 403 });

    const { email } = await req.json();
    if (!email) return Response.json({ error: 'Email é obrigatório' }, { status: 400 });

    // Send password reset email to the target user
    await base44.auth.resetPasswordRequest(email);

    return Response.json({ success: true, message: `Email de redefinição de senha enviado para ${email}` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});