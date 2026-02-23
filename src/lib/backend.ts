import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { CharacterClass, Message, Stats, World } from '../GameContext';

export interface OllamaStatus {
  running: boolean;
  models: string[];
}

export interface SetupEvent {
  step: string;
  progress?: number;
  message?: string;
}

export interface CampaignData {
  world: World;
  characterName: string;
  characterClass: CharacterClass;
  characterDescription: string;
  stats: Stats;
  history: Message[];
  model: string;
  updatedAt: string;
}

export interface UpdateInfo {
  version: string;
  date?: string;
  body?: string;
  install: () => Promise<void>;
}

const CAMPAIGN_PREFIX = 'chronicles:campaign:';

function fallbackModel(): string {
  return window.localStorage.getItem('chronicles:selected-model') ?? 'mistral';
}

function persistFallbackModel(model: string): void {
  window.localStorage.setItem('chronicles:selected-model', model);
}

function isMessage(value: unknown): value is Message {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    (candidate.role === 'system' || candidate.role === 'user' || candidate.role === 'assistant') &&
    typeof candidate.content === 'string'
  );
}

function isStats(value: unknown): value is Stats {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.health === 'number' &&
    typeof candidate.weapon === 'string' &&
    typeof candidate.gold === 'number'
  );
}

function parseCampaignData(raw: unknown): CampaignData {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Invalid campaign payload');
  }

  const candidate = raw as Record<string, unknown>;

  const world = candidate.world;
  const characterName = candidate.characterName;
  const characterClass = candidate.characterClass;
  const characterDescription = candidate.characterDescription;
  const stats = candidate.stats;
  const history = candidate.history;
  const model = candidate.model;
  const updatedAt = candidate.updatedAt;

  const validWorlds: World[] = ['Fantasy', 'Sci-Fi', 'Horror', 'Western'];
  const validClasses: CharacterClass[] = ['Rogue', 'Warrior', 'Mage', 'Ranger'];

  if (!validWorlds.includes(world as World)) {
    throw new Error('Invalid campaign world');
  }
  if (typeof characterName !== 'string' || !characterName.trim()) {
    throw new Error('Invalid campaign character name');
  }
  if (!validClasses.includes(characterClass as CharacterClass)) {
    throw new Error('Invalid campaign character class');
  }
  if (typeof characterDescription !== 'string') {
    throw new Error('Invalid campaign character description');
  }
  if (!isStats(stats)) {
    throw new Error('Invalid campaign stats');
  }
  if (!Array.isArray(history) || history.some((message) => !isMessage(message))) {
    throw new Error('Invalid campaign history');
  }
  const parsedWorld = world as World;
  const parsedCharacterClass = characterClass as CharacterClass;
  const parsedHistory = history as Message[];
  const parsedModel = typeof model === 'string' && model.trim() ? model : 'mistral';
  const parsedUpdatedAt =
    typeof updatedAt === 'string' && updatedAt.trim() ? updatedAt : new Date(0).toISOString();

  return {
    world: parsedWorld,
    characterName,
    characterClass: parsedCharacterClass,
    characterDescription,
    stats,
    history: parsedHistory,
    model: parsedModel,
    updatedAt: parsedUpdatedAt,
  };
}

export function runningInTauri(): boolean {
  return isTauri();
}

export async function checkOllamaStatus(): Promise<OllamaStatus> {
  if (runningInTauri()) {
    return invoke<OllamaStatus>('check_ollama_status');
  }

  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (!response.ok) {
      return { running: false, models: [] };
    }

    const body = (await response.json()) as { models?: Array<{ name?: string; model?: string }> };
    const models = (body.models ?? [])
      .map((entry) => entry.name ?? entry.model ?? '')
      .filter((name) => name.length > 0);

    return {
      running: true,
      models,
    };
  } catch {
    return { running: false, models: [] };
  }
}

export async function getAvailableModels(): Promise<string[]> {
  if (runningInTauri()) {
    return invoke<string[]>('get_available_models');
  }

  const status = await checkOllamaStatus();
  return status.models;
}

