const TURNSTILE_SCRIPT_ID = 'cloudflare-turnstile-script';
const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let turnstilePromise;

export const captchaSiteKey = import.meta.env.VITE_CAPTCHA_SITE_KEY ?? '';

export function isCaptchaConfigured() {
  return Boolean(captchaSiteKey && !captchaSiteKey.includes('COLE_') && !captchaSiteKey.includes('AQUI'));
}

export function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstilePromise) return turnstilePromise;

  turnstilePromise = new Promise((resolve, reject) => {
    const finish = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('Não foi possível validar o CAPTCHA.'));
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID);
    if (existing) {
      if (existing.dataset.loaded === 'true') finish();
      else existing.addEventListener('load', finish, { once: true });
      existing.addEventListener('error', () => reject(new Error('Não foi possível validar o CAPTCHA.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => { script.dataset.loaded = 'true'; finish(); };
    script.onerror = () => reject(new Error('Não foi possível validar o CAPTCHA.'));
    document.head.appendChild(script);
  }).catch((error) => { turnstilePromise = undefined; throw error; });
  return turnstilePromise;
}
