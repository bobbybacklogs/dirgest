import { useState, useCallback } from 'react';
import type { AskResponse } from '../types';

interface Props {
  response: AskResponse | null;
  onAsk: (question: string) => void;
}

export function AskPanel({ response, onAsk }: Props) {
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSubmit = useCallback(() => {
    const q = input.trim();
    if (q) onAsk(q);
  }, [input, onAsk]);

  const handleCopy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, []);

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Ask about a feature idea</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            className="ask-input"
            placeholder="e.g. Add dark mode toggle, Integrate Stripe payments, Add real-time collaboration"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <button className="btn btn-primary" onClick={handleSubmit}>
            Evaluate
          </button>
        </div>
      </div>

      {response && (
        <div className={`verdict ${response.fit ? 'fit' : 'no-fit'}`}>
          <div className="verdict-badge">
            {response.fit ? 'Good fit' : 'Not the best fit'}
          </div>
          <div className="verdict-reasoning">{response.reasoning}</div>

          {response.fit ? (
            <div>
              <div className="verdict-prompt-label">Implementation prompt</div>
              <div className="suggestion-prompt" style={{ position: 'relative' }}>
                <button
                  className="btn btn-sm btn-copy"
                  onClick={() => handleCopy(response.prompt)}
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
                {response.prompt}
              </div>
            </div>
          ) : (
            <div>
              <div className="verdict-prompt-label">Better alternative</div>
              <div className="suggestion-prompt" style={{ position: 'relative' }}>
                <button
                  className="btn btn-sm btn-copy"
                  onClick={() => handleCopy(response.alternative)}
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
                {response.alternative}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
