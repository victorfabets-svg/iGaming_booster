import React, { useState } from 'react';

interface ProofUploadProps {
  onSubmit: (file: File) => void;
  loading?: boolean;
}

const ProofUpload: React.FC<ProofUploadProps> = ({ onSubmit, loading }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
  };

  const handleSubmit = () => {
    if (selectedFile) {
      onSubmit(selectedFile);
    }
  };

  return (
    <div>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleSubmit} disabled={loading}>Send</button>
    </div>
  );
};

export default ProofUpload;