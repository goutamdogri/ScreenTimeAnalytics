import { CATEGORIES, LONG_FORM_VIDEO_SUB_CATEGORIES } from '@screen-time/core';

/**
 * Shared classification prompt for all providers. The URL + page title are the
 * only content signals ever sent (design doc §3.2 — no DOM scraping). Providers
 * are instructed to return strict JSON, which each adapter routes into a JSON
 * response format, then parses through `parseLLMClassification`.
 */

export const CLASSIFICATION_SYSTEM_PROMPT = `You classify web page visits for a screen-time analytics app.
Classify into EXACTLY one top-level category from this list:
${CATEGORIES.map((c) => `- ${c}`).join('\n')}

When the category is "long_form_video", also choose one sub-category from this list:
${LONG_FORM_VIDEO_SUB_CATEGORIES.map((s) => `- ${s}`).join('\n')}

Use only the page URL and title; do not guess beyond the evidence. Prefer precise
sub-categories for long-form video (educational_tutorial, documentary, tech_review,
entertainment_comedy, vlog_lifestyle, news_commentary, podcast_talk, music_long_form, other).

Respond with JSON ONLY, no markdown:
{
  "category": "<one top-level category>",
  "subCategory": "<sub-category, ONLY when category is long_form_video>",
  "confidence": <number 0..1 reflecting how sure you are>,
  "reason": "<short phrase>"
}`;

export function classificationUserPrompt(url: string, pageTitle: string): string {
  const titleLine = pageTitle ? `Page title: ${pageTitle}` : 'Page title: (none)';
  return `URL: ${url}\n${titleLine}`;
}

export const LLM_CLIENT_VERSION = '0.1.0';
