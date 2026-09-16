import { Category, LongFormVideoSubCategory } from './categories';

/**
 * Declarative, data-driven classification rules (design doc §3.2 step 1).
 *
 * Rules are structured data rather than branching code so the taxonomy can be
 * extended without touching the pipeline (design doc §3.2.1 — "editable without
 * touching classification code"). Matching is ordered: rules earlier in the
 * array win, which lets specific patterns (e.g. `instagram.com/reels/`) mask
 * broader host matches.
 */
export interface CategoryRule {
  /** Stable identifier for the rule (also used as the LLM cache `method`). */
  id: string;
  /** Absent only for content-layer rules, which never classify by themselves. */
  category?: Category;
  subCategory?: LongFormVideoSubCategory;
  /** Exact hostnames, lowercased and without a leading `www.`. */
  hosts?: string[];
  /** Regular expression sources, tested against the full URL. */
  urlPatterns?: string[];
  /** Exact process/app names. */
  apps?: string[];
  /** Process name prefixes (e.g. `jetbrains-` covers pycharm/webstorm/idea). */
  appPrefixes?: string[];
  /**
   * When true this rule never classifies by itself — it only marks traffic as
   * needing the content layer (URL + page title → backend LLM, §3.2). Used for
   * e.g. `youtube.com/watch`, where the category depends on the content.
   */
  requiresContentLayer?: boolean;
}

const DEEP_WORK_APPS = [
  'code',
  'cursor',
  'vscodium',
  'zed',
  'sublime_text',
  'pycharm',
  'webstorm',
  'goland',
  'rubymine',
  'phpstorm',
  'clion',
  'idea',
  'code-server',
  'vim',
  'nvim',
  'emacs',
  'helix',
  'nano',
  'micro',
  'obsidian',
  'typora',
  'logseq',
  'joplin',
  'terminal',
  'konsole',
  'alacritty',
  'kitty',
  'wezterm',
  'gnome-terminal',
  'xfce4-terminal',
  'tilix',
  'docker',
];

const COMMUNICATION_APPS = [
  'slack',
  'discord',
  'telegram-desktop',
  'whatsapp',
  'teams',
  'zoom',
  'zoom.us',
  'mattermost',
  'signal-desktop',
  'element',
  'skype',
];

const MUSIC_APPS = [
  'spotify',
  'ncspot',
  'cmus',
  'audacious',
  'lollypop',
  'youtube-music',
  'google-play-music',
];

const VIDEO_PLAYER_APPS = ['vlc', 'mpv', 'celluloid', 'totem', 'kodi'];

/**
 * Default category rule set (design doc §3.1 table). Intentional ordering —
 * most specific URL patterns first, content-layer hosts before their broad
 * fallbacks, host rules before app rules are irrelevant here (matched
 * separately).
 */
