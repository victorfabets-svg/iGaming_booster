/**
 * MyProfilePage - User profile settings
 */

import React, { useState } from 'react';
import { useAuth } from '../../state/AuthContext';
import { meApi } from '../../services/me-api';

export default function MyProfilePage() {
  const { user, refresh } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMessage, setPwdMessage] = useState('');

  const handleSaveName = async () => {
    const response = await meApi.updateMe(displayName);
    if (response.success) {
      setMessage('Nome alterado com sucesso!');
      setIsEditing(false);
      refresh();
    } else {
      setMessage('Erro ao alterar nome');
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      setPwdMessage('Nova senha deve ter pelo menos 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdMessage('As senhas não coincidem');
      return;
    }

    const response = await meApi.changePassword(currentPassword, newPassword);
    if (response.success) {
      setPwdMessage('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setPwdMessage(response.error?.message || 'Erro ao alterar senha');
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '2rem', color: '#fff' }}>
        Perfil
      </h1>

      {/* Display Name Card */}
      <div style={{
        background: '#0f0f1a',
        padding: '1.5rem',
        borderRadius: '12px',
        border: '1px solid #333',
        marginBottom: '2rem',
      }}>
        <h3 style={{ color: '#fff', marginBottom: '1rem' }}>Nome</h3>
        
        {isEditing ? (
          <div>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid #333',
                background: '#1a1a2e',
                color: '#fff',
                marginBottom: '1rem',
              }}
            />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={handleSaveName}
                style={{
                  background: '#FFD700',
                  color: '#1a1a2e',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Salvar
              </button>
              <button
                onClick={() => setIsEditing(false)}
                style={{
                  background: 'transparent',
                  color: '#a0a0b0',
                  border: '1px solid #333',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ color: '#a0a0b0', marginBottom: '1rem' }}>
              {user?.display_name || 'Não definido'}
            </p>
            <button
              onClick={() => setIsEditing(true)}
              style={{
                background: 'transparent',
                color: '#FFD700',
                border: '1px solid #FFD700',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Alterar nome
            </button>
          </div>
        )}
        
        {message && (
          <p style={{ color: '#FFD700', marginTop: '1rem' }}>{message}</p>
        )}
      </div>

      {/* Change Password Card */}
      <div style={{
        background: '#0f0f1a',
        padding: '1.5rem',
        borderRadius: '12px',
        border: '1px solid #333',
      }}>
        <h3 style={{ color: '#fff', marginBottom: '1rem' }}>Alterar Senha</h3>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a0a0b0', fontSize: '0.875rem' }}>
            Senha atual
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
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
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a0a0b0', fontSize: '0.875rem' }}>
            Nova senha
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
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
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a0a0b0', fontSize: '0.875rem' }}>
            Confirmar nova senha
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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

        {pwdMessage && (
          <p style={{ color: pwdMessage.includes('sucesso') ? '#FFD700' : '#ff6b6b', marginBottom: '1rem' }}>
            {pwdMessage}
          </p>
        )}

        <button
          onClick={handleChangePassword}
          style={{
            background: '#FFD700',
            color: '#1a1a2e',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Alterar senha
        </button>
      </div>
    </div>
  );
}