export function Light() {
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
              stroke="white"
              strokeWidth="2.5"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-gray-900">
            Rentrail
          </span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-gray-500">
          <a href="#" className="hover:text-gray-900 transition-colors">
            Возможности
          </a>
          <a href="#" className="hover:text-gray-900 transition-colors">
            Тарифы
          </a>
          <a href="#" className="hover:text-gray-900 transition-colors">
            О нас
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
          <p className="text-lg text-gray-500 max-w-xl mx-auto mb-10">
            Rentrail объединяет управление флотом, CRM, онлайн-оплату и
            мобильное приложение для сотрудников в одной платформе.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/platform-admin/"
              className="bg-gray-900 hover:bg-gray-700 text-white font-bold px-8 py-4 rounded-xl text-base transition-colors shadow-lg shadow-gray-900/10"
            >
              Войти в кабинет →
            </a>
            <a
              href="#features"
              className="text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors"
            >
              Узнать подробнее ↓
            </a>
          </div>
        </div>
      </section>

      {/* Logos / Trust */}
      <section className="px-8 py-10 border-y border-gray-100 bg-gray-50">
        <p className="text-center text-xs text-gray-400 uppercase tracking-widest mb-6">
          Поддерживаемые платёжные системы
        </p>
        <div className="flex items-center justify-center gap-10 flex-wrap">
          {["ЮKassa", "Тинькофф", "CloudPayments"].map((p) => (
            <span key={p} className="text-sm font-semibold text-gray-400">
              {p}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-8 py-24">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3 text-gray-900">
            Всё что нужно для прокатного бизнеса
          </h2>
          <p className="text-center text-gray-400 mb-14 text-sm">
            Запустите прокат велосипедов, самокатов или электробайков за
            несколько минут
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: "🛴",
                title: "Управление флотом",
                desc: "Учёт техники, статусы, сервис и история обслуживания.",
              },
              {
                icon: "📱",
                title: "Staff App",
                desc: "Мобильное приложение для механиков и операторов.",
              },
              {
                icon: "💳",
                title: "Онлайн-оплата",
                desc: "ЮKassa, Тинькофф, CloudPayments. Депозиты и возвраты.",
              },
              {
                icon: "📍",
                title: "GPS и карта",
                desc: "Реальное время, геозоны, ограничения скорости.",
              },
              {
                icon: "👥",
                title: "CRM клиентов",
                desc: "База, история аренд, блэклист, уведомления.",
              },
              {
                icon: "📊",
                title: "Аналитика",
                desc: "Доходы, загрузка флота и популярные маршруты.",
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

      {/* CTA */}
      <section className="px-8 pb-24">
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