export const DEFAULT_CATEGORY_RULES: readonly CategoryRule[] = [
  // --- Short-form video (sub-URLs of larger sites) ---
  {
    id: 'youtube-shorts',
    category: Category.SHORT_FORM_VIDEO,
    urlPatterns: ['^https?://(www\\.|m\\.)?youtube\\.com/shorts/'],
  },
  {
    id: 'instagram-reels',
    category: Category.SHORT_FORM_VIDEO,
    urlPatterns: ['instagram\\.com/reels/', 'instagram\\.com/stories/'],
  },
  {
    id: 'facebook-reels',
    category: Category.SHORT_FORM_VIDEO,
    urlPatterns: ['facebook\\.com/reel/'],
  },
  {
    id: 'tiktok',
    category: Category.SHORT_FORM_VIDEO,
    hosts: ['tiktok.com'],
  },

  // --- YouTube content layer: category depends on the content, so defer to LLM ---
  {
    id: 'youtube-watch',
    requiresContentLayer: true,
    urlPatterns: [
      '^https?://(www\\.|m\\.)?youtube\\.com/watch\\?',
      '^https?://youtu\\.be/',
      '^https?://(www\\.)?youtube\\.com/embed/',
      '^https?://(www\\.)?youtube\\.com/live/',
    ],
  },

  // --- Long-form video (streaming) ---
  {
    id: 'streaming-netflix',
    category: Category.LONG_FORM_VIDEO,
    hosts: [
      'netflix.com',
      'primevideo.com',
      'hulu.com',
      'disneyplus.com',
      'max.com',
      'crunchyroll.com',
      'vimeo.com',
      'twitch.tv',
    ],
  },
  {
    id: 'video-players',
    category: Category.LONG_FORM_VIDEO,
    appPrefixes: VIDEO_PLAYER_APPS,
  },

  // --- Music / audio ---
  {
    id: 'music-hosts',
    category: Category.MUSIC_AUDIO,
    hosts: ['music.youtube.com', 'open.spotify.com'],
  },
  {
    id: 'music-apps',
    category: Category.MUSIC_AUDIO,
    appPrefixes: MUSIC_APPS,
  },

  // --- Social media ---
  {
    id: 'social-hosts',
    category: Category.SOCIAL_MEDIA,
    hosts: [
      'instagram.com',
      'x.com',
      'twitter.com',
      'reddit.com',
      'facebook.com',
      'threads.net',
      'linkedin.com',
      'pinterest.com',
      'bsky.app',
    ],
  },

  // --- Deep work (dev + writing + terminals) ---
  {
    id: 'deep-work-hosts',
    category: Category.DEEP_WORK,
    hosts: [
      'github.com',
      'gitlab.com',
      'bitbucket.org',
      'stackoverflow.com',
      'serverfault.com',
      'superuser.com',
      'stackexchange.com',
      'codesandbox.io',
      'replit.com',
      'codepen.io',
      'npmjs.com',
      'sourcegraph.com',
      'python.org',
      'nodejs.org',
      'docs.docker.com',
      'kubernetes.io',
      'go.dev',
      'rust-lang.org',
      'dev.to',
    ],
  },
  {
    id: 'deep-work-apps',
    category: Category.DEEP_WORK,
    apps: DEEP_WORK_APPS,
    appPrefixes: ['jetbrains-', 'code-oss', 'WebStorm'],
  },

  // --- Learning ---
  {
    id: 'learning-hosts',
    category: Category.LEARNING,
    hosts: [
      'coursera.org',
      'udemy.com',
      'udacity.com',
      'edx.org',
      'khanacademy.org',
      'pluralsight.com',
      'skillshare.com',
      'codecademy.com',
      'freecodecamp.org',
      'w3schools.com',
      'developer.mozilla.org',
      'learn.microsoft.com',
      'roadmap.sh',
      'colab.research.google.com',
    ],
  },
  {
    id: 'learning-anki',
    category: Category.LEARNING,
    apps: ['anki'],
  },

  // --- Communication ---
  {
    id: 'communication-hosts',
    category: Category.COMMUNICATION,
    hosts: [
      'slack.com',
      'discord.com',
      'app.slack.com',
      'mattermost.com',
      'teams.microsoft.com',
      'zoom.us',
      'meet.google.com',
      'web.whatsapp.com',
      'mail.google.com',
      'outlook.live.com',
      'outlook.com',
      't.me',
      'messages.google.com',
    ],
  },
  {
    id: 'communication-apps',
    category: Category.COMMUNICATION,
    apps: COMMUNICATION_APPS,
  },

  // --- Deep work documents/writing web apps ---
  {
    id: 'writing-hosts',
    category: Category.DEEP_WORK,
    hosts: ['docs.google.com', 'notion.so', 'dropbox.paper'],
  },
];

/** A stable `method` label for rule-based cached classifications. */
export const RULE_METHOD = 'rule';
/** A stable `method` label for LLM-based cached classifications. */
export const LLM_METHOD = 'llm';
