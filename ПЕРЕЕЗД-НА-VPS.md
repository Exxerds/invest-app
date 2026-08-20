# Переезд с Vercel + Neon на собственный VPS + Reverse Proxy + DNS Mynymbox

Дата: 20.08.2026

---

## Почему сейчас ошибка 500

Вход/регистрация идут в PostgreSQL. База крутится на бесплатном Neon.
Когда бесплатный лимит исчерпан, Neon **замораживает базу (compute suspended)**
— каждый запрос к базе падает, и API отвечает 500. Данные при этом
**не удаляются**, они просто недоступны, пока база спит.

Цель: поднять PostgreSQL на своём VPS и забыть про лимиты навсегда.

---

## Итоговая схема

```
Браузер клиента
   │  https://oakhavenyield.com
   ▼
DNS: Mynymbox  (A-запись @ и www → IP РЕВЕРС-ПРОКСИ)
   ▼
Реверс-прокси  (отдельный сервер с nginx + бесплатный HTTPS от Let's Encrypt)
   │  http://IP_VPS:4000   ← единственный вход на бэкенд
   ▼
VPS PrivateAlps (скрыт от интернета):
   • Node.js приложение (сайт + API, порт 4000)
   • PostgreSQL на 127.0.0.1 (извне недоступен вообще)
```

**Главное правило:** в публичных DNS никогда не светим IP бэкенд-VPS —
только IP прокси. SSH на VPS вы и так делаете по IP напрямую, DNS тут
ни при чём.

## Что понадобится

| Компонент | Статус |
|---|---|
| VPS PrivateAlps (тариф VPS 30, достаточно с большим запасом) | есть |
| Отдельный реверс-прокси (второй дешёвый VPS или готовый сервис прокси) | нужен IP |
| Домен oakhavenyield.com + доступ к панели его регистратора | есть |
| Аккаунт Mynymbox (DNS-хостинг) | есть |
| Доступ к Neon Console и Vercel | есть |

Все команды ниже — для **Ubuntu 24.04** (выберите её как ОС при создании VPS,
если ещё не выбрали).

---

# ЭТАП 0. Спасаем данные из Neon

### 0.1. Разбудить базу

