import { useEffect, useRef } from 'react';
import { captchaSiteKey, isCaptchaConfigured, loadTurnstile } from '../services/captchaService.js';

export default function TurnstileCaptcha({ onToken, onExpired, onError, resetKey = 0 }) {
  const containerRef = useRef(null);
  const callbacksRef = useRef({ onToken, onExpired, onError });

  useEffect(() => { callbacksRef.current = { onToken, onExpired, onError }; }, [onToken, onExpired, onError]);

  useEffect(() => {
    if (!isCaptchaConfigured()) return undefined;
    let active = true;
    let widgetId;

    loadTurnstile()
      .then((turnstile) => {
        if (!active || !containerRef.current || !turnstile) return;
        widgetId = turnstile.render(containerRef.current, {
          sitekey: captchaSiteKey,
          theme: 'auto',
          size: 'flexible',
          callback: (token) => callbacksRef.current.onToken(token),
          'expired-callback': () => callbacksRef.current.onExpired(),
          'error-callback': () => callbacksRef.current.onError(),
        });
      })
      .catch(() => callbacksRef.current.onError());

    return () => {
      active = false;
      if (widgetId !== undefined && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [resetKey]);

  if (!isCaptchaConfigured()) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">Erro ao validar CAPTCHA.</div>;
  }

  return <div ref={containerRef} className="min-h-[65px] w-full overflow-hidden rounded-xl" aria-label="Verificação de segurança" />;
}
