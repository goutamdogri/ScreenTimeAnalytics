import {
  buildCapturePayload,
  createCaptureScheduler,
  CapturePayload,
  LOCAL_AGENT_EVENT_URL,
} from './capture';

/**
 * Best-effort reporter: the agent might not be running, so every failure is
 * swallowed. MV3 service workers do not receive real fetch failures as
 * exceptions after the fetch rejects — this is the only place errors surface.
 */
async function report(payload: CapturePayload): Promise<void> {
  try {
    const res = await fetch(LOCAL_AGENT_EVENT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.debug(`screen-time: agent rejected payload (${res.status})`);
    }
  } catch {
    // Agent offline — nothing to do, next tab change retries.
  }
}

const schedule = createCaptureScheduler({ onCapture: (p) => void report(p) });

async function captureTab(tabId: number): Promise<void> {
  let tab: chrome.tabs.Tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return; // tab was closed while queued
  }
  schedule(buildCapturePayload(tab));
}

chrome.tabs.onActivated.addListener((activeInfo) => {
  void captureTab(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete' || changeInfo.url !== undefined) {
    void captureTab(tabId);
  }
});
