/**
 * Email Templates Page — admin can edit subject + html for each notification template.
 */

import React, { useEffect, useState } from 'react';
import { adminApi, EmailTemplate } from '../../services/admin-api';

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selected, setSelected] = useState<EmailTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    adminApi.listEmailTemplates().then(response => {
      if (response.success && response.data) {
        setTemplates(response.data.templates);
      }
      setIsLoading(false);
    });
  }, []);

  const handleSelect = (template: EmailTemplate) => {
    setSelected(template);
    setSubject(template.subject);
    setHtmlBody(template.html_body);
    setDescription(template.description || '');
    setMessage(null);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setMessage(null);

    const response = await adminApi.updateEmailTemplate(selected.key, {
      subject,
      html_body: htmlBody,
      description,
    });

    if (response.success) {
      setMessage({ kind: 'success', text: 'Template salvo com sucesso.' });
      const listRes = await adminApi.listEmailTemplates();
      if (listRes.success && listRes.data) setTemplates(listRes.data.templates);
    } else {
      setMessage({ kind: 'error', text: response.error?.message || 'Erro ao salvar.' });
    }
    setSaving(false);
  };

  const handlePreview = async () => {
    if (!selected) return;
    const response = await adminApi.previewEmailTemplate(selected.key);
    if (response.success && response.data) {
      const win = window.open('', '_blank');
      if (win) win.document.write(response.data.html);
    }
  };

  const handleTestSend = async () => {
    if (!selected) return;
    const email = prompt('Digite o email para teste:');
    if (!email) return;
    const response = await adminApi.testSendEmailTemplate(selected.key, { to: email });
    if (response.success && response.data?.ok) {
      setMessage({ kind: 'success', text: `Email de teste enviado para ${email}.` });
    } else {
      setMessage({ kind: 'error', text: response.error?.message || 'Erro ao enviar.' });
    }
  };

  if (isLoading) {
    return <div className="empty-state">Carregando…</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Templates de Email</h1>
          <p className="page-subtitle">Edite o assunto e o HTML dos emails enviados pelo sistema.</p>
        </div>
      </div>

      <div className="split-pane">
        <div className="split-pane-list">
          {templates.map(template => (
            <button
              key={template.key}
              type="button"
              className={`list-item ${selected?.key === template.key ? 'active' : ''}`}
              onClick={() => handleSelect(template)}
            >
              {template.key}
            </button>
          ))}
        </div>

        <div className="split-pane-detail">
          {selected ? (
            <div className="card">
              <h2 className="card-title">{selected.key}</h2>

              <div className="field">
                <label>Assunto</label>
                <input
                  type="text"
                  className="input"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Variáveis disponíveis</label>
                <p className="text-secondary text-sm">
                  {selected.supported_variables.join(', ') || '—'}
                </p>
                <p className="field-help">
                  Use <code className="mono">{'{{nome_da_variavel}}'}</code> no HTML para substituir.
                </p>
              </div>

              <div className="field">
                <label>Corpo HTML</label>
                <textarea
                  className="input textarea-mono"
                  value={htmlBody}
                  onChange={e => setHtmlBody(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Descrição</label>
                <input
                  type="text"
                  className="input"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              {message && (
                <div className={`alert-box alert-${message.kind} mb-4`}>
                  {message.text}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Salvando…' : 'Salvar'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={handlePreview}>
                  Preview
                </button>
                <button type="button" className="btn btn-ghost" onClick={handleTestSend}>
                  Test Send
                </button>
              </div>
            </div>
          ) : (
            <div className="card empty-state">Selecione um template para editar.</div>
          )}
        </div>
      </div>
    </div>
  );
}
