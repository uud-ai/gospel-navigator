import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { TOPICS } from './topics.js';

const APP_URL = '/app/';
const EASE = [0.22, 1, 0.36, 1];

// Стихи из синодального перевода (те же, что в «стихе дня» приложения).
const HERO_VERSES = [
  'Так да светит свет ваш пред людьми, чтобы они видели ваши добрые дела',
  'Просите, и дано будет вам; ищите, и найдёте; стучите, и отворят вам',
  'Придите ко Мне, все труждающиеся и обременённые, и Я успокою вас',
  'Ищите же прежде Царства Божия и правды Его, и это всё приложится вам',
  'Любите врагов ваших, благословляйте проклинающих вас',
  'Ибо где сокровище ваше, там будет и сердце ваше',
];

const FACTS = [
  { value: '27', label: 'книг Нового Завета' },
  { value: '7 955', label: 'стихов синодального перевода' },
  { value: '3 734', label: 'фрагмента толкований блж. Феофилакта' },
  { value: '14', label: 'тем из повседневной жизни' },
];

const STEPS = [
  {
    title: 'Выберите тему или спросите свободно',
    text: 'Работа, семья, прощение, тревога — или любой свой вопрос о Евангелии.',
  },
  {
    title: 'Находим близкие места текста',
    text: 'Поиск по смыслу подбирает стихи Нового Завета и толкования, которые относятся к вопросу.',
  },
  {
    title: 'Ответ с опорой на источник',
    text: 'Собеседник отвечает спокойно и по тексту, а стихи в ответе можно открыть и прочитать целиком.',
  },
];

function Reveal({ children, delay = 0, className }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

function Header() {
  return (
    <header className="header">
      <a className="brand" href="#top" aria-label="Благовест — наверх">
        <span className="brand-mark" aria-hidden="true">✝</span>
        Благовест
      </a>
      <nav className="nav" aria-label="Разделы">
        <a href="#how">Как это работает</a>
        <a href="#topics">Темы</a>
        <a href="#sources">Источники</a>
      </nav>
      <a className="btn btn-small" href={APP_URL}>Открыть</a>
    </header>
  );
}

// Фирменный эффект: «свет лампады» следует за курсором (или пальцем)
// и проявляет золотом строки Евангелия, скрытые в тёмном фоне.
function Hero() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    let frame = null;
    let x = 0;
    let y = 0;
    const apply = () => {
      frame = null;
      el.style.setProperty('--x', `${x}px`);
      el.style.setProperty('--y', `${y}px`);
    };
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      x = e.clientX - r.left;
      y = e.clientY - r.top;
      if (frame === null) frame = requestAnimationFrame(apply);
    };
    el.addEventListener('pointermove', onMove);
    return () => {
      el.removeEventListener('pointermove', onMove);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section className="hero" id="top" ref={ref}>
      <div className="lamp-text lamp-dim" aria-hidden="true">
        {HERO_VERSES.map((v) => <p key={v}>{v}</p>)}
      </div>
      <div className="lamp-text lamp-lit" aria-hidden="true">
        {HERO_VERSES.map((v) => <p key={v}>{v}</p>)}
      </div>
      <div className="hero-inner">
        <motion.p
          className="eyebrow"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          ИИ-собеседник по Новому Завету
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
        >
          Евангелие — в&nbsp;разговоре о&nbsp;вашей жизни
        </motion.h1>
        <motion.p
          className="lead"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: EASE }}
        >
          Ответы опираются на синодальный текст и толкования блаженного
          Феофилакта Болгарского.
        </motion.p>
        <motion.div
          className="hero-actions"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: EASE }}
        >
          <a className="btn" href={APP_URL}>Открыть Благовест</a>
          <a className="btn btn-ghost" href="#how">Как это работает</a>
        </motion.div>
      </div>
    </section>
  );
}

function Facts() {
  return (
    <section className="facts" aria-label="Состав приложения">
      <ul>
        {FACTS.map((f) => (
          <li key={f.label}>
            <strong>{f.value}</strong>
            <span>{f.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function How() {
  return (
    <section className="section" id="how">
      <Reveal>
        <h2>Как это работает</h2>
      </Reveal>
      <ol className="steps">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <Reveal delay={i * 0.1}>
              <span className="step-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Topics() {
  return (
    <section className="section section-tint" id="topics">
      <Reveal>
        <h2>Четырнадцать тем</h2>
        <p className="section-lead">
          Каждая тема — несколько стихов, краткое пояснение и возможность
          продолжить разговор.
        </p>
      </Reveal>
      <ul className="topic-grid">
        {TOPICS.map((t, i) => (
          <li key={t.id}>
            <Reveal delay={(i % 4) * 0.05}>
              <a className="topic" href={APP_URL}>
                <span className="topic-ref">{t.verse}</span>
                <h3>{t.title}</h3>
                <p>{t.intro}</p>
              </a>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Verse() {
  return (
    <section className="verse" aria-label="Стих из приложения">
      <Reveal>
        <blockquote>
          <p>Придите ко Мне, все труждающиеся и обременённые, и Я успокою вас.</p>
          <footer>Мф 11:28</footer>
        </blockquote>
        <p className="verse-note">
          Каждый день приложение показывает один стих и предлагает обсудить,
          что он значит.
        </p>
      </Reveal>
    </section>
  );
}

function Sources() {
  return (
    <section className="section" id="sources">
      <Reveal>
        <h2>Источники и границы</h2>
      </Reveal>
      <div className="two-col">
        <Reveal>
          <h3>На чём основаны ответы</h3>
          <ul className="plain">
            <li>Новый Завет в синодальном переводе.</li>
            <li>
              «Толкование на Евангелие» блаженного Феофилакта Болгарского —
              текст с <a href="https://azbyka.ru" rel="noopener noreferrer">azbyka.ru</a>.
            </li>
            <li>Если уверенного совпадения в текстах нет, ассистент отвечает по общим знаниям.</li>
          </ul>
        </Reveal>
        <Reveal delay={0.1}>
          <h3>Чем приложение не является</h3>
          <p>
            Благовест — инструмент для изучения Писания. Он не заменяет беседу
            со священником и не даёт пастырских советов.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section className="cta">
      <Reveal>
        <h2>Начните с одного вопроса</h2>
        <a className="btn" href={APP_URL}>Открыть Благовест</a>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <span>© Благовест</span>
      <a href="https://github.com/uud-ai/gospel-navigator" rel="noopener noreferrer">Исходный код</a>
    </footer>
  );
}

export default function App() {
  return (
    <>
      <a className="skip" href="#how">К содержимому</a>
      <Header />
      <main>
        <Hero />
        <Facts />
        <How />
        <Topics />
        <Verse />
        <Sources />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
