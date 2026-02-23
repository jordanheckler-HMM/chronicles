import React, { useEffect, useRef, useState } from 'react';
import { Heart, Sword, Coins, Send } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useGame, Message } from '../GameContext';
import {
  createCampaignName,
  getSelectedModel,
  saveCampaign,
  streamChat,
} from '../lib/backend';
import {
  extractStatsFromResponse,
  splitNarrativeAndChoices,
  stripChoicePrefix,
} from '../lib/parsing';

export default function MainGameScreen() {
  const navigate = useNavigate();
  const {
    world,
    campaignName,
    setCampaignName,
    characterName,
    characterClass,
    characterDescription,
    stats,
    setStats,
    history,
    setHistory,
  } = useGame();

  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [currentStream, setCurrentStream] = useState('');
  const [selectedModel, setSelectedModel] = useState('mistral');
  const [modelLoaded, setModelLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!world || !characterName || !characterClass || !characterDescription) {
      navigate('/', { replace: true });
    }
  }, [characterClass, characterDescription, characterName, navigate, world]);

  useEffect(() => {
    let active = true;

    const loadModel = async () => {
      try {
        const model = await getSelectedModel();
        if (active) {
          setSelectedModel(model);
        }
      } finally {
        if (active) {
          setModelLoaded(true);
        }
      }
    };

    void loadModel();

    return () => {
      active = false;
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, currentStream]);

  useEffect(() => {
    if (!modelLoaded || !world || !characterName || !characterClass || !characterDescription) {
      return;
    }

    if (!initialized.current && history.length === 0) {
      initialized.current = true;

      const systemPrompt = `You are a dungeon master running a ${world} RPG. Describe vivid scenes in 2-3 sentences. Always end your response with exactly 3 numbered choices the player can make. After your narrative, append a hidden JSON block on its own line in this exact format: {"health": 100, "weapon": "Dagger", "gold": 0} — update these values based on what happens in the story. Never break character. Never acknowledge you are an AI.`;

      const initialUserMessage = `I am ${characterName}, a ${characterClass}. ${characterDescription}. I am ready to begin my journey.`;

      const initialHistory: Message[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: initialUserMessage },
      ];

      setHistory(initialHistory);
      void sendToBackend(initialHistory, selectedModel);
    }
  }, [
    characterClass,
    characterDescription,
    characterName,
    history.length,
    modelLoaded,
    selectedModel,
    setHistory,
    world,
  ]);

  useEffect(() => {
    if (!world || !characterName || !characterClass || history.length === 0) {
      return;
    }

    const resolvedCampaignName = campaignName || createCampaignName(characterName, world);
    if (!campaignName) {
      setCampaignName(resolvedCampaignName);
    }

    let cancelled = false;

    const persistCampaign = async () => {
      setSaveStatus('saving');
      setSaveError(null);

      try {
        await saveCampaign(resolvedCampaignName, {
          world,
          characterName,
          characterClass,
          characterDescription,
          stats,
          history,
          model: selectedModel,
          updatedAt: new Date().toISOString(),
        });

        if (!cancelled) {
          setSaveStatus('idle');
        }
      } catch (error) {
        if (!cancelled) {
          setSaveStatus('error');
          setSaveError(error instanceof Error ? error.message : 'Failed to save campaign');
        }
      }
    };

    void persistCampaign();

    return () => {
      cancelled = true;
    };
  }, [
    campaignName,
    characterClass,
    characterDescription,
    characterName,
    history,
    selectedModel,
    setCampaignName,
    stats,
    world,
  ]);

  const sendToBackend = async (messages: Message[], model: string) => {
    setIsThinking(true);
    setCurrentStream('');
    let fullResponse = '';

    try {
      fullResponse = await streamChat(model, messages, (token) => {
        setCurrentStream((prev) => prev + token);
      });

      processAiResponse(fullResponse, messages);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMsg =
        error instanceof Error
          ? error.message
          : 'The Dungeon Master is currently unavailable. Ensure Ollama is running locally.';
      setHistory([...messages, { role: 'assistant', content: errorMsg }]);
    } finally {
      setIsThinking(false);
      setCurrentStream('');
    }
  };

  const processAiResponse = (fullResponse: string, currentHistory: Message[]) => {
    const parsed = extractStatsFromResponse(fullResponse);

    if (parsed.stats) {
      setStats(parsed.stats);
    }

    const content = parsed.cleanResponse || 'The Dungeon Master stays silent.';
    setHistory([...currentHistory, { role: 'assistant', content }]);
  };

  const handleSend = (text: string) => {
    if (!text.trim() || isThinking) {
      return;
    }

    const cleanText = stripChoicePrefix(text);

    const newHistory: Message[] = [...history, { role: 'user', content: cleanText }];
    setHistory(newHistory);
    setInput('');
    void sendToBackend(newHistory, selectedModel);
  };

  const renderMessageContent = (content: string, isStreaming: boolean = false) => {
    const { narrative, choices } = splitNarrativeAndChoices(content);

    return (
      <div className="flex flex-col gap-6 w-full">
        <div className="text-[#e8dcc4]/90 leading-relaxed font-serif text-lg whitespace-pre-wrap">
          {narrative}
          {isStreaming && (
            <span className="inline-block w-2 h-5 ml-1 bg-[#e8dcc4]/70 animate-pulse align-middle" />
          )}
        </div>

        {!isStreaming && choices.length > 0 && (
          <div className="flex flex-col gap-3 mt-4 w-full">
            {choices.map((choice, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(choice)}
                disabled={isThinking}
                className="text-left p-4 border border-[#e8dcc4]/20 rounded bg-[#e8dcc4]/5 hover:bg-[#e8dcc4]/10 hover:border-[#e8dcc4]/40 transition-all duration-200 font-serif text-[#e8dcc4] group w-full"
              >
                <span className="text-[#e8dcc4]/50 mr-3 group-hover:text-[#e8dcc4]/80 transition-colors">
                  {choice.substring(0, 2)}
                </span>
                {choice.substring(2).trim()}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen bg-[#0a0a0a] flex flex-col font-serif relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 bg-[url('https://picsum.photos/seed/darkwood/1920/1080?blur=2')] bg-cover bg-center pointer-events-none mix-blend-overlay" />

      <div className="h-16 border-b border-[#e8dcc4]/10 bg-black/40 backdrop-blur-sm flex items-center justify-between px-8 z-10 shrink-0">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 text-red-400">
            <Heart size={18} className="fill-current" />
            <span className="font-mono text-lg">{stats.health}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Sword size={18} />
            <span className="font-sans text-sm uppercase tracking-wider">{stats.weapon}</span>
          </div>
          <div className="flex items-center gap-2 text-amber-400">
            <Coins size={18} />
            <span className="font-mono text-lg">{stats.gold}</span>
          </div>
        </div>
        <div className="text-[#e8dcc4]/40 text-xs uppercase tracking-widest text-right">
          <div>
            {characterName} • {characterClass}
          </div>
          <div>Model: {selectedModel}</div>
          <div>
            Save:{' '}
            {saveStatus === 'saving'
              ? 'Saving...'
              : saveStatus === 'error'
                ? 'Error'
                : 'OK'}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 z-10 scroll-smooth">
        <div className="max-w-3xl mx-auto flex flex-col gap-12 pb-8">
          {history.filter((m) => m.role !== 'system').map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col w-full ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              {msg.role === 'user' ? (
                <div className="bg-[#e8dcc4]/10 border border-[#e8dcc4]/20 text-[#e8dcc4]/80 px-6 py-3 rounded-2xl rounded-tr-sm max-w-[80%] font-sans text-sm">
                  {msg.content}
                </div>
              ) : (
                <div className="w-full">{renderMessageContent(msg.content)}</div>
              )}
            </motion.div>
          ))}

          {isThinking && currentStream && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full">
              {renderMessageContent(currentStream, true)}
            </motion.div>
          )}

          {isThinking && !currentStream && (
            <div className="flex items-center gap-3 text-[#e8dcc4]/40 font-sans text-sm italic">
              <div className="w-2 h-2 rounded-full bg-[#e8dcc4]/40 animate-pulse" />
              The DM is thinking...
            </div>
          )}

          {saveError && <p className="text-xs text-red-400/80 font-sans">{saveError}</p>}
        </div>
      </div>

      <div className="p-6 bg-gradient-to-t from-black via-black/90 to-transparent z-10 shrink-0">
        <div className="max-w-3xl mx-auto relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
            placeholder="What do you do?"
            disabled={isThinking}
            className="w-full bg-[#111] border border-[#e8dcc4]/20 rounded-full py-4 pl-6 pr-16 text-[#e8dcc4] placeholder-[#e8dcc4]/30 focus:outline-none focus:border-[#e8dcc4]/50 transition-colors font-sans disabled:opacity-50"
          />
          <button
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isThinking}
            className="absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-[#e8dcc4]/10 hover:bg-[#e8dcc4]/20 text-[#e8dcc4] rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={18} className="ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}
