/**
 * Email Templates Page - Admin email templates management
 */

import React from 'react';
import { useEffect, useState } from 'react';
import { adminApi, EmailTemplate } from '../../services/admin-api';

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selected, setSelected] = useState<EmailTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Edit form state
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
    setMessage('');
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setMessage('');

    const response = await adminApi.updateEmailTemplate(selected.key, {
      subject,
      html_body: htmlBody,
      description,
    });

    if (response.success) {
      setMessage('Template salvo com sucesso!');
      // Refresh list
      const listRes = await adminApi.listEmailTemplates();
      if (listRes.success && listRes.data) {
        setTemplates(listRes.data.templates);
      }
    } else {
      setMessage(response.error?.message || 'Erro ao salvar');
    }
    setSaving(false);
  };

  const handlePreview = async () => {
    if (!selected) return;
    
    const response = await adminApi.previewEmailTemplate(selected.key);
    if (response.success && response.data) {
      // Open in new window
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(response.data.html);
      }
    }
  };

  const handleTestSend = async () => {
    if (!selected) return;
    
    const email = prompt('Digite o email para teste:');
    if (!email) return;

    const response = await adminApi.testSendEmailTemplate(selected.key, { to: email });
    if (response.success && response.data?.ok) {
      setMessage(`Email de teste enviado para ${email}`);
    } else {
      setMessage(response.error?.message || 'Erro ao enviar');
    }
  };

  if (isLoading) {
    return <div style={{ color: '#fff' }}>Carregando...</div>;
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '2rem', color: '#fff' }}>
        Templates de Email
      </h1>

      <div style={{ display: 'flex', gap: '2rem' }}>
        {/* Sidebar - template list */}
        <div style={{ width: '250px' }}>
          {templates.map(template => (
            <button
              key={template.key}
              onClick={() => handleSelect(template)}
              style={{
                display: 'block',
                width: '100%',
                padding: '1rem',
                marginBottom: '0.5rem',
                background: selected?.key === template.key ? '#FFD700' : '#0f0f1a',
                color: selected?.key === template.key ? '#1a1a2e' : '#fff',
                border: 'none',
                borderRadius: '8px',
                textAlign: 'left',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {template.key}
            </button>
          ))}
        </div>

        {/* Main content - editor */}
        <div style={{ flex: 1 }}>
          {selected ? (
            <div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a0a0b0' }}>
                  Assunto
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #333',
                    background: '#1a1a2e',
                    color: '#fff',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a0a0b0' }}>
                  Variáveis disponíveis: {selected.supported_variables.join(', ')}
                </label>
                <p style={{ color: '#666', fontSize: '0.75rem' }}>
                  Use {'{{nome_da_variavel}}'} no HTML
                </p>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a0a0b0' }}>
                  Corpo HTML
                </label>
                <textarea
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  style={{
                    width: '100%',
                    height: '300px',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #333',
                    background: '#1a1a2e',
                    color: '#fff',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a0a0b0' }}>
                  Descrição
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #333',
                    background: '#1a1a2e',
                    color: '#fff',
                  }}
                />
              </div>

              {message && (
                <p style={{ 
                  color: message.includes('sucesso') ? '#FFD700' : '#ff6b6b', 
                  marginBottom: '1rem' 
                }}>
                  {message}
                </p>
              )}

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    background: '#FFD700',
                    color: '#1a1a2e',
                    border: 'none',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  onClick={handlePreview}
                  style={{
                    background: 'transparent',
                    color: '#FFD700',
                    border: '1px solid #FFD700',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  Preview
                </button>
                <button
                  onClick={handleTestSend}
                  style={{
                    background: 'transparent',
                    color: '#a0a0b0',
                    border: '1px solid #333',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  Test Send
                </button>
              </div>
            </div>
          ) : (
            <div style={{ color: '#a0a0b0', textAlign: 'center', padding: '3rem' }}>
              Selecione um template para editar
            </div>
          )}
        </div>
      </div>
    </div>
  );
}