(() => {
  const GOOGLE_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzY2NdD0aNaXXWVBtDG_dechUKi7ElmuB4QMtbafRkkQaAWbEA0Sq8mi1F5fQGvizCcaA/exec';
  const MIRROR_ENDPOINT = 'https://englishfactory.ru/api/lead.php';
  const nativeFetch = window.fetch.bind(window);

  const getUrl = (input) => {
    if (typeof input === 'string') return input;
    if (input && typeof input.url === 'string') return input.url;
    return '';
  };

  const getMethod = (input, init) => {
    if (init && init.method) return String(init.method).toUpperCase();
    if (input && typeof input.method === 'string') return input.method.toUpperCase();
    return 'GET';
  };

  const parseJsonBody = (body) => {
    if (typeof body !== 'string') return null;
    try {
      const parsed = JSON.parse(body);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
      return null;
    }
  };

  const inferPhone = (contactValue) => {
    const contact = String(contactValue || '').trim();
    return contact.replace(/\D/g, '').length >= 7 ? contact : '';
  };

  const mirrorLead = (googlePayload) => {
    try {
      const params = new URLSearchParams(window.location.search);
      const scoreMatch = String(googlePayload.score || '').match(/^(\d+)/);
      const contact = String(googlePayload.contact || '').trim();

      const mirrorPayload = {
        source: 'test',
        form_name: 'level-test',
        name: googlePayload.name || '',
        contact,
        phone: inferPhone(contact),
        email: googlePayload.email || '',
        goal: googlePayload.goal || 'Определение уровня',
        test_score: scoreMatch ? Number(scoreMatch[1]) : null,
        test_level: googlePayload.level || '',
        landing_url: window.location.href,
        referrer: document.referrer || '',
        utm_source: params.get('utm_source') || '',
        utm_medium: params.get('utm_medium') || '',
        utm_campaign: params.get('utm_campaign') || '',
        utm_content: params.get('utm_content') || '',
        utm_term: params.get('utm_term') || '',
        consent_given: document.getElementById('personalConsent')?.checked === true,
        consent_version: '2026-09-04',
        website: '',
        original_payload: googlePayload
      };

      nativeFetch(MIRROR_ENDPOINT, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(mirrorPayload),
        keepalive: true
      }).catch((error) => {
        console.warn('Не удалось сохранить копию результата теста в резервную БД:', error);
      });
    } catch (error) {
      console.warn('Не удалось подготовить копию результата теста для резервной БД:', error);
    }
  };

  window.fetch = function(input, init) {
    const url = getUrl(input);
    const method = getMethod(input, init);

    // Существующая отправка результата в Google остаётся без изменений.
    const originalRequest = nativeFetch(input, init);

    // Зеркалируем только рабочий POST формы результатов теста.
    if (url === GOOGLE_ENDPOINT && method === 'POST') {
      const payload = parseJsonBody(init?.body);
      if (payload) {
        mirrorLead(payload);
      }
    }

    return originalRequest;
  };
})();
