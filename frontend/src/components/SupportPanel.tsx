import React, { useEffect, useState } from 'react';
import apiService, { getAxiosErrorMessage } from '../services/api';
import s from './SupportPanel.module.css';

type PageSlug = 'faq' | 'terms' | 'privacy';

export const SupportPanel: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [text, setText] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [pageSlug, setPageSlug] = useState<PageSlug>('faq');
  const [page, setPage] = useState<any>(null);

  const loadPage = async (slug: PageSlug) => {
    try {
      const p = await apiService.getSupportPage(slug);
      setPage(p);
    } catch (e) {
      setError(getAxiosErrorMessage(e));
    }
  };

  useEffect(() => {
    loadPage(pageSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSlug]);

  const send = async () => {
    setNotice('');
    setError('');
    try {
      await apiService.sendSupportFeedback({ topic, text });
      setNotice('Sent to support');
      setTopic('');
      setText('');
    } catch (e) {
      setError(getAxiosErrorMessage(e));
    }
  };

  return (
    <div className={s.root}>
      <div className={s.card}>
        <div className={s.title}>Feedback</div>
        {notice ? <div className={s.notice}>{notice}</div> : null}
        {error ? <div className={s.error}>{error}</div> : null}
        <div className={s.field}>
          <div className={s.label}>Topic</div>
          <input className={s.input} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic..." />
        </div>
        <div className={s.field}>
          <div className={s.label}>Message</div>
          <textarea className={s.textarea} value={text} onChange={(e) => setText(e.target.value)} placeholder="Text..." />
        </div>
        <button className={s.button} onClick={send} disabled={topic.trim().length < 2 || text.trim().length < 5}>
          Send
        </button>
      </div>

      <div className={s.card}>
        <div className={s.title}>Info</div>
        <div className={s.tabs}>
          {(['faq', 'terms', 'privacy'] as PageSlug[]).map((slug) => (
            <button
              key={slug}
              className={[s.tab, slug === pageSlug ? s.tabActive : ''].filter(Boolean).join(' ')}
              onClick={() => setPageSlug(slug)}
            >
              {slug.toUpperCase()}
            </button>
          ))}
        </div>
        {page ? (
          <div className={s.page}>
            <div className={s.pageTitle}>{page.title}</div>
            {Array.isArray(page.content) ? (
              <div className={s.faq}>
                {page.content.map((item: any, idx: number) => (
                  <div key={idx} className={s.faqItem}>
                    <div className={s.faqQ}>{item.q}</div>
                    <div className={s.faqA}>{item.a}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={s.pageText}>{String(page.content || '')}</div>
            )}
          </div>
        ) : (
          <div className={s.pageText}>Loading…</div>
        )}
      </div>
    </div>
  );
};

