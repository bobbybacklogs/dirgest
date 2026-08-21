import { useState, useCallback, useRef } from 'react';
import type { FeatureReview } from '../types';

const MAX_BYTES = 64 * 1024;
const ACCEPTED = ['.md', '.txt'];

interface Props {
  review: FeatureReview | null;
  onReview: (content: string, filename: string) => void;
}

export function ReviewPanel({ review, onReview }: Props) {
  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (!ACCEPTED.includes(extension)) {
        setError(`Feature files must be ${ACCEPTED.join(' or ')}; received "${file.name}".`);
        setFilename(null);
        return;
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name} is ${Math.ceil(file.size / 1024)} KB; the limit is ${MAX_BYTES / 1024} KB.`);
        setFilename(null);
        return;
      }
      setError(null);
      setFilename(file.name);
      onReview(await file.text(), file.name);
    },
    [onReview],
  );

  const handleCopy = useCallback(async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }, []);

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Review a feature list</span>
        </div>
        <p className="card-subtitle">
          Upload a .md or .txt file with one feature per line or list item (max {MAX_BYTES / 1024} KB).
          Each feature is compared against this codebase.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".md,.txt,text/markdown,text/plain"
          style={{ display: 'none' }}
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <button className="btn btn-primary" onClick={() => inputRef.current?.click()}>
          {filename ? `Reviewing ${filename}` : 'Choose feature file'}
        </button>
        {error && <div className="verdict no-fit">{error}</div>}
      </div>

      {review && (
        <>
          <div className="card">
            <div className="card-header">
              <span className="card-title">{review.source ?? 'Feature review'}</span>
            </div>
            <p className="card-subtitle">
              {review.total} reviewed &middot; {review.fitCount} good fit &middot; {review.misfitCount} not a fit
            </p>
          </div>

          {review.misfits.length > 0 && (
            <div className="verdict no-fit">
              <div className="verdict-badge">Not a fit ({review.misfits.length})</div>
              {review.misfits.map((misfit, index) => (
                <div key={`${misfit.feature}-${index}`} style={{ marginTop: '1rem' }}>
                  <div className="verdict-prompt-label">{misfit.feature}</div>
                  <div className="verdict-reasoning">{misfit.reasoning}</div>
                  <div className="suggestion-prompt" style={{ position: 'relative' }}>
                    <button
                      className="btn btn-sm btn-copy"
                      onClick={() => handleCopy(`alt-${index}`, misfit.alternative)}
                    >
                      {copied === `alt-${index}` ? 'Copied' : 'Copy'}
                    </button>
                    {misfit.alternative}
                  </div>
                </div>
              ))}
            </div>
          )}

          {review.fits.length > 0 && (
            <div className="verdict fit">
              <div className="verdict-badge">Good fits ({review.fits.length})</div>
              {review.fits.map((fit, index) => (
                <div key={`${fit.feature}-${index}`} style={{ marginTop: '1rem' }}>
                  <div className="verdict-prompt-label">
                    {index + 1}. {fit.title}
                  </div>
                  <div className="verdict-reasoning">{fit.reasoning}</div>
                  <div className="suggestion-prompt" style={{ position: 'relative' }}>
                    <button
                      className="btn btn-sm btn-copy"
                      onClick={() => handleCopy(`fit-${index}`, fit.prompt)}
                    >
                      {copied === `fit-${index}` ? 'Copied' : 'Copy'}
                    </button>
                    {fit.prompt}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
