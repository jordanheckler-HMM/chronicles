import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useGame } from '../GameContext';
import {
  checkForUpdate,
  checkOllamaStatus,
  getAvailableModels,
  getSelectedModel,
  listCampaigns,
  loadCampaign,
  runningInTauri,
  setSelectedModel,
  subscribeToSetupEvents,
  type UpdateInfo,
} from '../lib/backend';

export default function HomeScreen() {
  const navigate = useNavigate();
  const {
    resetGame,
    setCampaignName,
    setWorld,
    setCharacterName,
    setCharacterClass,
    setCharacterDescription,
    setStats,
    setHistory,
  } = useGame();

  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'running' | 'not_found'>('checking');
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModelState] = useState('mistral');
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let unlistenSetup: (() => void) | null = null;

    const load = async () => {
      const [status, availableCampaigns, availableModels, model] = await Promise.all([
        checkOllamaStatus(),
        listCampaigns(),
        getAvailableModels().catch(() => []),
        getSelectedModel().catch(() => 'mistral'),
      ]);

      if (!active) {
        return;
      }

      setOllamaStatus(status.running ? 'running' : 'not_found');
      setCampaigns(availableCampaigns);
      setSelectedCampaign(availableCampaigns[0] ?? '');
      setModels(availableModels);
      setSelectedModelState(model);

      if (runningInTauri()) {
        unlistenSetup = await subscribeToSetupEvents((event) => {
          if (!active) {
            return;
          }

          if (event.step === 'model-downloading' && typeof event.progress === 'number') {
            setSetupMessage(`Downloading default model... ${event.progress}%`);
            return;
          }

          if (event.step === 'ollama-not-found') {
            setSetupMessage('Setup required: install Ollama to continue.');
            return;
          }

          if (event.step === 'setup-complete') {
            setSetupMessage('Setup complete.');
            return;
          }

          if (event.step === 'setup-error') {
            setSetupMessage(event.message ?? 'Setup failed.');
            return;
          }

          setSetupMessage(null);
        });
      }
    };

    void load();

    return () => {
      active = false;
      if (unlistenSetup) {
        unlistenSetup();
      }
    };
  }, []);

  const handleNewCampaign = () => {
    resetGame();
    navigate('/world');
  };

  const handleLoadCampaign = async () => {
    if (!selectedCampaign) {
      return;
    }

    setLoadError(null);

    try {
      const campaign = await loadCampaign(selectedCampaign);
      setCampaignName(selectedCampaign);
      setWorld(campaign.world);
      setCharacterName(campaign.characterName);
      setCharacterClass(campaign.characterClass);
      setCharacterDescription(campaign.characterDescription);
      setStats(campaign.stats);
      setHistory(campaign.history);
      setSelectedModelState(campaign.model);
      await setSelectedModel(campaign.model);
      navigate('/game');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load campaign');
    }
  };

  const handleModelChange = async (modelName: string) => {
    setSelectedModelState(modelName);

    try {
      await setSelectedModel(modelName);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to set model');
    }
  };

  const handleCheckUpdates = async () => {
    if (!runningInTauri()) {
      return;
    }

    setIsCheckingUpdate(true);
    setUpdateError(null);

    try {
      const update = await checkForUpdate();
      setUpdateInfo(update);
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : 'Failed to check for updates');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleInstallUpdate = async () => {
    if (!updateInfo) {
      return;
    }

    setIsInstallingUpdate(true);
    setUpdateError(null);

    try {
      await updateInfo.install();
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : 'Failed to install update');
      setIsInstallingUpdate(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center relative overflow-hidden font-serif">
      <div className="absolute inset-0 opacity-20 bg-[url('https://picsum.photos/seed/darkwood/1920/1080?blur=2')] bg-cover bg-center pointer-events-none mix-blend-overlay" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
        className="z-10 flex flex-col items-center"
      >
        <h1 className="text-7xl md:text-9xl text-[#e8dcc4] font-bold tracking-widest mb-16 drop-shadow-[0_0_15px_rgba(232,220,196,0.3)]">
          CHRONICLES
        </h1>

        <div className="flex flex-col gap-6 w-80">
          <button
            onClick={handleNewCampaign}
            className="group relative px-8 py-4 bg-transparent border border-[#e8dcc4]/30 text-[#e8dcc4] text-xl tracking-widest uppercase hover:bg-[#e8dcc4]/10 transition-all duration-300"
          >
            <span className="relative z-10">New Campaign</span>
            <div className="absolute inset-0 border border-[#e8dcc4] opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300" />
          </button>

          <div className="flex gap-2">
            <select
              value={selectedCampaign}
              onChange={(event) => setSelectedCampaign(event.target.value)}
              disabled={campaigns.length === 0}
              className="flex-1 bg-[#111] border border-[#e8dcc4]/20 text-[#e8dcc4]/80 px-3 py-3 rounded"
            >
              {campaigns.length === 0 && <option value="">No campaigns saved</option>}
              {campaigns.map((campaign) => (
                <option key={campaign} value={campaign}>
                  {campaign}
                </option>
              ))}
            </select>
            <button
              onClick={handleLoadCampaign}
              disabled={!selectedCampaign}
              className="px-4 py-3 bg-transparent border border-[#e8dcc4]/30 text-[#e8dcc4] text-sm tracking-wider uppercase hover:bg-[#e8dcc4]/10 transition-all duration-300 disabled:border-[#e8dcc4]/10 disabled:text-[#e8dcc4]/40 disabled:cursor-not-allowed"
            >
              Load
            </button>
          </div>

          <div className="flex flex-col gap-2 text-sm font-sans">
            <label className="tracking-wider uppercase text-[#e8dcc4]/50">Model</label>
            <select
              value={selectedModel}
              onChange={(event) => handleModelChange(event.target.value)}
              className="bg-[#111] border border-[#e8dcc4]/20 text-[#e8dcc4]/80 px-3 py-3 rounded"
            >
              {models.length === 0 && <option value={selectedModel}>{selectedModel}</option>}
              {models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>

          {runningInTauri() && (
            <div className="flex flex-col gap-2">
              <button
                onClick={handleCheckUpdates}
                disabled={isCheckingUpdate || isInstallingUpdate}
                className="px-4 py-3 bg-transparent border border-[#e8dcc4]/20 text-[#e8dcc4]/80 text-sm tracking-wider uppercase hover:bg-[#e8dcc4]/10 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isCheckingUpdate ? 'Checking for updates...' : 'Check for Updates'}
              </button>
              {updateInfo && (
                <button
                  onClick={handleInstallUpdate}
                  disabled={isInstallingUpdate}
                  className="px-4 py-3 bg-transparent border border-emerald-500/40 text-emerald-300 text-sm tracking-wider uppercase hover:bg-emerald-500/10 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isInstallingUpdate
                    ? 'Installing update...'
                    : `Install v${updateInfo.version} and restart`}
                </button>
              )}
            </div>
          )}

          {setupMessage && <p className="text-xs text-amber-300/80 font-sans">{setupMessage}</p>}
          {loadError && <p className="text-xs text-red-400/80 font-sans">{loadError}</p>}
          {updateError && <p className="text-xs text-red-400/80 font-sans">{updateError}</p>}
        </div>
      </motion.div>

      <div className="absolute bottom-8 z-10 flex flex-col items-center gap-2 text-sm font-sans tracking-wider">
        <div className="flex items-center gap-3">
          {ollamaStatus === 'checking' && <span className="text-gray-500">Checking Ollama status...</span>}
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
        <span className="text-[#e8dcc4]/50">Selected model: {selectedModel}</span>
      </div>
    </div>
  );
}