Зайдите в [console.neon.tech](https://console.neon.tech) → ваш проект.
Если видите баннер «compute suspended / quota exceeded», варианты:

1. **Временно включить платный план Launch (~$19/мес)** — база оживёт сразу.
   После выгрузки данных можно вернуться на Free или удалить проект.
2. **Дождаться 1-го числа следующего месяца** — лимит обнулится сам.
   (Сайт до тех пор лежит — долго.)
3. Написать в поддержку Neon и попросить включить compute на час для
   экспорта — иногда идут навстречу.

### 0.2. Взять строку подключения

Neon Console → ваш проект → **Connection Details** → скопируйте строку вида:

```
postgresql://USER:PASSWORD@ep-xxxx.eu-central-1.aws.neon.tech/dbname?sslmode=require
```

(Та же строка лежит в Vercel → Project → Settings → Environment Variables →
`DATABASE_URL`.)

### 0.3. Выгрузить данные в файл

Мы сделали скрипт, который выгружает **все таблицы в один JSON** и не зависит
от версий PostgreSQL (обычный pg_dump часто бьётся о несовпадение версий).
С вашего компьютера:

```bash
cd путь/к/invest-app/server
npm install   # если ещё не ставили зависимости сервера

DATABASE_URL='СЮДА_СТРОКУ_NEON' node scripts/export-json.js neon-backup.json
```

Вывод должен показать все таблицы и счётчики строк:

```
[export]   users            15 rows
[export]   trades           42 rows
...
```

Файл `neon-backup.json` — это ваша база целиком (включая KYC-сканы —
они хранятся в базе). **Храните его как пароль, не выкладывайте никуда.**

---

# ЭТАП 1. Настройка VPS (PrivateAlps, скрытый бэкенд)

Подключитесь по SSH (IP и root-пароль — в панели PrivateAlps):

```bash
ssh root@IP_VPS
```

### 1.1. Обновление системы и фаервол

```bash
apt update && apt -y upgrade
apt -y install ufw curl git build-essential postgresql postgresql-contrib

ufw allow OpenSSH
ufw enable          # ответьте "y"
ufw status          # должно быть: 22/tcp ALLOW
```

> Порт 4000 (приложение) откроем позже — и только для IP прокси (этап 3.5).

### 1.2. Отдельный пользователь для приложения

```bash
adduser oakhaven --disabled-password --gecos ""
mkdir -p /opt/oakhaven && chown oakhaven:oakhaven /opt/oakhaven
```

### 1.3. Node.js 22 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt -y install nodejs
node -v     # v22.x.x
```

### 1.4. PostgreSQL: база и пользователь

```bash
sudo -u postgres psql <<'SQL'
CREATE USER ohy WITH PASSWORD 'ПРИДУМАЙТЕ_ДЛИННЫЙ_ПАРОЛЬ';
CREATE DATABASE oakhaven OWNER ohy;
SQL
```

По умолчанию PostgreSQL слушает только `127.0.0.1` — снаружи его не видно.
Это то, что нужно, ничего менять не надо.

Проверка:

```bash
PGPASSWORD='ПАРОЛЬ' psql -h 127.0.0.1 -U ohy -d oakhaven -c 'SELECT 1;'
```

### 1.5. (Рекомендую) Swap-файл 2 ГБ — страховка на сборку и пики

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

# ЭТАП 2. Приложение на VPS

### 2.1. Залить код

Вариант A — из git (если репозиторий доступен с VPS):

```bash
sudo -u oakhaven git clone https://github.com/Exxerds/invest-app.git /opt/oakhaven
```

Вариант B — rsync с вашего компьютера (проще для приватного репо):

```bash
# из папки invest-app на вашем ПК:
rsync -az --exclude node_modules --exclude .git --exclude dist \
  ./ oakhaven@IP_VPS:/opt/oakhaven/
# пароль пользователя oakhaven не задан → либо задайте: passwd oakhaven,
# либо добавьте свой SSH-ключ в /home/oakhaven/.ssh/authorized_keys
```

### 2.2. Установка зависимостей и сборка

```bash
cd /opt/oakhaven
sudo -u oakhaven npm ci            # ставит и сайт, и сервер (postinstall)
sudo -u oakhaven npm run build     # собирает сайт в /opt/oakhaven/dist
```

### 2.3. Настройки: /opt/oakhaven/server/.env

```bash
sudo -u oakhaven cp /opt/oakhaven/server/.env.example /opt/oakhaven/server/.env
sudo -u oakhaven nano /opt/oakhaven/server/.env
```

Заполните (шаблон лежит в `server/.env.example`):

```env
NODE_ENV=production
PORT=4000

# сгенерируйте:  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=ВАШ_СЛУЧАЙНЫЙ_КЛЮЧ_96_СИМВОЛОВ

SITE_URL=https://oakhavenyield.com
CORS_ORIGIN=

# База — локальная, TLS выключен:
DATABASE_URL=postgresql://ohy:ПАРОЛЬ_ИЗ_1.4@127.0.0.1:5432/oakhaven
PGSSL=off

# Первый запуск: on (создаст демо-админа). После смены паролей → off!
SEED_DEMO=on

# SMTP — как сейчас на Vercel (Brevo и т.п.):
SMTP_HOST=…
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=…
SMTP_PASS=…
SMTP_FROM=Oak Haven Yield <no-reply@oakhavenyield.com>
```

### 2.4. Залить данные из Neon

```bash
# скопируйте файл на VPS (с вашего ПК):
scp server/neon-backup.json oakhaven@IP_VPS:/home/oakhaven/

# на VPS:
cd /opt/oakhaven/server
sudo -u oakhaven env \
  DATABASE_URL='postgresql://ohy:ПАРОЛЬ@127.0.0.1:5432/oakhaven' PGSSL=off \
  node scripts/import-json.js /home/oakhaven/neon-backup.json
```

### 2.5. Автозапуск через systemd

```bash
sudo cp /opt/oakhaven/deploy/oakhaven.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now oakhaven
sudo journalctl -u oakhaven -f        # логи в реальном времени
```

В логах должно быть: `🚀 Oak Haven Yield API server running` и
`Serving the built site from /dist`.

Проверка прямо на VPS:

```bash
curl http://127.0.0.1:4000/api/health     # {"ok":true}
curl -I http://127.0.0.1:4000/            # 200 OK, HTML сайта
```

**Бэкенд готов.** Пока DNS не переключён, мир о нём не знает.

---

# ЭТАП 3. Реверс-прокси (публичная машина)

Это отдельный сервер (второй VPS или готовая услуга прокси).
Ниже — вариант «свой VPS с nginx»: полный контроль и дёшево.

### 3.1. Базовая настройка прокси

```bash
ssh root@IP_ПРОКСИ
apt update && apt -y upgrade
apt -y install nginx certbot python3-certbot-nginx ufw
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

### 3.2. Конфиг сайта

Файл `deploy/nginx-proxy.conf` уже в этом репозитории.

1. Откройте его, замените `BACKEND_VPS_IP` на IP вашего PrivateAlps VPS.
2. Залейте на прокси и включите:

```bash
sudo cp nginx-proxy.conf /etc/nginx/sites-available/oakhaven
sudo ln -s /etc/nginx/sites-available/oakhaven /etc/nginx/sites-enabled/oakhaven
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### 3.3. Проверка цепочки ДО переключения DNS

С вашего компьютера временно «подмените» домен (файл hosts):

```
# Windows: C:\Windows\System32\drivers\etc\hosts
# macOS/Linux: /etc/hosts
IP_ПРОКСИ  oakhavenyield.com www.oakhavenyield.com
```

Откройте `http://oakhavenyield.com` — сайт должен открыться с прокси
(HTTPS пока будет ошибка сертификата — это нормально до этапа 4.3).
Попробуйте войти. **Работает — идём дальше.**
После проверки удалите строчки из hosts.

### 3.4. HTTPS-сертификат — выдадим после переключения DNS (шаг 4.3)

Let's Encrypt проверяет домен через DNS, поэтому сначала DNS, потом certbot.

### 3.5. Закрыть бэкенд ото всех, кроме прокси

На **VPS PrivateAlps**:

```bash
ufw allow from IP_ПРОКСИ to any port 4000 proto tcp
ufw status
# должно быть: 22 ALLOW Anywhere; 4000 ALLOW IP_ПРОКСИ
```

С этого момента порт 4000 снаружи доступен только прокси.
Проверка: `curl http://IP_VPS:4000/api/health` с вашего ПК → таймаут. 👍

---

# ЭТАП 4. DNS через Mynymbox

### 4.1. Создать зону

mynymbox.io → **Domains → DNS Management** → добавьте `oakhavenyield.com`.

### 4.2. Записи в зоне

| Тип | Имя | Значение | TTL |
|---|---|---|---|
| A | `@` | **IP_ПРОКСИ** | 300 |
| A | `www` | **IP_ПРОКСИ** | 300 |

⚠️ **Обязательно перенесите остальные записи из текущей DNS-зоны**
(сейчас она у регистратора/Vercel) — иначе сломается почта домена:

* `TXT` записи Brevo/SPF/DKIM (начинаются с `v=spf1`, `v=DKIM1`),
* `MX` (если есть почта на домене),
* любые `TXT` верификации (Vercel, Google и т.п.).

Проще всего: открыть старую зону и новую в двух вкладках и перенести всё,
кроме старых A/CNAME на Vercel (их заменяют новые A-записи на прокси).

### 4.3. Переключить NS у регистратора

В панели Mynymbox показаны их NS-серверы (вида `ns1.mynymbox.io`,
`ns2.mynymbox.io` — смотрите точные в панели).
В панели **регистратора домена** замените текущие NS на NS Mynymbox,
сохраните. Распространение: от 5 минут до суток.

Проверка распространения (с ПК):

```bash
nslookup -type=NS oakhavenyield.com     # должны быть NS Mynymbox
nslookup oakhavenyield.com              # должен ответить IP_ПРОКСИ
```

### 4.4. HTTPS-сертификат на прокси

Когда `nslookup` показывает IP прокси:

```bash
# на прокси-сервере:
sudo certbot --nginx -d oakhavenyield.com -d www.oakhavenyield.com
```

Certbot сам выпустит сертификат, впишет его в конфиг и настроит
автопродление. Откройте https://oakhavenyield.com — замок, сайт,
работающий вход. 🎉

---

# ЭТАП 5. Финальные проверки и безопасность

### Чеклист

- [ ] `https://oakhavenyield.com/api/health` → `{"ok":true}`
- [ ] Регистрация нового аккаунта → письмо приходит → ссылка подтверждения работает
- [ ] Вход в личный кабинет — **никакой 500**
- [ ] Вход в CRM под админом
- [ ] Загрузка KYC-документа (это самый тяжёлый запрос — 12 МБ лимит в nginx)
- [ ] Старые клиенты из Neon на месте, их сделки/балансы видны

### ОБЯЗАТЕЛЬНО: демо-пароли

При первом старте создаются демо-пользователи с **публично известными паролями**
(они прямо в репозитории): `admin@trade.io / admin123`,
`manager@trade.io / manager123`, `client@trade.io / client123`.

1. Войдите в CRM под `admin@trade.io / admin123`.
2. В списке пользователей смените пароли **всех трёх** демо-аккаунтов
   (или удалите manager/client и создайте своих).
3. В `/opt/oakhaven/server/.env` поставьте `SEED_DEMO=off` и:

```bash
sudo systemctl restart oakhaven
```

### Бэкапы (обязательно — теперь база ваша, не Neon's)

```bash
# на VPS:
sudo sed -i "s/REPLACE_ME/ПАРОЛЬ_БАЗЫ/" /opt/oakhaven/deploy/backup.sh
sudo chmod +x /opt/oakhaven/deploy/backup.sh
sudo crontab -e
# добавить строку:
17 3 * * *  /opt/oakhaven/deploy/backup.sh >> /opt/oakhaven-backups/backup.log 2>&1
```

Каждую ночь — дамп базы, хранятся 14 дней в `/opt/oakhaven-backups`.
Раз в неделю забирайте копию на свой ПК (`rsync`, команда в конце backup.sh).

### Мониторинг

Бесплатный [UptimeRobot](https://uptimerobot.com): монитор типа HTTPS на
`https://oakhavenyield.com/api/health`, интервал 5 минут — письмо, если упало.

### Уборка за собой (когда неделю всё стабильно)

- Vercel: Project → Settings → Delete Project (старый домен уже не у него).
- Neon: Project → Settings → Delete (только убедившись, что
  `neon-backup.json` лежит у вас в надёжном месте).

---

# Диагностика: если что-то не так

| Симптом | Где смотреть |
|---|---|
| 502 Bad Gateway на сайте | Бэкенд упал или фаервол: `systemctl status oakhaven` на VPS, `ufw status` |
| 500 при входе | `journalctl -u oakhaven -n 100` — обычно `DATABASE_URL`/`PGSSL` |
| `password authentication failed` | Пароль в DATABASE_URL ≠ пароль `ohy` из шага 1.4 |
| KYC-файл не грузится (413) | В nginx на прокси должен быть `client_max_body_size 12m;` |
| Сертификат не выдаётся | DNS ещё не переключился: `nslookup oakhavenyield.com` |
| Письма не приходят | SMTP в `.env`; также TXT-записи Brevo перенесены в Mynymbox? |
| Посмотреть все логи API | `/opt/oakhaven/server/server.log` на VPS |

Команды-спасалки на VPS:

```bash
sudo systemctl restart oakhaven          # перезапуск приложения
sudo journalctl -u oakhaven -f           # живые логи приложения
PGPASSWORD='ПАРОЛЬ' psql -h 127.0.0.1 -U ohy -d oakhaven \
  -c 'SELECT count(*) FROM users;'       # база жива и с данными?
```

---

## Файлы этого репозитория для переезда

| Файл | Куда ставить |
|---|---|
| `server/scripts/export-json.js` | выгрузка Neon → JSON (с любого ПК) |
| `server/scripts/import-json.js` | загрузка JSON → PostgreSQL на VPS |
| `deploy/oakhaven.service` | `/etc/systemd/system/` на VPS |
| `deploy/nginx-proxy.conf` | `/etc/nginx/sites-available/` на прокси |
| `deploy/backup.sh` | `crontab` на VPS |
| `server/.env.example` | шаблон для `server/.env` |
