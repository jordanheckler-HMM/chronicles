import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useGame } from '../GameContext';

export default function HomeScreen() {
  const navigate = useNavigate();
  const { resetGame } = useGame();
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'running' | 'not_found'>('checking');

  useEffect(() => {
    const checkOllama = async () => {
      try {
        const res = await fetch('http://localhost:11434/api/tags');
        if (res.ok) {
          setOllamaStatus('running');
        } else {
          setOllamaStatus('not_found');
        }
      } catch (err) {
        setOllamaStatus('not_found');
      }
    };
    checkOllama();
  }, []);

  const handleNewCampaign = () => {
    resetGame();
    navigate('/world');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center relative overflow-hidden font-serif">
      {/* Background overlay for texture */}
      <div className="absolute inset-0 opacity-20 bg-[url('https://picsum.photos/seed/darkwood/1920/1080?blur=2')] bg-cover bg-center pointer-events-none mix-blend-overlay" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="z-10 flex flex-col items-center"
      >
        <h1 className="text-7xl md:text-9xl text-[#e8dcc4] font-bold tracking-widest mb-16 drop-shadow-[0_0_15px_rgba(232,220,196,0.3)]">
          CHRONICLES
        </h1>

        <div className="flex flex-col gap-6 w-64">
          <button 
            onClick={handleNewCampaign}
            className="group relative px-8 py-4 bg-transparent border border-[#e8dcc4]/30 text-[#e8dcc4] text-xl tracking-widest uppercase hover:bg-[#e8dcc4]/10 transition-all duration-300"
          >
            <span className="relative z-10">New Campaign</span>
            <div className="absolute inset-0 border border-[#e8dcc4] opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300" />
          </button>
          
          <button 
            className="group relative px-8 py-4 bg-transparent border border-[#e8dcc4]/10 text-[#e8dcc4]/50 text-xl tracking-widest uppercase hover:text-[#e8dcc4]/80 transition-all duration-300 cursor-not-allowed"
            disabled
          >
            <span className="relative z-10">Load Campaign</span>
          </button>
        </div>
      </motion.div>

      <div className="absolute bottom-8 z-10 flex items-center gap-3 text-sm font-sans tracking-wider">
        {ollamaStatus === 'checking' && (
          <span className="text-gray-500">Checking Ollama status...</span>
        )}
        {ollamaStatus === 'running' && (
          <>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            <span className="text-emerald-500/80">Ollama Running ✓</span>
          </>
        )}
        {ollamaStatus === 'not_found' && (
          <>
            <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
            <span className="text-red-500/80">Ollama Not Found ✗</span>
          </>
        )}
      </div>
    </div>
  );
}
