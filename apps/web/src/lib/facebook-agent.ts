/**
 * Types and helpers for the Facebook agent dashboard.
 *
 * Note what is absent: there is no field here for a Page access token, and
 * there is nowhere for one to go. The backend never sends one, and the shape
 * of these types is the second line of defence — a token appearing in a
 * response would have nowhere to land.
 */

export type AgentMode = 'FULL_AUTO' | 'APPROVAL_REQUIRED' | 'PAUSED';

export type AgentRunState =
  | 'idle' | 'observing' | 'analyzing' | 'deciding' | 'waiting'
  | 'generating' | 'publishing' | 'verifying' | 'learning' | 'error' | 'paused';

export interface Capabilities {
  can_read_page?: boolean;
  can_read_comments?: boolean;
  can_publish_posts?: boolean;
  can_publish_images?: boolean;
  can_publish_stories?: boolean;
  can_publish_reels?: boolean;
  can_manage_comments?: boolean;
  can_read_insights?: boolean;
  /** Why each false capability is false, naming the exact missing permission. */
  missing?: Record<string, string[]>;
  granted_scopes?: string[];
  page_tasks?: string[];
}

export interface AgentStatus {
  meta_configured: boolean;
  graph_version: string;
  worker_running: boolean;
  connected: boolean;
  page: {
    id: string;
    page_id: string;
    name: string;
    category: string | null;
    status: 'connected' | 'token_invalid' | 'revoked' | 'disconnected';
    status_detail: string | null;
    connected_at: string;
    last_synced_at: string | null;
    capabilities: Capabilities;
  } | null;
  agent: {
    enabled: boolean;
    mode: AgentMode;
    emergency_stopped: boolean;
    limits: {
      max_feed_posts_per_day: number;
      max_image_posts_per_day: number;
      max_stories_per_day: number;
      max_reels_per_day: number;
      max_comment_replies_per_hour: number;
      min_minutes_between_feed_posts: number;
    };
    content_mix: { text: number; image: number; story: number };
    comment_reply_confidence: number;
    diversity_days: number;
    today: {
      feed_posts: number;
      image_posts: number;
      stories: number;
      reels: number;
      comment_replies: number;
      replies_last_hour: number;
      minutes_since_feed_post: number | null;
    };
  } | null;
}

export interface AgentRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  state: AgentRunState;
  status: 'running' | 'completed' | 'failed' | 'skipped';
  decision: string | null;
  reason: string | null;
  actions_taken: number;
  used_ai: boolean;
  error: string | null;
  duration_ms: number | null;
}

export interface AgentAction {
  action_type: string;
  status: string;
  external_id: string | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface AgentActivity {
  runs: AgentRun[];
  decisions: {
    decision: string;
    reason: string;
    confidence: number | null;
    topic: string | null;
    source: 'rules' | 'model';
    created_at: string;
  }[];
  actions: AgentAction[];
}

export interface ContentPlan {
  id: string;
  scheduled_for: string | null;
  content_type: 'text_post' | 'image_post' | 'story';
  topic: string | null;
  animal: string | null;
  caption: string | null;
  status: string;
  status_detail: string | null;
  created_by: string;
  created_at: string;
}

export interface PendingComment {
  comment_id: string;
  fb_post_id: string;
  message: string;
  author_name: string | null;
  classification: string;
  action: string;
  created_time: string;
  post_context: string | null;
}

/** Plain-English label for a decision, for people who did not write the enum. */
export const DECISION_LABELS: Record<string, string> = {
  do_nothing: 'Did nothing',
  wait: 'Waiting',
  publish_text_post: 'Published a text post',
  publish_image_post: 'Published an image post',
  publish_story: 'Published a story',
  reply_to_comments: 'Replied to comments',
  flag_for_review: 'Flagged for review',
};

export const STATE_LABELS: Record<AgentRunState, string> = {
  idle: 'Idle',
  observing: 'Observing',
  analyzing: 'Analyzing',
  deciding: 'Thinking',
  waiting: 'Waiting',
  generating: 'Creating',
  publishing: 'Publishing',
  verifying: 'Verifying',
  learning: 'Learning',
  error: 'Error',
  paused: 'Paused',
};

export const CAPABILITY_LABELS: Record<string, string> = {
  can_read_page: 'Read the Page',
  can_read_comments: 'Read comments',
  can_publish_posts: 'Publish posts',
  can_publish_images: 'Publish images',
  can_publish_stories: 'Publish stories',
  can_publish_reels: 'Publish reels',
  can_manage_comments: 'Reply to comments',
  can_read_insights: 'Read insights',
};

/** "4h 12m ago" — the agent's decisions are all about elapsed time. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'unknown';

  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

export function formatClock(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Whether a run is worth showing prominently.
 *
 * Most runs decide to do nothing, which is correct but not interesting. The
 * activity feed shows everything; the summary leads with what happened.
 */
export function isNoteworthy(run: AgentRun): boolean {
  return run.actions_taken > 0
    || run.status === 'failed'
    || run.decision === 'flag_for_review';
}
