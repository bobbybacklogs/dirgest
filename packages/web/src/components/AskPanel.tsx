import { useState, useCallback } from 'react';
import type { AskResponse } from '../types';

interface Props {
  response: AskResponse | null;
  onAsk: (question: string) => void;
  onSave?: (title: string, question: string, fit: boolean) => void;
}

function titleFromAsk(question: string, response: AskResponse): string {
  if (response.fit) return question.trim();
  const sentence = response.alternative.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/)[0] || response.alternative;
  const cleaned = sentence.replace(/^(implement|add|create|build|try this instead:?)\s+/i, '').replace(/[.!?]+$/, '').trim();
  const title = cleaned || question.trim();
  return title.length > 80 ? `${title.slice(0, 77).trimEnd()}...` : title;
}

export function AskPanel({ response, onAsk, onSave }: Props) {
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [lastQuestion, setLastQuestion] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSubmit = useCallback(() => {
    const q = input.trim();
    if (q) {
      setLastQuestion(q);
      setSaved(false);
      onAsk(q);
    }
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
              {onSave && (
                <div style={{ marginTop: '0.75rem' }}>
                  <button
                    className="btn btn-sm"
                    disabled={saved}
                    onClick={() => {
                      onSave(titleFromAsk(lastQuestion, response), lastQuestion, true);
                      setSaved(true);
                    }}
                  >
                    {saved ? 'Saved' : 'Remember this idea'}
                  </button>
                </div>
              )}
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
              {onSave && (
                <div style={{ marginTop: '0.75rem' }}>
                  <button
                    className="btn btn-sm"
                    disabled={saved}
                    onClick={() => {
                      onSave(titleFromAsk(lastQuestion, response), lastQuestion, false);
                      setSaved(true);
                    }}
                  >
                    {saved ? 'Saved' : 'Remember this alternative'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
