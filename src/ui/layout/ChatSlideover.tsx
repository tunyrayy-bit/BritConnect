/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Persistent Slide-over Analyst Chat Drawer
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  MessageSquareCode,
  Sparkles,
  Trash2,
  Table as TableIcon,
  Download,
  Info
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { processChatQuery, ChatMessage } from '../../chat/engine';
import { exportTableToCsv } from '../../reports/engine';

export const ChatSlideover: React.FC = () => {
  const {
    isChatDrawerOpen,
    setChatDrawerOpen,
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
    'Which 20 high-value customers are most likely to leave this month?',
    'Why is customer BC-10001 at risk?',
    'How did retention campaigns perform versus control?',
    'Show model evaluation metrics and ROC-AUC'
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isProcessing]);

  if (!isChatDrawerOpen) return null;

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
        text: 'An error occurred while querying retention intelligence. Please retry or adjust query parameters.',
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col justify-between border-l border-[#E2E8F0] animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-4 bg-[#0B1F3A] text-white flex items-center justify-between border-b border-[#14305C]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#C9A227] flex items-center justify-center text-[#0B1F3A]">
              <MessageSquareCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm tracking-tight">BritConnect Analyst</h3>
                <span className="px-1.5 py-0.5 rounded bg-[#C9A227]/20 text-[#E3C766] text-[10px] font-semibold uppercase tracking-wider">
                  Real Data Tool-Calling
                </span>
              </div>
              <p className="text-[11px] text-[#E8EDF5]/70">
                Deterministic retention queries & conversational telecom science
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={clearChat}
              title="Clear conversation"
              className="p-1.5 rounded-md hover:bg-[#14305C] text-[#E8EDF5]/80 hover:text-white"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChatDrawerOpen(false)}
              className="p-1.5 rounded-md hover:bg-[#14305C] text-[#E8EDF5]/80 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Chat History Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F8FAFC]">
          {chatMessages.length === 0 && (
            <div className="my-6 text-center">
              <div className="w-12 h-12 rounded-full bg-[#E8EDF5] text-[#0B1F3A] flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6 text-[#C9A227]" />
              </div>
              <h4 className="font-semibold text-sm text-[#0B1F3A]">Ask BritConnect Analyst</h4>
              <p className="text-xs text-[#5B6678] max-w-sm mx-auto mt-1">
                Query churn distributions, drill down into specific accounts, analyze campaign uplift, or evaluate model metrics.
              </p>

              <div className="mt-5 space-y-2 max-w-md mx-auto text-left">
                <span className="text-[11px] font-semibold text-[#5B6678] uppercase tracking-wider block px-1">
                  Suggested Questions:
                </span>
                {suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(q)}
                    className="w-full text-left p-2.5 rounded-lg bg-white border border-[#E2E8F0] hover:border-[#0B1F3A] hover:bg-[#F6F8FB] text-xs text-[#1B2433] transition-all flex items-center justify-between group"
                  >
                    <span>{q}</span>
                    <span className="text-[#C9A227] opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[92%] rounded-xl p-3.5 text-xs ${
                  msg.sender === 'user'
                    ? 'bg-[#0B1F3A] text-white rounded-br-none shadow-xs'
                    : 'bg-white text-[#1B2433] border border-[#E2E8F0] rounded-bl-none shadow-xs'
                }`}
              >
                {/* Text Content */}
                <div className="whitespace-pre-wrap leading-relaxed space-y-2">
                  {msg.text}
                </div>

                {/* Filter Definition Tag */}
                {msg.filterDefinition && (
                  <div className="mt-2.5 pt-2 border-t border-[#F1F5F9] flex items-center gap-1.5 text-[10px] text-[#5B6678]">
                    <Info className="w-3 h-3 text-[#C9A227]" />
                    <span>Evidence Scope: {msg.filterDefinition}</span>
                  </div>
                )}

                {/* Inline Supporting Table */}
                {msg.tableData && msg.tableData.length > 0 && (
                  <div className="mt-3 border border-[#E2E8F0] rounded-lg overflow-hidden bg-white">
                    <div className="px-2.5 py-1.5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[#0B1F3A] uppercase tracking-wider flex items-center gap-1">
                        <TableIcon className="w-3 h-3 text-[#C9A227]" /> Evidence Table
                      </span>
                      <button
                        onClick={() => exportTableToCsv(msg.tableData!, 'analyst_query_results')}
                        className="text-[10px] text-[#0B1F3A] hover:text-[#C9A227] font-semibold flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" /> Export CSV
                      </button>
                    </div>
                    <div className="max-h-48 overflow-auto">
                      <table className="w-full text-[11px] text-left">
                        <thead className="bg-[#F1F5F9] text-[#0B1F3A] font-semibold sticky top-0">
                          <tr>
                            {msg.tableHeaders?.map(h => (
                              <th key={h} className="px-2.5 py-1.5 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F1F5F9]">
                          {msg.tableData.map((row, i) => (
                            <tr key={i} className="hover:bg-[#F8FAFC]">
                              {Object.values(row).map((v: any, j) => (
                                <td key={j} className="px-2.5 py-1.5 whitespace-nowrap text-[#1B2433]">{String(v)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Inline Follow-up Chips */}
                {msg.followUps && msg.followUps.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-[#F1F5F9] space-y-1.5">
                    <span className="text-[10px] font-bold text-[#5B6678] uppercase tracking-wider block">
                      Recommended Follow-ups:
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
            <div className="flex items-center gap-2 p-3 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#5B6678] w-fit">
              <Sparkles className="w-4 h-4 text-[#C9A227] animate-spin" />
              <span>Querying dataset and evaluating telemetry...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-[#E2E8F0]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about churn drivers, customers, campaigns..."
              disabled={isProcessing}
              className="flex-1 bg-[#F6F8FB] border border-[#E2E8F0] focus:border-[#0B1F3A] focus:bg-white text-xs text-[#1B2433] rounded-lg px-3.5 py-2.5 outline-none transition-all placeholder:text-[#94A3B8]"
            />
            <button
              type="submit"
              disabled={!input.trim() || isProcessing}
              className="p-2.5 rounded-lg bg-[#0B1F3A] hover:bg-[#14305C] disabled:bg-[#CBD5E1] text-white transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
