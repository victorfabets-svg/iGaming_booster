import { db } from '@shared/database/connection';

export interface RenderedTemplate {
  subject: string;
  html: string;
}

/**
 * Load an email template from DB and render it with the provided variables.
 * Returns null if template key not found.
 * 
 * @param key - Template key (e.g., 'email_verification')
 * @param vars - Variables to substitute (e.g., { verification_url, display_name, email })
 */
export async function loadAndRender(
  key: string,
  vars: Record<string, string>
): Promise<RenderedTemplate | null> {
  const result = await db.query<{
    subject: string;
    html_body: string;
    supported_variables: string[];
  }>(
    `SELECT subject, html_body, supported_variables 
     FROM notifications.email_templates 
     WHERE key = $1`,
    [key]
  );

  const template = result.rows[0];
  if (!template) {
    console.warn(JSON.stringify({
      event: 'template_not_found',
      key,
    }));
    return null;
  }

  // Check for unsupported variables (forward compat - still substitute but log)
  const supportedVars = template.supported_variables || [];
  const unknownVars = Object.keys(vars).filter(v => !supportedVars.includes(v));
  if (unknownVars.length > 0) {
    console.debug(JSON.stringify({
      event: 'template_unknown_vars',
      key,
      unknown_vars: unknownVars,
    }));
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
  let html = template.html_body;
  let subject = template.subject;

  for (const [varName, varValue] of Object.entries(vars)) {
    const escapedValue = escapeHtml(varValue);
    const placeholder = `{{${varName}}}`;
    html = html.split(placeholder).join(escapedValue);
    subject = subject.split(placeholder).join(escapedValue);
  }

  return { subject, html };
}