export async function getSelectedModel(): Promise<string> {
  if (runningInTauri()) {
    return invoke<string>('get_selected_model');
  }

  return fallbackModel();
}

export async function setSelectedModel(modelName: string): Promise<void> {
  if (runningInTauri()) {
    await invoke('set_selected_model', { modelName });
    return;
  }

  persistFallbackModel(modelName);
}

export async function subscribeToSetupEvents(
  onEvent: (event: SetupEvent) => void,
): Promise<() => void> {
  if (!runningInTauri()) {
    return () => {
      return;
    };
  }

  const unlisten = await listen<SetupEvent>('setup-required', (event) => {
    onEvent(event.payload);
  });

  return unlisten;
}

interface StreamToken {
  token: string;
}

interface StreamError {
  message: string;
}

export async function streamChat(
  model: string,
  messages: Message[],
  onToken: (token: string) => void,
): Promise<string> {
  if (runningInTauri()) {
    let fullResponse = '';
    let streamError: string | null = null;

    const unlistenToken = await listen<StreamToken>('chat-token', (event) => {
      fullResponse += event.payload.token;
      onToken(event.payload.token);
    });

    const unlistenError = await listen<StreamError>('chat-error', (event) => {
      streamError = event.payload.message;
    });

    try {
      await invoke('chat', { model, messages });
      if (streamError) {
        throw new Error(streamError);
      }
      return fullResponse;
    } finally {
      unlistenToken();
      unlistenError();
    }
  }

  const response = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let fullResponse = '';
  let pending = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    pending += decoder.decode(value, { stream: true });
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      try {
        const parsed = JSON.parse(trimmed) as { message?: { content?: string } };
        const token = parsed.message?.content;
        if (token) {
          fullResponse += token;
          onToken(token);
        }
      } catch {
        continue;
      }
    }
  }

  const remaining = pending.trim();
  if (remaining) {
    try {
      const parsed = JSON.parse(remaining) as { message?: { content?: string } };
      const token = parsed.message?.content;
      if (token) {
        fullResponse += token;
        onToken(token);
      }
    } catch {
      // Keep compatibility with Ollama stream chunking.
    }
  }

  return fullResponse;
}

export async function listCampaigns(): Promise<string[]> {
  if (runningInTauri()) {
    return invoke<string[]>('list_campaigns');
  }

  return Object.keys(window.localStorage)
    .filter((key) => key.startsWith(CAMPAIGN_PREFIX))
    .map((key) => key.slice(CAMPAIGN_PREFIX.length))
    .sort();
}

export async function saveCampaign(name: string, data: CampaignData): Promise<void> {
  if (runningInTauri()) {
    await invoke('save_campaign', {
      name,
      data: JSON.stringify(data),
    });
    return;
  }

  window.localStorage.setItem(`${CAMPAIGN_PREFIX}${name}`, JSON.stringify(data));
}

export async function loadCampaign(name: string): Promise<CampaignData> {
  const raw = runningInTauri()
    ? await invoke<string>('load_campaign', { name })
    : window.localStorage.getItem(`${CAMPAIGN_PREFIX}${name}`);

  if (!raw) {
    throw new Error(`Campaign not found: ${name}`);
  }

  return parseCampaignData(JSON.parse(raw));
}

export async function deleteCampaign(name: string): Promise<void> {
  if (runningInTauri()) {
    await invoke('delete_campaign', { name });
    return;
  }

  window.localStorage.removeItem(`${CAMPAIGN_PREFIX}${name}`);
}

export function createCampaignName(characterName: string, world: World): string {
  const raw = `${characterName}-${world}`.toLowerCase();
  const slug = raw
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || 'campaign';
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!runningInTauri()) {
    return null;
  }

  const updaterModule = await import('@tauri-apps/plugin-updater');
  const processModule = await import('@tauri-apps/plugin-process');

  const update = await updaterModule.check();
  if (!update) {
    return null;
  }

  return {
    version: update.version,
    date: update.date,
    body: update.body,
    install: async () => {
      await update.downloadAndInstall();
      await processModule.relaunch();
    },
  };
}
