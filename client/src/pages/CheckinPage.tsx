import { useState, useEffect, useRef } from 'react';
import { startCheckin, submitAnswer } from '../services/api';

interface Message {
  type: 'bot' | 'user' | 'system';
  text: string;
}

interface Question {
  id: string;
  category: string;
  text: string;
  type: 'scale' | 'text' | 'choice' | 'number';
  options?: string[];
}

export default function CheckinPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [checkinId, setCheckinId] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [scaleValue, setScaleValue] = useState(5);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 1 });
  const [started, setStarted] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addBotMessage = (text: string) => {
    setMessages(prev => [...prev, { type: 'bot', text }]);
  };

  const addUserMessage = (text: string) => {
    setMessages(prev => [...prev, { type: 'user', text }]);
  };

  const addSystemMessage = (text: string) => {
    setMessages(prev => [...prev, { type: 'system', text }]);
  };

  const handleStart = async () => {
    setStarted(true);
    setLoading(true);
    try {
      const res = await startCheckin();

      if (res.status === 'already_completed') {
        addSystemMessage(res.message);
        setCompleted(true);
      } else {
        setCheckinId(res.checkin_id);
        setProgress({ current: res.answered_count, total: res.total_questions });

        const greeting = res.name
          ? `Hey ${res.name}! Let's do your daily check-in.`
          : "Hey there! Let's do your daily check-in.";
        addBotMessage(greeting);

        // Short delay before first question
        setTimeout(() => {
          if (res.next_question) {
            setCurrentQuestion(res.next_question);
            addBotMessage(res.next_question.text);
          }
        }, 600);
      }
    } catch (err) {
      addSystemMessage('Failed to start check-in. Is the server running?');
    }
    setLoading(false);
  };

  const handleSubmit = async (answer?: string) => {
    if (!currentQuestion || !checkinId) return;

    const finalAnswer = answer || input || (currentQuestion.type === 'scale' ? String(scaleValue) : '');
    if (!finalAnswer.trim()) return;

    addUserMessage(finalAnswer);
    setInput('');
    setLoading(true);
    setCurrentQuestion(null);

    try {
      const res = await submitAnswer(checkinId, currentQuestion.id, currentQuestion.category, finalAnswer);

      if (res.status === 'completed') {
        setCompleted(true);
        setProgress({ current: res.answered_count || progress.total, total: progress.total });

        // Show closing message
        setTimeout(() => {
          addBotMessage(res.message);

          // Show weather if available
          if (res.weather) {
            addSystemMessage(
              `Weather today: ${res.weather.weather_description}, ${Math.round(res.weather.temperature_high)}°F / ${Math.round(res.weather.temperature_low)}°F, humidity ${res.weather.humidity}%`
            );
          }

          // Show new insights if any
          if (res.new_insights && res.new_insights.length > 0) {
            setTimeout(() => {
              addSystemMessage('New patterns discovered:');
              for (const insight of res.new_insights.slice(0, 2)) {
                addBotMessage(`${insight.description}\n\n${insight.suggestion}`);
              }
            }, 800);
          }
        }, 500);
      } else {
        setProgress({ current: res.answered_count, total: res.total_questions });

        // Add next question with slight delay for natural feel
        setTimeout(() => {
          if (res.next_question) {
            setCurrentQuestion(res.next_question);
            addBotMessage(res.next_question.text);
          }
        }, 400);
      }
    } catch (err) {
      addSystemMessage('Something went wrong. Please try again.');
      setCurrentQuestion(currentQuestion); // Restore question
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!started) {
    return (
      <div className="empty-state">
        <h2>Daily Check-In</h2>
        <p>Take a couple minutes to reflect on your day.<br />It's a quick conversation, not a chore.</p>
        <button className="start-btn" onClick={handleStart}>
          Start Today's Check-In
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="progress-bar">
        <div className="fill" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
      </div>

      <div className="chat-container">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-bubble ${msg.type}`}>
            {msg.text.split('\n').map((line, j) => (
              <span key={j}>{line}{j < msg.text.split('\n').length - 1 && <br />}</span>
            ))}
          </div>
        ))}

        {loading && (
          <div className="chat-bubble bot">
            <div className="typing-indicator">
              <span /><span /><span />
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {!completed && currentQuestion && (
        <div className="input-area">
          <div className="inner">
            {currentQuestion.type === 'choice' && currentQuestion.options ? (
              <div className="choices" style={{ width: '100%', justifyContent: 'center' }}>
                {currentQuestion.options.map(opt => (
                  <button key={opt} className="choice-btn" onClick={() => handleSubmit(opt)}>
                    {opt}
                  </button>
                ))}
              </div>
            ) : currentQuestion.type === 'scale' ? (
              <div style={{ width: '100%' }}>
                <div className="scale-input">
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>1</span>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={scaleValue}
                    onChange={e => setScaleValue(parseInt(e.target.value))}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>10</span>
                  <span className="scale-value">{scaleValue}</span>
                  <button className="send-btn" onClick={() => handleSubmit(String(scaleValue))}>
                    Send
                  </button>
                </div>
              </div>
            ) : (
              <>
                <input
                  type={currentQuestion.type === 'number' ? 'number' : 'text'}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={currentQuestion.type === 'number' ? 'Enter a number...' : 'Type your response...'}
                  autoFocus
                />
                <button className="send-btn" onClick={() => handleSubmit()} disabled={!input.trim()}>
                  Send
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
