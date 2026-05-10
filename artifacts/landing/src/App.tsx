import { useState } from "react";

const SCREENS = [
  {
    id: "client",
    label: "Клиентское приложение",
    emoji: "🛴",
    img: "/screenshots/client-transport.png",
    title: "Аренда за 10 секунд",
    desc: "Клиент открывает приложение, видит доступный транспорт рядом, нажимает «Арендовать» — и едет. Список с зарядом батареи, локацией и типом техники.",
    points: [
      "Велосипеды, ebike, самокаты, escooter",
      "Заряд батареи в реальном времени",
      "История поездок и профиль",
    ],
  },
  {
    id: "staff",
    label: "Приложение персонала",
    emoji: "🔧",
    img: "/screenshots/staff-operations.png",
    title: "Всё для оператора и механика",
    desc: "Сканирование актива, создание наряда на ремонт, сообщение об инциденте — всё в одном приложении. Работает офлайн с синхронизацией.",
    points: [
      "Сканирование QR-кода актива",
      "Наряды на ТО и ремонт",
      "Офлайн-режим с очередью синхронизации",
    ],
  },
  {
    id: "admin",
    label: "Веб-кабинет",
    emoji: "🖥",
    img: "/screenshots/admin-company.png",
    title: "Полный контроль для администратора",
    desc: "Веб-кабинет показывает здоровье компании: статусы флота, активные аренды, инциденты и финансы — в одном окне.",
    points: [
      "Диагностика и здоровье компании",
      "Управление флотом и клиентами",
      "Биллинг, подписки, белая метка",
    ],
  },
];

const WHO = [
  {
    icon: "🏢",
    title: "Прокатные компании",
    desc: "Управляйте несколькими филиалами, флотом и командой из единого кабинета. Гибкие роли доступа для владельца, администратора и оператора.",
  },
  {
    icon: "🔧",
    title: "Сервисные механики",
    desc: "Мобильное приложение с нарядами, историей обслуживания, QR-сканером и статусами «Моей смены». Работает без интернета.",
  },
  {
    icon: "👤",
    title: "Клиенты и курьеры",
    desc: "Отдельный клиентский режим: транспорт рядом, аренда одной кнопкой, история поездок и профиль.",
  },
];

