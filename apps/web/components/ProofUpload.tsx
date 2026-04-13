import React, { useState } from 'react';

interface ProofUploadProps {
  onSubmit: (file: File) => void;
}

const ProofUpload: React.FC<ProofUploadProps> = ({ onSubmit }) => {
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
      <button onClick={handleSubmit}>Send</button>
    </div>
  );
};

export default ProofUpload;