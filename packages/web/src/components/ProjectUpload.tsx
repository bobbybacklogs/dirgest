import { useRef, useState, useCallback } from 'react';

interface Props {
  onUpload: (files: { path: string; content: string }[]) => void;
}

async function readFiles(fileList: FileList): Promise<{ path: string; content: string }[]> {
  const files: { path: string; content: string }[] = [];
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    if (file.size > 512_000) continue;
    const content = await file.text();
    files.push({ path: file.webkitRelativePath || file.name, content });
  }
  return files;
}

export function ProjectUpload({ onUpload }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    async (fileList: FileList) => {
      const files = await readFiles(fileList);
      if (files.length > 0) onUpload(files);
    },
    [onUpload],
  );

  return (
    <div
      className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
        }}
      />
      <h2>Drop your project here</h2>
      <p>or click to select files</p>
      <p className="hint">Dirgest will analyze your source files locally &mdash; nothing leaves your machine until you generate suggestions.</p>
    </div>
  );
}
