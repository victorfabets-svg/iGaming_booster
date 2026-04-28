export interface RenderedTemplate {
  subject: string;
  html: string;
}

/**
 * Hardcoded fallback templates used when DB is unreachable or template is missing.
 * These are minimal but functional templates.
 */
export const FALLBACK_TEMPLATES: Record<string, RenderedTemplate> = {
  email_verification: {
    subject: 'Confirme seu email — Tipster Engine',
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirme seu email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <h1 style="color: #1a1a2e; font-size: 24px; margin: 0 0 24px 0;">Confirme seu email</h1>
      <p style="color: #4a4a68; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Olá,
      </p>
      <p style="color: #4a4a68; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;">
        Obrigado por se cadastrar na Tipster Engine. Por favor, confirme seu email klikke no botão abaixo:
      </p>
      <a href="{{verification_url}}" style="display: inline-block; background: #FFD700; color: #1a1a2e; font-weight: 600; font-size: 16px; padding: 16px 32px; border-radius: 8px; text-decoration: none; margin-bottom: 32px;">
        Confirmar meu email
      </a>
      <p style="color: #8a8aa3; font-size: 14px; line-height: 1.6; margin: 0;">
        Se você não criou uma conta na Tipster Engine, pode ignorar este email.
      </p>
    </div>
    <p style="text-align: center; color: #8a8aa3; font-size: 12px; margin-top: 24px;">
      © 2024 Tipster Engine. Todos os direitos reservados.
    </p>
  </div>
</body>
</html>`,
  },
};

/**
 * Render a fallback template with variables.
 * Falls back to the template if vars are missing.
 */
export function renderFallback(key: string, vars: Record<string, string>): RenderedTemplate {
  const template = FALLBACK_TEMPLATES[key];
  
  if (!template) {
    // Generic fallback if specific template not found
    return {
      subject: 'Tipster Engine',
      html: '<p>Template não encontrado.</p>',
    };
  }

  // HTML-escape a value
  function escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Substitute variables
  let html = template.html;
  let subject = template.subject;

  for (const [varName, varValue] of Object.entries(vars)) {
    const escapedValue = escapeHtml(varValue);
    const placeholder = `{{${varName}}`;
    html = html.split(placeholder).join(escapedValue);
    subject = subject.split(placeholder).join(escapedValue);
  }

  return { subject, html };
}