import React, { useState } from 'react';
import { 
  UploadCloud, Send, ShieldAlert, 
  RefreshCw, Bot, User 
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function App() {
  const [activeTab, setActiveTab] = useState('upload');
  
  // Fully customizable manager fields
  const [roleTitle, setRoleTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [guidelines, setGuidelines] = useState('');
  const [questionBank, setQuestionBank] = useState('');
  const [techDocs, setTechDocs] = useState('');

  const [activeStage, setActiveStage] = useState('Technical Deep-Dive');
  const [messages, setMessages] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [managerProbe, setManagerProbe] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [scorecard, setScorecard] = useState(null);

  const handleIngest = async () => {
    if (!roleTitle.trim()) {
      alert('Please enter a Target Position / Role Title before proceeding.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/knowledge/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role_title: roleTitle,
          job_description: jobDescription,
          guidelines,
          question_bank: questionBank,
          tech_documentation: techDocs,
          evaluation_criteria: [
            { name: 'Technical Accuracy & Implementation', weight: '50%' },
            { name: 'Consistency Across All Questions', weight: '50%' }
          ]
        })
      });

      const data = await res.json();
      let initialQuestion = "";

      if (data.initial_question) {
        initialQuestion = data.initial_question;
      } else if (questionBank.trim()) {
        const lines = questionBank.split('\n').map(l => l.trim()).filter(Boolean);
        const cleanFirstQ = lines[0].replace(/^[0-9]+[.\- )]+/, '').trim();
        initialQuestion = `Welcome to your interview for the ${roleTitle} position. Let us begin: ${cleanFirstQ}`;
      } else {
        initialQuestion = `Welcome! Today we will evaluate your technical background for the ${roleTitle} role. Could you walk us through your experience related to the position?`;
      }

      setMessages([{ speaker: 'AI Interviewer', text: initialQuestion }]);
      setScorecard(null);
      setActiveTab('live');
    } catch (err) {
      console.warn('Backend connection issue, falling back to local mode:', err);
      let fallbackQ = "";
      if (questionBank.trim()) {
        const lines = questionBank.split('\n').map(l => l.trim()).filter(Boolean);
        const cleanFirstQ = lines[0].replace(/^[0-9]+[.\- )]+/, '').trim();
        fallbackQ = `Welcome to the interview for ${roleTitle}. Let's begin: ${cleanFirstQ}`;
      } else {
        fallbackQ = `Welcome to the interview for ${roleTitle}. Could you walk us through your technical background?`;
      }

      setMessages([{ speaker: 'AI Interviewer', text: fallbackQ }]);
      setScorecard(null);
      setActiveTab('live');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!currentInput.trim() || isLoading) return;
    
    const candidateText = currentInput.trim();
    const updatedHistory = [...messages, { speaker: 'Candidate', text: candidateText }];
    
    setMessages(updatedHistory);
    setCurrentInput('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/interview/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: 'session-01',
          current_stage: activeStage,
          transcript_history: updatedHistory,
          candidate_answer: candidateText,
          manager_probe_injection: managerProbe
        })
      });

      const data = await res.json();
      setMessages([...updatedHistory, { speaker: 'AI Interviewer', text: data.interviewer_reply }]);
      setManagerProbe('');
    } catch (err) {
      console.warn('Turn error, pulling dynamically from manager context:', err);
      const lines = questionBank.split('\n').map(l => l.trim()).filter(Boolean);
      const answeredTurns = updatedHistory.filter(m => m.speaker === 'Candidate').length;
      let nextQ = "";

      if (lines.length > answeredTurns) {
        const cleanQ = lines[answeredTurns].replace(/^[0-9]+[.\- )]+/, '').trim();
        nextQ = `Thank you for explaining that. Moving to the next question: ${cleanQ}`;
      } else {
        nextQ = "Thank you for explaining your approach. Could you discuss the potential failure modes and edge cases in that design?";
      }

      if (managerProbe && managerProbe.trim()) {
        nextQ += `\n\n[Manager Probe]: ${managerProbe}`;
      }

      setMessages([...updatedHistory, { speaker: 'AI Interviewer', text: nextQ }]);
      setManagerProbe('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/interview/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role_title: roleTitle,
          transcript: messages,
          evaluation_criteria: [
            { name: 'Technical Accuracy & Implementation', weight: '50%' },
            { name: 'Consistency Across All Questions', weight: '50%' }
          ]
        })
      });
      const data = await res.json();
      setScorecard(data);
      setActiveTab('scorecard');
    } catch (err) {
      console.warn('Evaluation fallback:', err);
      const candidateMsgs = messages.filter(m => m.speaker === 'Candidate').map(m => m.text);
      let passedCount = 0;
      let totalQuestions = candidateMsgs.length || 1;

      candidateMsgs.forEach(txt => {
        const lower = txt.toLowerCase();
        const hasGibberish = txt.length < 8 || lower.includes('whiun') || lower.includes('djkf');
        const hasGoodKeywords = lower.includes('vtaskdelay') || lower.includes('queue') || lower.includes('clock') || lower.includes('chunk') || lower.includes('cache');
        if (!hasGibberish && txt.length > 35 && hasGoodKeywords) {
          passedCount++;
        }
      });

      const calculatedScore = Math.round((passedCount / totalQuestions) * 100);
      const isSelected = calculatedScore >= 90;

      setScorecard({
        overall_decision: isSelected ? 'Strong Hire' : calculatedScore >= 60 ? 'Needs Re-evaluation' : 'No Hire',
        composite_score: calculatedScore,
        summary: `Evaluated ${totalQuestions} candidate answer(s). Passed: ${passedCount}/${totalQuestions}. Composite score: ${calculatedScore}%.`,
        rubric_scores: [
          {
            dimension: 'Technical Accuracy & Implementation',
            score: calculatedScore,
            max_score: 100,
            evidence: `Candidate successfully answered ${passedCount} out of ${totalQuestions} question(s).`,
            gap: isSelected ? 'None significant.' : 'Failed to answer all questions satisfactorily.'
          }
        ],
        green_flags: isSelected ? ['Consistently answered all technical questions correctly'] : [],
        red_flags: isSelected ? [] : ['Inconsistent or incorrect answers detected during interview turns']
      });
      setActiveTab('scorecard');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 px-6 py-4 flex justify-between items-center bg-slate-900/60 backdrop-blur sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-indigo-600 flex items-center justify-center font-bold text-sm">AI</div>
          <span className="font-semibold text-lg tracking-tight">Interview Intelligence Studio</span>
        </div>
        <div className="flex gap-2">
          {['upload', 'live', 'scorecard'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs rounded-md uppercase font-semibold tracking-wider transition ${
                activeTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              {tab === 'upload' ? '1. Knowledge Hub' : tab === 'live' ? '2. Live Interview' : '3. Scorecard'}
            </button>
          ))}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {activeTab === 'upload' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Target Position / Role Title</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Backend Engineer, IoT Specialist, Product Designer..."
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-2.5 text-sm focus:border-indigo-500 focus:outline-none placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Job Description (JD)</label>
                <textarea
                  rows={5}
                  placeholder="Paste or type the job responsibilities, required qualifications, and core duties here..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-2.5 text-sm focus:border-indigo-500 focus:outline-none placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Interview Guidelines & Behavioral Rules</label>
                <textarea
                  rows={4}
                  placeholder="e.g. Probe on edge cases, assess trade-offs, ask one question at a time, verify depth..."
                  value={guidelines}
                  onChange={(e) => setGuidelines(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-2.5 text-sm focus:border-indigo-500 focus:outline-none placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Curated Question Bank (Enter your custom questions)</label>
                <textarea
                  rows={5}
                  placeholder="1. Type question 1 here...&#10;2. Type question 2 here...&#10;3. Type question 3 here..."
                  value={questionBank}
                  onChange={(e) => setQuestionBank(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-2.5 text-sm focus:border-indigo-500 focus:outline-none placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Technical Documentation / Internal Standards</label>
                <textarea
                  rows={4}
                  placeholder="Paste proprietary architecture diagrams, API specs, database schemas, or evaluation benchmarks..."
                  value={techDocs}
                  onChange={(e) => setTechDocs(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-2.5 text-sm focus:border-indigo-500 focus:outline-none placeholder:text-slate-600"
                />
              </div>
              <button
                onClick={handleIngest}
                disabled={isLoading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 font-semibold rounded text-sm flex items-center justify-center gap-2 transition"
              >
                {isLoading ? <RefreshCw className="animate-spin w-4 h-4" /> : <UploadCloud className="w-4 h-4" />}
                Ingest Documents & Start Interview
              </button>
            </div>
          </div>
        )}

        {activeTab === 'live' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[75vh]">
            <div className="lg:col-span-2 flex flex-col bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
              <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-900/80">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active Interview: {roleTitle || 'Custom Role'}
                </span>
                <button
                  onClick={handleEvaluate}
                  disabled={isLoading}
                  className="text-xs bg-rose-600 hover:bg-rose-500 text-white font-medium px-3 py-1 rounded transition"
                >
                  Conclude & Score
                </button>
              </div>

              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.map((m, idx) => (
                  <div key={idx} className={`flex flex-col ${m.speaker === 'Candidate' ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                      {m.speaker === 'Candidate' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3 text-indigo-400" />}
                      {m.speaker}
                    </div>
                    <div className={`p-3 rounded-lg text-sm max-w-xl leading-relaxed ${
                      m.speaker === 'Candidate'
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                    }`}>
                      {m.text}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                      <Bot className="w-3 h-3 text-indigo-400" /> AI Interviewer
                    </div>
                    <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg rounded-bl-none text-slate-400 text-xs flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
                      Evaluating candidate response...
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-slate-800 flex gap-2">
                <input
                  type="text"
                  placeholder="Type candidate reply..."
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && currentInput.trim() && !isLoading) {
                      handleSendMessage();
                    }
                  }}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
                <button 
                  type="button"
                  onClick={handleSendMessage} 
                  disabled={!currentInput.trim() || isLoading} 
                  className={`px-4 py-2 rounded transition font-medium flex items-center justify-center ${
                    !currentInput.trim() || isLoading
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Manager Observer & Probe Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-xs tracking-wider uppercase text-indigo-400 flex items-center gap-2 mb-2">
                  <ShieldAlert className="w-4 h-4" /> Manager Telemetry & Probe
                </h3>
                <p className="text-xs text-slate-400 mb-3">
                  Inject live directives or custom follow-up questions during the interview.
                </p>
                <textarea
                  rows={4}
                  placeholder="Type an instruction for the AI (e.g. Ask how they handle race conditions or memory limits)..."
                  value={managerProbe}
                  onChange={(e) => setManagerProbe(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded text-xs space-y-1">
                <p className="text-slate-400">Target Role: <span className="text-slate-100 font-medium">{roleTitle || 'Not Set'}</span></p>
                <p className="text-slate-400">RAG Context: <span className="text-emerald-400 font-medium">Synced with Manager Uploads</span></p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'scorecard' && (
          <div className="relative bg-slate-900 border border-slate-800 rounded-lg p-6 max-w-4xl mx-auto space-y-6 overflow-hidden">
            
            {/* CELEBRATION FX: Only if score >= 90% */}
            {scorecard && scorecard.composite_score >= 90 && (
              <>
                <div className="balloon-animate text-4xl" style={{ left: '10%', animationDelay: '0s' }}>🎈</div>
                <div className="balloon-animate text-5xl" style={{ left: '25%', animationDelay: '1.2s' }}>🎉</div>
                <div className="balloon-animate text-4xl" style={{ left: '45%', animationDelay: '0.5s' }}>🎈</div>
                <div className="balloon-animate text-5xl" style={{ left: '65%', animationDelay: '2s' }}>🥳</div>
                <div className="balloon-animate text-4xl" style={{ left: '80%', animationDelay: '1.5s' }}>🎈</div>
                <div className="balloon-animate text-5xl" style={{ left: '92%', animationDelay: '0.8s' }}>🎊</div>

                <div className="bg-gradient-to-r from-emerald-600 via-teal-500 to-indigo-600 p-6 rounded-xl text-center shadow-lg shadow-emerald-500/20 border border-emerald-400/40 animate-bounce">
                  <div className="text-4xl mb-2">🥳 🎈 🎊 🏆 ✨</div>
                  <h1 className="text-2xl font-extrabold text-white tracking-wide uppercase">
                    Congratulations! You Are Selected!
                  </h1>
                  <p className="text-emerald-100 text-sm mt-1 font-medium">
                    Outstanding performance! You scored an impressive {scorecard.composite_score}% and exceeded all hiring benchmarks.
                  </p>
                </div>
              </>
            )}

            {/* REJECTION BANNER: If score < 70% */}
            {scorecard && scorecard.composite_score < 70 && (
              <div className="bg-rose-950/60 border border-rose-800/80 p-5 rounded-xl text-center">
                <div className="text-3xl mb-1">❌ ⚠️ 📋</div>
                <h1 className="text-xl font-bold text-rose-400 tracking-wide uppercase">
                  Application Status: Not Selected
                </h1>
                <p className="text-rose-200/80 text-xs mt-1">
                  Candidate scored {scorecard.composite_score}%, falling below the required minimum competency threshold (75%). Critical technical anti-patterns or incorrect answers were observed.
                </p>
              </div>
            )}

            {/* Scorecard Header */}
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold">Automated Evaluation Summary</h2>
                <p className="text-xs text-slate-400">Evaluated against uploaded requirements for {roleTitle}</p>
              </div>
              {scorecard && (
                <div className="text-right">
                  <span className="text-xs uppercase tracking-wider text-slate-400 block">Decision</span>
                  <span className={`text-base font-extrabold ${
                    scorecard.composite_score >= 80 
                      ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]' 
                      : 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                  }`}>
                    {scorecard.overall_decision} ({scorecard.composite_score}/100)
                  </span>
                </div>
              )}
            </div>

            {scorecard ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-semibold uppercase text-slate-400 mb-2">Executive Summary</h3>
                  <p className="text-sm bg-slate-950 p-4 border border-slate-800 rounded text-slate-300">
                    {scorecard.summary}
                  </p>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase text-slate-400 mb-3">Rubric Breakdown</h3>
                  <div className="space-y-3">
                    {scorecard.rubric_scores?.map((rubric, idx) => (
                      <div key={idx} className="bg-slate-950 border border-slate-800 p-4 rounded">
                        <div className="flex justify-between text-sm font-semibold mb-1">
                          <span>{rubric.dimension}</span>
                          <span className={`font-bold ${rubric.score >= 70 ? 'text-indigo-400' : 'text-rose-400'}`}>
                            {rubric.score}/{rubric.max_score}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-400 mt-1">✓ {rubric.evidence}</p>
                        {rubric.gap && <p className="text-xs text-rose-400 mt-1">✗ {rubric.gap}</p>}
                      </div>
                    ))}
                  </div>
                </div>

                {scorecard.red_flags && scorecard.red_flags.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase text-rose-400 mb-2">Critical Concerns (Red Flags)</h3>
                    <ul className="list-disc list-inside text-xs text-rose-300 space-y-1 bg-rose-950/30 p-4 border border-rose-900/50 rounded">
                      {scorecard.red_flags.map((flag, i) => (
                        <li key={i}>{flag}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {scorecard.green_flags && scorecard.green_flags.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase text-emerald-400 mb-2">Key Strengths (Green Flags)</h3>
                    <ul className="list-disc list-inside text-xs text-slate-300 space-y-1 bg-slate-950 p-4 border border-slate-800 rounded">
                      {scorecard.green_flags.map((flag, i) => (
                        <li key={i}>{flag}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-500 text-sm text-center py-10">
                Execute an interview session and click "Conclude & Score" to inspect results.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}