export default function App() {
  const [activeScreen, setActiveScreen] = useState("client");
  const active = SCREENS.find((s) => s.id === activeScreen) ?? SCREENS[0];

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1C1917"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="10" />
              <ellipse cx="12" cy="12" rx="4" ry="10" />
              <line x1="2" y1="9" x2="22" y2="9" />
              <line x1="2" y1="15" x2="22" y2="15" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-gray-900">
            Rentrail
          </span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-gray-500">
          <a href="#features" className="hover:text-gray-900 transition-colors">
            Возможности
          </a>
          <a href="#screens" className="hover:text-gray-900 transition-colors">
            Интерфейс
          </a>
          <a href="#payments" className="hover:text-gray-900 transition-colors">
            Оплата
          </a>
          <a href="#contact" className="hover:text-gray-900 transition-colors">
            Контакты
          </a>
        </div>
        <a
          href="/platform-admin/"
          className="bg-gray-900 hover:bg-gray-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
        >
          Войти в кабинет
        </a>
      </nav>

      {/* Hero */}
      <section className="px-8 pt-20 pb-28 text-center bg-gradient-to-b from-amber-50/60 to-white">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
            🛴 Платформа для проката электротранспорта
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight text-gray-900 mb-6">
            Прокатный бизнес
            <br />
            <span className="text-amber-500">на новом уровне</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto mb-10 leading-relaxed">
            Rentrail объединяет управление флотом, CRM, онлайн-оплату и
            мобильное приложение для персонала в одной платформе.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/platform-admin/"
              className="bg-gray-900 hover:bg-gray-700 text-white font-bold px-8 py-4 rounded-xl text-base transition-colors shadow-lg shadow-gray-900/10"
            >
              Войти в кабинет →
            </a>
            <a
              href="#screens"
              className="text-gray-400 hover:text-gray-700 text-sm font-medium transition-colors"
            >
              Посмотреть интерфейс ↓
            </a>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section
        id="payments"
        className="px-8 py-10 border-y border-gray-100 bg-gray-50"
      >
        <p className="text-center text-xs text-gray-400 uppercase tracking-widest mb-6">
          Поддерживаемые платёжные системы
        </p>
        <div className="flex items-center justify-center gap-12 flex-wrap">
          {["ЮKassa", "Тинькофф", "CloudPayments"].map((p) => (
            <span
              key={p}
              className="text-sm font-bold text-gray-400 tracking-wide"
            >
              {p}
            </span>
          ))}
        </div>
      </section>

      {/* Product screenshots section */}
      <section id="screens" className="px-8 py-24 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3 text-gray-900">
            Интерфейс платформы
          </h2>
          <p className="text-center text-gray-400 mb-10 text-sm">
            Три приложения — для клиентов, персонала и администраторов
          </p>

          {/* Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {SCREENS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveScreen(s.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
                  activeScreen === s.id
                    ? "bg-gray-900 text-white shadow-md"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                <span>{s.emoji}</span>
                {s.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Phone mockup */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-64 h-[520px] bg-gray-900 rounded-[40px] p-3 shadow-2xl shadow-gray-900/30 ring-4 ring-gray-800">
                  <div className="w-full h-full rounded-[30px] overflow-hidden bg-gray-100">
                    <img
                      key={active.img}
                      src={active.img}
                      alt={active.title}
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                </div>
                {/* Notch */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-5 bg-gray-900 rounded-full" />
              </div>
            </div>

            {/* Description */}
            <div>
              <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
                {active.emoji} {active.label}
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {active.title}
              </h3>
              <p className="text-gray-500 leading-relaxed mb-6">
                {active.desc}
              </p>
              <ul className="space-y-3">
                {active.points.map((p) => (
                  <li key={p} className="flex items-start gap-3">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0">
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path
                          d="M1 4L3.5 6.5L9 1"
                          stroke="#1C1917"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span className="text-sm text-gray-700">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Who is it for */}
      <section className="px-8 py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3 text-gray-900">
            Для кого
          </h2>
          <p className="text-center text-gray-400 mb-14 text-sm">
            Система охватывает всех участников прокатного бизнеса
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {WHO.map((w) => (
              <div
                key={w.title}
                className="bg-white rounded-2xl p-7 border border-gray-200 hover:border-amber-300 hover:shadow-md transition-all"
              >
                <div className="text-4xl mb-4">{w.icon}</div>
                <div className="font-bold text-gray-900 mb-2">{w.title}</div>
                <div className="text-sm text-gray-500 leading-relaxed">
                  {w.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-8 py-24 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3 text-gray-900">
            Всё что нужно для прокатного бизнеса
          </h2>
          <p className="text-center text-gray-400 mb-14 text-sm">
            От велосипедов до электросамокатов — один инструмент для всего
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: "🛴",
                title: "Управление флотом",
                desc: "Учёт каждой единицы техники, статусы, история сервиса, ТО и обслуживания.",
              },
              {
                icon: "📱",
                title: "Staff App",
                desc: "Мобильное приложение для механиков и операторов. Наряды, смены, карта, офлайн.",
              },
              {
                icon: "💳",
                title: "Онлайн-оплата",
                desc: "ЮKassa, Тинькофф, CloudPayments. Депозиты, возвраты, удержания.",
              },
              {
                icon: "📍",
                title: "GPS и карта",
                desc: "Реальное время на карте. Геозоны и автоматические ограничения скорости.",
              },
              {
                icon: "👥",
                title: "CRM клиентов",
                desc: "База, история аренд, глобальный блэклист, рейтинг, push-уведомления.",
              },
              {
                icon: "🔐",
                title: "Роли и доступ",
                desc: "Owner, Admin, Manager, Operator, Mechanic — гибкая система прав.",
              },
              {
                icon: "📊",
                title: "Аналитика",
                desc: "Доходы, загрузка флота, популярные маршруты и KPI сотрудников.",
              },
              {
                icon: "🏷",
                title: "Белая метка",
                desc: "Свой бренд, логотип и цвета. Каждая компания получает уникальный облик.",
              },
              {
                icon: "📡",
                title: "IoT-интеграция",
                desc: "Teltonika GPS, CODEC 8/12, удалённые команды и телеметрия устройств.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-md hover:border-amber-200 transition-all"
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <div className="font-semibold mb-2 text-gray-900">
                  {f.title}
                </div>
                <div className="text-sm text-gray-500 leading-relaxed">
                  {f.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-8 py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3 text-gray-900">
            Как работает система
          </h2>
          <p className="text-gray-400 text-center mb-14 text-sm">
            Полный жизненный цикл аренды — от бронирования до возврата
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                step: "1",
                title: "Клиент выбирает транспорт",
                desc: "Открывает приложение, видит доступные велосипеды и самокаты рядом с зарядом батареи и локацией.",
                color: "bg-amber-400",
              },
              {
                step: "2",
                title: "Оператор открывает аренду",
                desc: "Сканирует QR-код актива в Staff App или выбирает в веб-кабинете. Система принимает депозит.",
                color: "bg-amber-400",
              },
              {
                step: "3",
                title: "Аренда идёт",
                desc: "GPS отслеживает местоположение, геозоны автоматически ограничивают скорость при выезде за зону.",
                color: "bg-amber-400",
              },
              {
                step: "4",
                title: "Возврат и оплата",
                desc: "Клиент возвращает транспорт, система списывает сумму за время аренды, возвращает депозит.",
                color: "bg-amber-400",
              },
              {
                step: "5",
                title: "Техническое обслуживание",
                desc: "Механик получает наряд на ТО, закрывает задачу в приложении. Статус актива автоматически обновляется.",
                color: "bg-amber-400",
              },
              {
                step: "6",
                title: "Аналитика и контроль",
                desc: "Администратор видит доходы, загрузку флота и KPI команды. Биллинг и подписки управляются через платформу.",
                color: "bg-amber-400",
              },
            ].map((s) => (
              <div
                key={s.step}
                className="flex items-start gap-4 bg-white rounded-2xl p-5 border border-gray-200"
              >
                <div
                  className={`w-10 h-10 rounded-full ${s.color} text-gray-900 font-extrabold text-base flex items-center justify-center flex-shrink-0 shadow-sm`}
                >
                  {s.step}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 mb-1">
                    {s.title}
                  </div>
                  <div className="text-sm text-gray-500 leading-relaxed">
                    {s.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contact" className="px-8 py-24 bg-white">
        <div className="max-w-2xl mx-auto bg-gray-900 rounded-3xl p-12 text-center">
          <h2 className="text-3xl font-extrabold text-white mb-3">
            Готовы запустить прокат?
          </h2>
          <p className="text-white/50 mb-8 text-sm">
            Войдите в кабинет и начните управлять бизнесом прямо сейчас
          </p>
          <a
            href="/platform-admin/"
            className="inline-block bg-amber-400 hover:bg-amber-300 text-gray-900 font-bold px-8 py-4 rounded-xl text-base transition-colors"
          >
            Войти в кабинет →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-8 py-8 text-center text-gray-400 text-sm">
        © 2026 Rentrail. Все права защищены.
      </footer>
    </div>
  );
}
