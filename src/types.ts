export type ViewKey = 'queue' | 'library' | 'schedule' | 'results' | 'brain' | 'settings';

export interface Slide {
  id: string;
  text: string;
  layout?: 'classic' | 'notes' | 'showcase';
  // Generated slides have no source image — they're rendered from text over a
  // gradient. `imageUrl` is kept optional for backwards-compat / future use.
  imageUrl?: string;
  imageFit?: 'cover' | 'contain';
  darkOverlay?: boolean;
  bgFrom?: string;
  bgTo?: string;
}

export type GenerateStyle = 'classic' | 'notes' | 'showcase';

export interface Slideshow {
  id: string;
  hook: string;
  caption: string;
  hashtags: string[];
  slides: Slide[];
  createdAt: string;
  rationale: string;
}

export interface BrainState {
  niche: string;
  appName: string;
  appDescription: string;
  audience: string;
  styleMemory: string;
}

export interface ProjectDefaults {
  socialAccountIds: number[];
  mode: 'draft' | 'schedule';
  postizIntegrationId?: string;
}

export interface Project {
  id: string;
  name: string;
  brain: BrainState;
  defaults: ProjectDefaults;
  imagePacks: string[]; // background packs generation draws from ([] = gradients only)
  finalSlideImageUrl?: string;
  finalSlideImageUrls?: string[];
}

export interface AppConfig {
  keys: { postbridge: string; openrouter: string; apify: string; postiz: string };
  aiBaseUrl: string;
  postizBaseUrl: string;
  model: string;
  pinterestActor: string;
  projects: Project[];
  activeProjectId: string;
}

export interface LibraryImage {
  id: string;
  url: string;
  pack: string;
  source: 'bundled' | 'scraped' | 'uploaded';
  purpose?: 'background' | 'screenshot';
}

export interface LibraryPack {
  name: string;
  source: 'bundled' | 'scraped' | 'uploaded';
  count: number;
  covers: string[];
}

export interface ModelOption {
  id: string;
  name: string;
}

export interface SocialAccount {
  id: number;
  platform: string;
  username: string;
}

export interface PostizIntegration {
  id: string;
  name: string;
  providerIdentifier: string;
  picture?: string;
  profile?: string;
  disabled?: boolean;
}

export interface PostizPost {
  id: string;
  content: string;
  publishDate: string | null;
  state: string;
  releaseUrl: string | null;
  releaseId: string | null;
  creationMethod: string;
  integrationName: string;
  integrationProvider: string;
}

// Shapes returned by post-bridge (mapped in lib/api.ts).
export interface ScheduledPost {
  id: string;
  caption: string;
  status: string; // scheduled | processing | posted | draft
  scheduledAt: string | null;
  mediaUrls: string[];
  socialAccounts: number[];
  isDraft: boolean;
}

export interface PostResult {
  id: string;
  platform: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  coverImageUrl: string | null;
  shareUrl: string | null;
  description: string | null;
  lastSyncedAt: string | null;
}
