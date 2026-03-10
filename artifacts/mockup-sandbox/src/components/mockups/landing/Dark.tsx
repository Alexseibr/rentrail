export function Dark() {
  return (
    <div className="min-h-screen bg-[#111318] text-white font-sans">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#111318"
              strokeWidth="2.5"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight">Rentrail</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-white/60">
          <a href="#" className="hover:text-white transition-colors">
            Возможности
          </a>
          <a href="#" className="hover:text-white transition-colors">
            Тарифы
          </a>
          <a href="#" className="hover:text-white transition-colors">
            О нас
          </a>
        </div>
        <a
          href="/platform-admin/"
          className="bg-amber-400 hover:bg-amber-300 text-[#111318] font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
        >
          Войти в кабинет
        </a>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-8 pt-24 pb-32 text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-400/5 to-transparent pointer-events-none" />
        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-medium px-4 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            SaaS-платформа для аренды электротранспорта
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-6">
            Управляйте прокатом
            <br />
            <span className="text-amber-400">умнее и быстрее</span>
          </h1>
          <p className="text-lg text-white/60 max-w-xl mx-auto mb-10">
            Rentrail — всё что нужно для прокатного бизнеса: флот, аренды,
            клиенты, оплата и аналитика в одном месте.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/platform-admin/"
              className="bg-amber-400 hover:bg-amber-300 text-[#111318] font-bold px-8 py-4 rounded-xl text-base transition-colors shadow-lg shadow-amber-400/20"
            >
              Войти в кабинет →
            </a>
            <a
              href="#features"
              className="text-white/60 hover:text-white text-sm font-medium transition-colors"
            >
              Узнать подробнее ↓
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-8 pb-20">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-px bg-white/10 rounded-2xl overflow-hidden">
          {[
            { value: "5 мин", label: "до запуска" },
            { value: "100%", label: "всё в одном месте" },
            { value: "24/7", label: "поддержка" },
          ].map((s) => (
            <div key={s.label} className="bg-[#111318] px-8 py-8 text-center">
              <div className="text-3xl font-extrabold text-amber-400 mb-1">
                {s.value}
              </div>
              <div className="text-sm text-white/50">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-8 pb-24">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3">
            Всё для вашего бизнеса
          </h2>
          <p className="text-center text-white/50 mb-14 text-sm">
            От велосипедов до самокатов — один инструмент для всего
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: "🛴",
                title: "Управление флотом",
                desc: "Учёт всех единиц техники, статусы, сервис и история.",
              },
              {
                icon: "📱",
                title: "Мобильное приложение",
                desc: "Сотрудники работают со смартфона — заказы, смены, карта.",
              },
              {
                icon: "💳",
                title: "Онлайн-оплата",
                desc: "ЮKassa, Тинькофф, CloudPayments. Депозиты и возвраты.",
              },
              {
                icon: "📍",
                title: "GPS и геозоны",
                desc: "Реальное время на карте. Автоматические ограничения скорости.",
              },
              {
                icon: "👥",
                title: "CRM клиентов",
                desc: "База, история аренд, блэклист, уведомления.",
              },
              {
                icon: "📊",
                title: "Аналитика",
                desc: "Доходы, загрузка флота, популярные маршруты.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-amber-400/30 transition-colors"
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <div className="font-semibold mb-2">{f.title}</div>
                <div className="text-sm text-white/50 leading-relaxed">
                  {f.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-8 pb-24">
        <div className="max-w-2xl mx-auto bg-amber-400 rounded-3xl p-12 text-center">
          <h2 className="text-3xl font-extrabold text-[#111318] mb-3">
            Готовы начать?
          </h2>
          <p className="text-[#111318]/70 mb-8 text-sm">
            Зарегистрируйте компанию и запустите прокат уже сегодня
          </p>
          <a
            href="/platform-admin/"
            className="inline-block bg-[#111318] text-white font-bold px-8 py-4 rounded-xl text-base hover:bg-[#1e2230] transition-colors"
          >
            Войти в кабинет →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-8 py-8 text-center text-white/30 text-sm">
        © 2026 Rentrail. Все права защищены.
      </footer>
    </div>
  );
}
