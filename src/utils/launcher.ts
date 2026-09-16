import { AppLauncherItem } from '../types';

/**
 * Checks if a string is a native custom URI scheme or Android intent
 */
export function isCustomScheme(url: string): boolean {
  return (
    /^[a-zA-Z0-9_-]+:/.test(url) &&
    !url.startsWith('http://') &&
    !url.startsWith('https://')
  );
}

/**
 * Detects mobile platform
 */
export function getMobilePlatform(): 'android' | 'ios' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent.toLowerCase();
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'other';
}

/**
 * Resolves the primary deep link for a given application based on device OS
 */
export function getPrimaryDeepLink(app: AppLauncherItem): string | undefined {
  const platform = getMobilePlatform();

  if (app.id === 'google-notebook') {
    if (platform === 'android') {
      // Android intent directly targeting Google NotebookLM app package
      return 'intent://notebooklm.google.com/#Intent;scheme=https;package=com.google.android.apps.labs.language.tailwind;S.browser_fallback_url=https%3A%2F%2Fnotebooklm.google.com;end';
    }
    // On iOS, direct navigation to notebooklm.google.com triggers the iOS Universal Link for the installed NotebookLM app
    return 'https://notebooklm.google.com/';
  }

  if (app.id === 'claude-ai') {
    if (platform === 'android') {
      // Android Chrome intent explicitly invoking com.anthropic.claude
      return 'intent://claude.ai/new#Intent;scheme=claude;package=com.anthropic.claude;S.browser_fallback_url=https%3A%2F%2Fclaude.ai;end';
    }
    // iOS and general: Claude requires host claude.ai/new
    return 'claude://claude.ai/new';
  }

  if (app.id === 'chat-gpt') {
    if (platform === 'android') {
      return 'intent://#Intent;scheme=chatgpt;package=com.openai.chatgpt;S.browser_fallback_url=https%3A%2F%2Fchatgpt.com;end';
    }
    return 'chatgpt://';
  }

  if (app.id === 'zentube') {
    // ZenTube is accessible directly at https://zentube.app/
    // On iOS, navigating to https://zentube.app/ triggers native Universal Links if installed
    return 'https://zentube.app/';
  }

  if (app.id === 'weather') {
    if (platform === 'ios') {
      // Official Apple Weather app scheme on iPhone / iPad
      return 'weather://';
    }
    if (platform === 'android') {
      // Android intent to open Google Weather or device weather provider with fallback
      return 'intent://www.google.com/search?q=meteo#Intent;scheme=https;package=com.google.android.googlequicksearchbox;S.browser_fallback_url=https%3A%2F%2Fmeteofrance.com;end';
    }
    return 'weather://';
  }

  return app.deepLink;
}

/**
 * Resolves an alternative deep link if the primary one doesn't trigger on a specific browser
 */
export function getAlternativeDeepLink(app: AppLauncherItem): string | undefined {
  const platform = getMobilePlatform();

  if (app.id === 'zentube') {
    if (platform === 'ios') {
      // Official App Store link for ZenTube Decluttered
      return 'https://apps.apple.com/app/zentube-decluttered/id6447817424';
    }
    if (platform === 'android') {
      return 'https://play.google.com/store/apps/details?id=com.zentubeofficial.zentube';
    }
    return 'https://zentube.app/';
  }

  if (app.id === 'weather') {
    if (platform === 'android') {
      // Direct custom weather scheme common on Samsung and other Android vendors
      return 'weather://';
    }
    return 'https://meteofrance.com/';
  }

  if (app.id === 'google-notebook') {
    if (platform === 'android') {
      // Direct launcher action intent for NotebookLM
      return 'intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=com.google.android.apps.labs.language.tailwind;end';
    }
    // Alternate fallback (e.g. Google Keep in case user meant Google Keep Notes)
    return 'googlekeep://';
  }

  if (app.id === 'claude-ai') {
    if (platform === 'android') {
      // Alternative for Android (direct custom scheme)
      return 'claude://claude.ai/new';
    }
    // Alternative for iOS
    return 'claude://claude.ai/';
  }

  if (app.id === 'chat-gpt') {
    if (platform === 'android') {
      return 'chatgpt://';
    }
    return 'com.openai.chat://';
  }

  return undefined;
}

/**
 * Triggers launch of an app via deep link or web fallback
 */
export function launchAppUrl(targetUrl: string, fallbackWebUrl?: string, isAppTarget: boolean = false): void {
  const isScheme = isCustomScheme(targetUrl);

  if (isScheme) {
    let hasNavigatedAway = false;
    const onPageHide = () => {
      hasNavigatedAway = true;
    };
    window.addEventListener('pagehide', onPageHide, { once: true });

    // 1. Attempt native scheme navigation
    try {
      window.location.href = targetUrl;
    } catch (e) {
      console.warn('Direct location.href launch error:', e);
    }

    try {
      const anchor = document.createElement('a');
      anchor.href = targetUrl;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch {
      // Ignore
    }

    // 2. Automated fallback to web URL if app is not installed and user is still on page
    if (fallbackWebUrl && fallbackWebUrl !== targetUrl) {
      setTimeout(() => {
        window.removeEventListener('pagehide', onPageHide);
        if (!hasNavigatedAway && typeof document !== 'undefined' && document.visibilityState === 'visible') {
          console.info('Native application not responding, redirecting to web version:', fallbackWebUrl);
          try {
            const win = window.open(fallbackWebUrl, '_blank', 'noopener,noreferrer');
            if (!win || win.closed || typeof win.closed === 'undefined') {
              window.location.href = fallbackWebUrl;
            }
          } catch {
            window.location.href = fallbackWebUrl;
          }
        }
      }, 1800);
    }
  } else {
    // Standard web URL or Universal Link (e.g. https://zentube.app/, https://notebooklm.google.com/)
    let opened = false;

    // Try standard popup / new tab
    try {
      const win = window.open(targetUrl, '_blank', 'noopener,noreferrer');
      if (win && !win.closed && typeof win.closed !== 'undefined') {
        opened = true;
      }
    } catch {
      opened = false;
    }

    // If popup blocked or inside iframe/PWA, trigger synthetic anchor
    if (!opened) {
      try {
        const anchor = document.createElement('a');
        anchor.href = targetUrl;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        opened = true;
      } catch {
        opened = false;
      }
    }

    // If still blocked in strict container, navigate current window
    if (!opened) {
      window.location.href = targetUrl;
    }
  }
}
