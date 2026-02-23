import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useGame, CharacterClass } from '../GameContext';

const classes: CharacterClass[] = ['Rogue', 'Warrior', 'Mage', 'Ranger'];

export default function CharacterCreationScreen() {
  const navigate = useNavigate();
  const {
    characterName,
    setCharacterName,
    characterClass,
    setCharacterClass,
    characterDescription,
    setCharacterDescription,
    world,
    setCampaignName,
  } = useGame();

  const isComplete = characterName.trim() !== '' && characterClass !== null && characterDescription.trim() !== '';

  useEffect(() => {
    if (!world) {
      navigate('/world', { replace: true });
    }
  }, [navigate, world]);

  const handleBegin = () => {
    if (isComplete) {
      setCampaignName(characterName.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-'));
      navigate('/game');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e8dcc4] flex flex-col items-center justify-center p-8 font-serif relative">
      <div className="absolute inset-0 opacity-10 bg-[url('https://picsum.photos/seed/darkwood/1920/1080?blur=2')] bg-cover bg-center pointer-events-none mix-blend-overlay" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="z-10 w-full max-w-2xl flex flex-col items-center"
      >
        <h2 className="text-4xl md:text-6xl mb-16 tracking-widest uppercase opacity-90">
          Who Are You?
        </h2>

        <div className="w-full flex flex-col gap-8 mb-16 font-sans">
          
          <div className="flex flex-col gap-2">
            <label className="text-sm tracking-widest uppercase text-[#e8dcc4]/60 font-serif">Name</label>
            <input
              type="text"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              placeholder="Enter your name..."
              className="w-full bg-transparent border-b border-[#e8dcc4]/30 py-3 text-2xl text-[#e8dcc4] focus:outline-none focus:border-[#e8dcc4] transition-colors placeholder-[#e8dcc4]/20 font-serif"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm tracking-widest uppercase text-[#e8dcc4]/60 font-serif">Class</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {classes.map((cls) => (
                <button
                  key={cls}
                  onClick={() => setCharacterClass(cls)}
                  className={`
                    py-3 px-4 border text-sm tracking-wider uppercase transition-all duration-300 font-serif
                    ${characterClass === cls 
                      ? 'border-[#e8dcc4] bg-[#e8dcc4]/10 shadow-[0_0_15px_rgba(232,220,196,0.15)]' 
                      : 'border-[#e8dcc4]/20 text-[#e8dcc4]/60 hover:border-[#e8dcc4]/50'}
                  `}
                >
                  {cls}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm tracking-widest uppercase text-[#e8dcc4]/60 font-serif">Description</label>
            <textarea
              value={characterDescription}
              onChange={(e) => setCharacterDescription(e.target.value)}
              placeholder="Describe yourself in one sentence..."
              rows={3}
              className="w-full bg-[#111] border border-[#e8dcc4]/20 p-4 text-lg text-[#e8dcc4] focus:outline-none focus:border-[#e8dcc4]/60 transition-colors placeholder-[#e8dcc4]/20 resize-none font-serif leading-relaxed"
            />
          </div>

        </div>

        <button
          onClick={handleBegin}
          disabled={!isComplete}
          className={`
            px-12 py-4 text-xl tracking-widest uppercase transition-all duration-300 border font-serif
            ${isComplete 
              ? 'border-[#e8dcc4]/50 text-[#e8dcc4] hover:bg-[#e8dcc4]/10 hover:shadow-[0_0_20px_rgba(232,220,196,0.2)]' 
              : 'border-[#e8dcc4]/10 text-[#e8dcc4]/30 cursor-not-allowed'}
          `}
        >
          Begin Story
        </button>
      </motion.div>
    </div>
  );
}
