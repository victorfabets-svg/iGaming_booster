import React, { useState } from 'react';

export interface UploadScreenProps {
  onSubmit: (file: File) => void;
  isSubmitting: boolean;
}

export const UploadScreen: React.FC<UploadScreenProps> = ({ onSubmit, isSubmitting }) => {
  const [file, setFile] = useState<File | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
  };

  const handleSubmit = () => {
    if (file) onSubmit(file);
  };

  return (
    <div className="card" style={{ maxWidth: 480, margin: '48px auto', padding: 32, textAlign: 'center' }}>
      <h2 style={{ marginBottom: 8 }}>Enviar Comprovante</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
        Aceita imagem ou PDF.
      </p>
      <input
        type="file"
        accept="image/*,application/pdf"
        onChange={handleChange}
        disabled={isSubmitting}
        style={{ marginBottom: 16 }}
      />
      {file && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Selecionado: {file.name}
        </p>
      )}
      <button
        className="btn btn-primary"
        onClick={handleSubmit}
        disabled={!file || isSubmitting}
      >
        {isSubmitting ? 'Enviando…' : 'Enviar'}
      </button>
    </div>
  );
};

export default UploadScreen;