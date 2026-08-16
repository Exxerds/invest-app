# ============================================================
#  Настройки сервера (скопируйте в .env и заполните)
# ============================================================

# Порт API-сервера
PORT=4000

# Секрет для JWT-токенов (обязательно поменяйте!)
JWT_SECRET=change-me-to-long-random-string

# Адрес сайта (для ссылок в письмах)
SITE_URL=http://localhost:3000

# --- SMTP для писем (регистрация, сброс пароля) ---
# Если SMTP не заполнен — письма сохраняются в server/mails/ и в консоль
SMTP_HOST=
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASS=
SMTP_FROM=Trade Nation <no-reply@yourdomain.com>
