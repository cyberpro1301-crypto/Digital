import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { ChevronDown } from 'lucide-react';

export default function FAQ() {
  const { t } = useApp();
  const [open, setOpen] = useState<number | null>(0);

  const questions = [
    { q: t('faq1q'), a: t('faq1a') },
    { q: t('faq2q'), a: t('faq2a') },
    { q: t('faq3q'), a: t('faq3a') },
    { q: t('faq4q'), a: t('faq4a') },
    { q: t('faq5q'), a: t('faq5a') },
    { q: t('faq6q'), a: t('faq6a') },
    { q: t('faq7q'), a: t('faq7a') },
    { q: t('faq8q'), a: t('faq8a') },
  ];

  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h2 className="mb-8 text-center text-3xl font-bold text-white">{t('faqTitle')}</h2>
      <div className="space-y-3">
        {questions.map((item, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
          >
            <button
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/5"
            >
              <span className="font-medium text-white">{item.q}</span>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-white/40 transition-transform ${open === i ? 'rotate-180' : ''}`}
              />
            </button>
            <div
              className={`grid transition-all duration-300 ${open === i ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-4 text-sm leading-relaxed text-white/60">{item.a}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
