(() => {
  const GOOGLE_ENDPOINT =
    'https://script.google.com/macros/s/AKfycbzY2NdD0aNaXXWVBtDG_dechUKi7ElmuB4QMtbafRkkQaAWbEA0Sq8mi1F5fQGvizCcaA/exec';

  const MIRROR_ENDPOINT =
    'https://englishfactory.ru/api/lead.php';

  const nativeFetch = window.fetch.bind(window);

  const getUrl = (input) => {
    if (typeof input === 'string') return input;

    if (
      input &&
      typeof input.url === 'string'
    ) {
      return input.url;
    }

    return '';
  };

  const getMethod = (input, init) => {
    if (init?.method) {
      return String(init.method).toUpperCase();
    }

    if (input?.method) {
      return String(input.method).toUpperCase();
    }

    return 'GET';
  };

  const parseJsonBody = (body) => {
    if (typeof body !== 'string') {
      return null;
    }

    try {
      const parsed = JSON.parse(body);

      return (
        parsed &&
        typeof parsed === 'object'
      )
        ? parsed
        : null;

    } catch (_) {
      return null;
    }
  };

  const inferPhone = (contactValue) => {
    const contact =
      String(contactValue || '').trim();

    return contact
      .replace(/\D/g, '')
      .length >= 7
        ? contact
        : '';
  };

  const createRequestId = () => {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
      .replace(/[xy]/g, (char) => {
        const random =
          Math.random() * 16 | 0;

        const value =
          char === 'x'
            ? random
            : (random & 0x3) | 0x8;

        return value.toString(16);
      });
  };

  const wait = (ms) =>
    new Promise(
      (resolve) =>
        window.setTimeout(resolve, ms)
    );

  const saveLeadToMysql = async (
    payload
  ) => {
    let lastError = null;

    for (
      let attempt = 1;
      attempt <= 3;
      attempt += 1
    ) {
      const controller =
        new AbortController();

      const timeout =
        window.setTimeout(
          () => controller.abort(),
          8000
        );

      try {
        const response =
          await nativeFetch(
            MIRROR_ENDPOINT,
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json'
              },

              body:
                JSON.stringify(payload),

              signal:
                controller.signal,

              keepalive: true
            }
          );

        const result =
          await response
            .json()
            .catch(() => null);

        if (
          response.ok &&
          result?.ok === true
        ) {
          return result;
        }

        const error =
          new Error(
            result?.error ||
            `MySQL API returned HTTP ${response.status}`
          );

        if (
          response.status >= 400 &&
          response.status < 500
        ) {
          error.noRetry = true;
          throw error;
        }

        lastError = error;

      } catch (error) {
        lastError = error;

        if (error?.noRetry) {
          throw error;
        }

      } finally {
        window.clearTimeout(timeout);
      }

      if (attempt < 3) {
        await wait(
          attempt === 1
            ? 600
            : 1500
        );
      }
    }

    throw (
      lastError ||
      new Error(
        'Не удалось сохранить результат теста в CRM.'
      )
    );
  };

  const buildMirrorPayload = (
    googlePayload
  ) => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const scoreMatch =
      String(
        googlePayload.score || ''
      ).match(/^(\d+)/);

    const contact =
      String(
        googlePayload.contact || ''
      ).trim();

    return {
      request_id:
        createRequestId(),

      source: 'test',

      form_name:
        'level-test',

      name:
        googlePayload.name || '',

      contact,

      phone:
        inferPhone(contact),

      email:
        googlePayload.email || '',

      goal:
        googlePayload.goal ||
        'Определение уровня',

      test_score:
        scoreMatch
          ? Number(scoreMatch[1])
          : null,

      test_level:
        googlePayload.level || '',

      landing_url:
        window.location.href,

      referrer:
        document.referrer || '',

      utm_source:
        params.get('utm_source') || '',

      utm_medium:
        params.get('utm_medium') || '',

      utm_campaign:
        params.get('utm_campaign') || '',

      utm_content:
        params.get('utm_content') || '',

      utm_term:
        params.get('utm_term') || '',

      consent_given:
        document
          .getElementById(
            'personalConsent'
          )
          ?.checked === true,

      consent_version:
        '2026-09-04',

      website: '',

      original_payload:
        googlePayload
    };
  };

  window.fetch = function (
    input,
    init
  ) {
    const url =
      getUrl(input);

    const method =
      getMethod(input, init);

    /*
     * Остальные запросы сайта
     * не трогаем.
     */
    if (
      url !== GOOGLE_ENDPOINT ||
      method !== 'POST'
    ) {
      return nativeFetch(
        input,
        init
      );
    }

    const googlePayload =
      parseJsonBody(init?.body);

    /*
     * Если это неожиданно не тот формат,
     * не ломаем существующий запрос.
     */
    if (!googlePayload) {
      return nativeFetch(
        input,
        init
      );
    }

    /*
     * 1. MySQL — обязательная запись.
     * 2. До трёх попыток с одним request_id.
     * 3. После подтверждения — Google.
     */
    return (async () => {
      const mirrorPayload =
        buildMirrorPayload(
          googlePayload
        );

      await saveLeadToMysql(
        mirrorPayload
      );

      return nativeFetch(
        input,
        init
      );
    })();
  };
})();
