const TURNSTILE_SCRIPT_ID = 'cloudflare-turnstile-script';
const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export const captchaSiteKey = import.meta.env.VITE_CAPTCHA_SITE_KEY ?? '';

export function isCaptchaConfigured() {
  return Boolean(captchaSiteKey && !captchaSiteKey.includes('COLE_') && !captchaSiteKey.includes('AQUI'));
}

export function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.turnstile), { once: true });
      existing.addEventListener('error', () => reject(new Error('Erro ao validar CAPTCHA.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.turnstile);
    script.onerror = () => reject(new Error('Erro ao validar CAPTCHA.'));
    document.head.appendChild(script);
  });
}
