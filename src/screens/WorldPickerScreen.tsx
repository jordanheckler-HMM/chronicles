import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useGame, World } from '../GameContext';

const worlds: { id: World; title: string; description: string; colors: string; bg: string }[] = [
  {
    id: 'Fantasy',
    title: 'High Fantasy',
    description: 'A realm of ancient magic, mythical beasts, and forgotten kingdoms.',
    colors: 'from-emerald-900/40 to-emerald-950/80 border-emerald-500/30 hover:border-emerald-400',
    bg: 'https://picsum.photos/seed/fantasy/800/600?blur=4'
  },
  {
    id: 'Sci-Fi',
    title: 'Cyber Dystopia',
    description: 'Neon-lit megacities ruled by ruthless corporations and rogue AI.',
    colors: 'from-cyan-900/40 to-blue-950/80 border-cyan-500/30 hover:border-cyan-400',
    bg: 'https://picsum.photos/seed/scifi/800/600?blur=4'
  },
  {
    id: 'Horror',
    title: 'Eldritch Horror',
    description: 'Unspeakable terrors lurk in the shadows of a decaying world.',
    colors: 'from-red-900/40 to-rose-950/80 border-red-500/30 hover:border-red-400',
    bg: 'https://picsum.photos/seed/horror/800/600?blur=4'
  },
  {
    id: 'Western',
    title: 'Weird West',
    description: 'Dusty trails, six-shooters, and dark magic in the untamed frontier.',
    colors: 'from-amber-900/40 to-orange-950/80 border-amber-500/30 hover:border-amber-400',
    bg: 'https://picsum.photos/seed/western/800/600?blur=4'
  }
];

export default function WorldPickerScreen() {
  const navigate = useNavigate();
  const { world, setWorld } = useGame();

  const handleNext = () => {
    if (world) {
      navigate('/character');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e8dcc4] flex flex-col items-center justify-center p-8 font-serif relative">
      <div className="absolute inset-0 opacity-10 bg-[url('https://picsum.photos/seed/darkwood/1920/1080?blur=2')] bg-cover bg-center pointer-events-none mix-blend-overlay" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="z-10 w-full max-w-5xl flex flex-col items-center"
      >
        <h2 className="text-4xl md:text-6xl mb-12 tracking-widest uppercase opacity-90">
          Choose Your World
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full mb-16">
          {worlds.map((w, i) => (
            <motion.div
              key={w.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => setWorld(w.id)}
              className={`
                relative overflow-hidden cursor-pointer rounded-lg border-2 p-8 h-48 flex flex-col justify-end
                transition-all duration-300 group bg-gradient-to-br ${w.colors}
                ${world === w.id ? 'border-opacity-100 shadow-[0_0_30px_rgba(255,255,255,0.1)] scale-[1.02]' : 'border-opacity-30 hover:scale-[1.01]'}
              `}
            >
              <div 
                className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-luminosity group-hover:opacity-30 transition-opacity duration-500"
                style={{ backgroundImage: `url(${w.bg})` }}
              />
              <div className="relative z-10">
                <h3 className="text-3xl font-bold mb-2 tracking-wider">{w.title}</h3>
                <p className="text-[#e8dcc4]/70 font-sans text-sm leading-relaxed">{w.description}</p>
              </div>
              
              {world === w.id && (
                <div className="absolute inset-0 border-2 border-white/20 rounded-lg animate-pulse pointer-events-none" />
              )}
            </motion.div>
          ))}
        </div>

        <button
          onClick={handleNext}
          disabled={!world}
          className={`
            px-12 py-4 text-xl tracking-widest uppercase transition-all duration-300 border
            ${world 
              ? 'border-[#e8dcc4]/50 text-[#e8dcc4] hover:bg-[#e8dcc4]/10 hover:shadow-[0_0_20px_rgba(232,220,196,0.2)]' 
              : 'border-[#e8dcc4]/10 text-[#e8dcc4]/30 cursor-not-allowed'}
          `}
        >
          Next
        </button>
      </motion.div>
    </div>
  );
}
