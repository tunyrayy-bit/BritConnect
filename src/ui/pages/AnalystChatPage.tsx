/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Analyst Chat Full-Page View (Section 11)
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquareCode,
  Send,
  Sparkles,
  Trash2,
  Table as TableIcon,
  Download,
  Info
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { processChatQuery, ChatMessage } from '../../chat/engine';
import { exportTableToCsv } from '../../reports/engine';

export const AnalystChatPage: React.FC = () => {
  const {
    chatMessages,
    addChatMessage,
    clearChat,
    customers,
    scores,
    championModel,
    campaigns,
    ruleBasedSegments,
    settings
  } = useAppStore();

  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const suggestedQuestions = [
    'What is the churn rate by contract type?',
    'Show me churn by UK Nation as a chart',
    'Which 20 high-value customers are most likely to leave this month and why?',
    'Why is customer BC-10001 at risk?',
    'How did retention campaigns perform versus control?',
    'Show model evaluation metrics and ROC-AUC',
    'What would happen if we moved Month-to-Month customers to 12-month contracts?'
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isProcessing]);

  const handleSend = async (textToSend?: string) => {
    const q = textToSend || input;
    if (!q.trim() || isProcessing) return;

    const userMsg: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      sender: 'user',
      text: q.trim(),
      timestamp: new Date().toISOString()
    };
    addChatMessage(userMsg);
    setInput('');
    setIsProcessing(true);

    try {
      const response = await processChatQuery(
        q.trim(),
        {
          customers,
          scores,
          championModel,
          campaigns,
          segments: ruleBasedSegments,
          isAiEnabled: settings.isAiEnabled
        },
        chatMessages
      );
      addChatMessage(response);
    } catch (e) {
      console.error('Chat error:', e);
      addChatMessage({
        id: `msg-err-${Date.now()}`,
        sender: 'assistant',
        text: 'An error occurred while evaluating telemetry. Please verify connection and parameters.',
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs flex flex-col h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#0B1F3A] text-white rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#C9A227] flex items-center justify-center text-[#0B1F3A]">
            <MessageSquareCode className="w-5 h-5 font-bold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base tracking-tight">BritConnect Analyst</h2>
              <span className="px-2 py-0.5 rounded bg-[#C9A227]/20 text-[#E3C766] text-[10px] font-bold uppercase tracking-wider">
                Deterministic Tool Execution
              </span>
            </div>
            <p className="text-xs text-[#E8EDF5]/70">
              Natural-language retention queries grounded in real in-memory data
            </p>
          </div>
        </div>

        <button
          onClick={clearChat}
          className="p-1.5 rounded-md hover:bg-[#14305C] text-[#E8EDF5]/80 hover:text-white text-xs flex items-center gap-1"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear Chat</span>
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F8FAFC]">
        {chatMessages.length === 0 && (
          <div className="max-w-xl mx-auto my-12 text-center">
            <div className="w-14 h-14 rounded-full bg-[#E8EDF5] text-[#0B1F3A] flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-7 h-7 text-[#C9A227]" />
            </div>
            <h3 className="font-bold text-base text-[#0B1F3A]">Welcome to BritConnect Analyst</h3>
            <p className="text-xs text-[#5B6678] mt-1 max-w-md mx-auto">
              Ask natural language questions about customer churn risk, regional variations, contract drivers, or campaign uplift. All calculations run strictly against the active dataset.
            </p>

            <div className="mt-6 space-y-2 text-left">
              <span className="text-[11px] font-semibold text-[#5B6678] uppercase tracking-wider block px-1">
                Suggested Prompts:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(q)}
                    className="p-3 rounded-lg bg-white border border-[#E2E8F0] hover:border-[#0B1F3A] hover:bg-[#F6F8FB] text-xs text-[#1B2433] transition-all text-left flex items-center justify-between group shadow-2xs"
                  >
                    <span>{q}</span>
                    <span className="text-[#C9A227] opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl p-4 text-xs ${
                msg.sender === 'user'
                  ? 'bg-[#0B1F3A] text-white rounded-br-none shadow-xs'
                  : 'bg-white text-[#1B2433] border border-[#E2E8F0] rounded-bl-none shadow-xs'
              }`}
            >
              <div className="whitespace-pre-wrap leading-relaxed space-y-2 font-sans">
                {msg.text}
              </div>

              {msg.filterDefinition && (
                <div className="mt-3 pt-2 border-t border-[#F1F5F9] flex items-center gap-1.5 text-[10px] text-[#5B6678]">
                  <Info className="w-3 h-3 text-[#C9A227]" />
                  <span>Evidence Scope: {msg.filterDefinition}</span>
                </div>
              )}

              {msg.tableData && msg.tableData.length > 0 && (
                <div className="mt-3 border border-[#E2E8F0] rounded-lg overflow-hidden bg-white">
                  <div className="px-3 py-1.5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#0B1F3A] uppercase tracking-wider flex items-center gap-1">
                      <TableIcon className="w-3 h-3 text-[#C9A227]" /> Supporting Evidence Table
                    </span>
                    <button
                      onClick={() => exportTableToCsv(msg.tableData!, 'analyst_evidence_table')}
                      className="text-[10px] text-[#0B1F3A] hover:text-[#C9A227] font-semibold flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" /> Export CSV
                    </button>
                  </div>
                  <div className="max-h-60 overflow-auto">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-[#F1F5F9] text-[#0B1F3A] font-semibold sticky top-0">
                        <tr>
                          {msg.tableHeaders?.map(h => (
                            <th key={h} className="px-3 py-2 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        {msg.tableData.map((row, i) => (
                          <tr key={i} className="hover:bg-[#F8FAFC]">
                            {Object.values(row).map((v: any, j) => (
                              <td key={j} className="px-3 py-2 whitespace-nowrap text-[#1B2433]">{String(v)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {msg.followUps && msg.followUps.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-[#F1F5F9] space-y-1.5">
                  <span className="text-[10px] font-bold text-[#5B6678] uppercase tracking-wider block">
                    Suggested Next Inquiries:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.followUps.map((f, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(f)}
                        className="px-2.5 py-1 rounded-md bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0B1F3A] text-[11px] font-medium transition-colors text-left"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <span className="text-[10px] text-[#94A3B8] mt-1 px-1">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}

        {isProcessing && (
          <div className="flex items-center gap-2 p-3 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#5B6678] w-fit shadow-2xs">
            <Sparkles className="w-4 h-4 text-[#C9A227] animate-spin" />
            <span>Evaluating telemetry across active customer base...</span>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="p-4 bg-white border-t border-[#E2E8F0] rounded-b-xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question about churn patterns, customer drivers, campaigns..."
            disabled={isProcessing}
            className="flex-1 bg-[#F6F8FB] border border-[#CBD5E1] focus:border-[#0B1F3A] focus:bg-white text-xs text-[#1B2433] rounded-lg px-4 py-2.5 outline-none transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="px-4 py-2.5 rounded-lg bg-[#0B1F3A] hover:bg-[#14305C] disabled:bg-[#CBD5E1] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
