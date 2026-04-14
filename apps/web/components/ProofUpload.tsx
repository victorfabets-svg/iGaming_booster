import React, { useState } from 'react';
import Icon from './Icon';

interface ProofUploadProps {
  onSubmit: (file: File) => void;
  loading?: boolean;
}

const ProofUpload: React.FC<ProofUploadProps> = ({ onSubmit, loading }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(e.target.files?.[0] || null);
  };

  const handleSubmit = () => {
    if (selectedFile) onSubmit(selectedFile);
  };

  return (
    <div className="upload-dropzone">
      <Icon name="upload" size={28} color="var(--text-secondary)" />
      <p style={{ marginTop: 8, fontSize: 13 }}>
        {selectedFile ? selectedFile.name : 'Selecione um comprovante (imagem ou PDF)'}
      </p>
      <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} />
      <button
        className="btn btn-primary"
        style={{ marginTop: 16 }}
        onClick={handleSubmit}
        disabled={!selectedFile || loading}
      >
        {loading ? 'Enviando…' : 'Enviar Comprovante'}
      </button>
    </div>
  );
};

export default ProofUpload;
