import React, { createContext, useContext, useState, ReactNode } from 'react';

export type World = 'Fantasy' | 'Sci-Fi' | 'Horror' | 'Western';
export type CharacterClass = 'Rogue' | 'Warrior' | 'Mage' | 'Ranger';

export interface Stats {
  health: number;
  weapon: string;
  gold: number;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GameState {
  world: World | null;
  setWorld: (world: World) => void;
  characterName: string;
  setCharacterName: (name: string) => void;
  characterClass: CharacterClass | null;
  setCharacterClass: (cls: CharacterClass) => void;
  characterDescription: string;
  setCharacterDescription: (desc: string) => void;
  stats: Stats;
  setStats: (stats: Stats) => void;
  history: Message[];
  setHistory: (history: Message[] | ((prev: Message[]) => Message[])) => void;
  resetGame: () => void;
}

const defaultStats: Stats = {
  health: 100,
  weapon: 'None',
  gold: 0,
};

const GameContext = createContext<GameState | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const [world, setWorld] = useState<World | null>(null);
  const [characterName, setCharacterName] = useState('');
  const [characterClass, setCharacterClass] = useState<CharacterClass | null>(null);
  const [characterDescription, setCharacterDescription] = useState('');
  const [stats, setStats] = useState<Stats>(defaultStats);
  const [history, setHistory] = useState<Message[]>([]);

  const resetGame = () => {
    setWorld(null);
    setCharacterName('');
    setCharacterClass(null);
    setCharacterDescription('');
    setStats(defaultStats);
    setHistory([]);
  };

  return (
    <GameContext.Provider
      value={{
        world,
        setWorld,
        characterName,
        setCharacterName,
        characterClass,
        setCharacterClass,
        characterDescription,
        setCharacterDescription,
        stats,
        setStats,
        history,
        setHistory,
        resetGame,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
