import { useRef, useState, useCallback, useEffect } from 'react';

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
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    folderRef.current?.setAttribute('webkitdirectory', '');
    folderRef.current?.setAttribute('directory', '');
  }, []);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const files = await readFiles(fileList);
      if (files.length === 0) {
        setError('No readable source files under 512 KB were found.');
        return;
      }
      setError(null);
      onUpload(files);
    },
    [onUpload],
  );

  return (
    <div className="landing">
      <section className="landing-copy">
        <p className="hero-kicker">Local project briefing</p>
        <h2>Read the repo. Decide what to build next.</h2>
        <p>
          Dirgest samples the important files, names the stack, and hands you coding prompts you can paste into an agent.
        </p>
        <ul className="landing-points">
          <li>Drop a folder or a handful of source files</li>
          <li>Generate ideas in balanced, growth, ux, technical, or wild mode</li>
          <li>Save prompts across runs and copy them in one shot</li>
        </ul>
      </section>

      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={filesRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={folderRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <h3>Drop a project folder</h3>
        <p>or choose files from disk. Analysis stays on this machine until you generate ideas.</p>
        <div className="quick-row">
          <button className="btn btn-primary" type="button" onClick={() => folderRef.current?.click()}>
            Choose folder
          </button>
          <button className="btn" type="button" onClick={() => filesRef.current?.click()}>
            Choose files
          </button>
        </div>
        {error && <p className="upload-error">{error}</p>}
      </div>
    </div>
  );
}
