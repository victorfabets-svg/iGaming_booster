export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/**
 * Send an email using Resend API
 * Returns { ok: boolean, id?: string, error?: string }
 * Never throws - all errors are reported in the result
 */
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<SendEmailResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;

  // If no API key is configured, log a warning and return early
  if (!resendApiKey) {
    console.warn(JSON.stringify({
      event: 'email_skipped',
      reason: 'no_api_key',
      to,
    }));
    return { ok: false, error: 'no_api_key' };
  }

  // If no FROM address is configured, log a warning
  if (!emailFrom) {
    console.warn(JSON.stringify({
      event: 'email_config_incomplete',
      reason: 'no_from_address',
      to,
    }));
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: emailFrom || 'onboarding@resend.dev',
        to,
        subject,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(JSON.stringify({
        event: 'email_send_failed',
        status: response.status,
        error: data,
        to,
      }));
      return { ok: false, error: data.message || 'API_ERROR' };
    }

    return { ok: true, id: data.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    console.error(JSON.stringify({
      event: 'email_send_error',
      error: errorMessage,
      to,
    }));
    return { ok: false, error: errorMessage };
  }
}