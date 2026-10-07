export type TeamId = 'team-1' | 'team-2' | 'team-3' | 'team-4' | 'team-5' | 'team-6';

export interface TeamInfo {
  id: TeamId;
  number: number;
  name: string;
  color: string;
  badgeBg: string;
  icon: string;
}

export type AgentType = 'voice' | 'text';

export interface AgentData {
  id: string;
  name: string;
  phone: string; // e.g. "888 067 069"
  phoneClean: string; // normalized digits only "888067069"
  type: AgentType;
  personality: string;
  reward: string; // "Čo ti dáva" / quest clue / splnená úloha
  avatarEmoji: string;
  accentColor: string;
  voice: 'leda' | 'fenrir' | 'kore' | 'aoede' | 'puck' | 'charon' | string;
  greeting: string;
  tagline: string;
  prerequisite?: string; // Prerekvizita
  givesItem?: string; // Čo ti dáva (Item)
  givesContact?: string; // Čo ti dáva (Telefónne číslo)
  isQuest?: boolean;
}

export interface InventoryItem {
  id: string;
  name: string;
  icon: string;
  description: string;
  unlockedAt?: string;
  sourceAgent?: string;
}

export interface DiscoveredContact {
  phone: string;
  phoneClean: string;
  name: string;
  type: AgentType;
  unlockedAt?: string;
  sourceAgent?: string;
}

export interface TeamInventory {
  teamId: TeamId;
  items: InventoryItem[];
  contacts: DiscoveredContact[];
  petrovicApproved?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string | Date;
  agentId: string;
  teamId?: TeamId;
  isReward?: boolean;
}

export type VoiceStatus = 'idle' | 'calling' | 'connected' | 'listening' | 'processing' | 'speaking' | 'ended';

export type DummyBehaviorType = 'bangarang' | 'beep' | 'failed' | 'leaders' | 'yapper' | 'pig';

export interface DummyConfig {
  id: DummyBehaviorType;
  name: string; // if non-empty, displayed on phone call; if empty, dialed number is displayed
  title: string;
  description: string;
  customText?: string;
}

export interface CallSession {
  targetPhone: string;
  targetName: string;
  agentId?: string;
  isDummy?: boolean;
  dummyType?: DummyBehaviorType;
  isMatejMakita?: boolean;
  agentType: AgentType;
  agent?: AgentData;
  status: VoiceStatus;
  startTime?: number;
}

export interface ChatLogRecord {
  id: string;
  timestamp: string;
  sessionId: string;
  teamId?: TeamId;
  agent: string;
  agentType?: AgentType;
  userMessage: string;
  agentReply: string;
  voice?: string;
  clientIp?: string;
  userAgent?: string;
  questUnlocked?: boolean;
  unlockedItem?: string;
  unlockedContact?: string;
}
