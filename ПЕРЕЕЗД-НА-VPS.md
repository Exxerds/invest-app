# Переезд с Vercel + Neon на собственный VPS + Reverse Proxy + DNS Mynymbox

Дата: 20.08.2026

---

## Почему сейчас ошибка 500

Вход/регистрация идут в PostgreSQL. База крутится на бесплатном Neon.
Когда бесплатный лимит исчерпан, Neon **замораживает базу (compute suspended)**
— каждый запрос к базе падает, и API отвечает 500. Данные при этом
**не удаляются**, они просто недоступны, пока база спит.

Цель: поднять PostgreSQL на своём VPS и забыть про лимиты навсегда.

> ⚡ **Наш случай — проще всех:** сайт ещё в разработке, в базе нет ничего
> ценного, поэтому экспорт данных (этап 0) и импорт (шаг 2.4) **пропускаем**.
> База на VPS создастся пустой сама при первом запуске, демо-аккаунты
> появятся автоматически. Vercel и Neon в конце просто удаляем (этап 5).

## Ресурсов VPS 30 (2 ядра / 3 ГБ / 30 ГБ) хватает с запасом

Приложение съест ~300 МБ RAM + столько же PostgreSQL; сборка фронта
до ~1.5 ГБ (swap из шага 1.5 — достаточная страховка). 30 ГБ диска —
годы работы, 3 ТБ трафика — далеко за пределами нужд лендинга + CRM.

---

## Итоговая схема (по ТЗ заказчика)

```
Браузер клиента
   │  https://oakhavenyield.com
   ▼
DNS: Mynymbox  (A-запись @ и www → IP прокси NJALLA)
   ▼
Реверс-прокси: Njalla VPS  (nginx + бесплатный HTTPS от Let's Encrypt)
   │  http://IP_PrivateAlps:4000   ← единственный вход на бэкенд
   ▼
Бэкенд: PrivateAlps VPS 30 (полностью скрыт от интернета):
   • Node.js приложение (сайт + API, порт 4000)
   • PostgreSQL на 127.0.0.1 (извне недоступен вообще)

ПОЗЖЕ (когда заказчик скажет): впереди встанет Cloudflare CDN
(этап 6) — DNS уйдёт к Cloudflare, цепочка станет
Cloudflare → Njalla → PrivateAlps. Бэкенд менять не придётся.
```

**Почему именно так:** Neon/Vercel — это общие сервера на AWS
(«заблокируют одного — лягут все»), мы от них уходим полностью.
Njalla и Mynymbox — приватные провайдеры (Njalla принимает крипту,
работает через Tor, юрисдикция Nevis). IP PrivateAlps не появится
ни в одной публичной записи.

**Главное правило:** в публичных DNS никогда не светим IP бэкенд-VPS —
только IP прокси Njalla. SSH на VPS вы и так делаете по IP напрямую,
DNS тут ни при чём.

## Что понадобится

| Компонент | Роль | Статус |
|---|---|---|
| Njalla VPS 15 (80.78.31.171) | ПОКА всё в одном: прокси + приложение + база | ✅ есть, настроен |
| PrivateAlps VPS 30 (2 ядра / 3 ГБ / 30 ГБ) | БЭКЕНД по ТЗ (скрытый) — заказчик оплатит → бэкенд переезжает туда, Njalla становится чистым прокси, DNS не меняется | ⏳ ждём оплату |
| Mynymbox | DNS-хостинг (бесплатный DNS Management в клиентском портале) | есть |
| Домен oakhavenyield.com + доступ к панели его регистратора | смена NS на Mynymbox | есть |
| Доступ к Neon Console и Vercel | только чтобы удалить проекты в конце | есть |

Все команды ниже — для **Ubuntu 24.04** (выберите её как ОС при создании
обоих VPS, если ещё не выбрали).

---

# ЭТАП 0. (ПРОПУСКАЕМ — база пустая)

Сайт был в разработке, реальных данных в Neon нет — **экспорт не нужен**,
переходите сразу к ЭТАПУ 1. Ниже инструкция оставлена «на всякий случай»
(вдруг передумаете до удаления проекта Neon).

<details><summary>📦 Если данные из Neon всё же понадобятся — раскрыть</summary>

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

</details>

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

> Порт 4000 (приложение) откроем позже — и только для IP прокси Njalla (этап 3A.5).

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

### 2.4. (ПРОПУСК — база пустая)

Таблицы создадутся сами при первом запуске приложения,
демо-пользователи — тоже (`SEED_DEMO=on` в .env).

<details><summary>📦 Если данные из Neon всё же нужны — раскрыть</summary>

```bash
# скопируйте файл на VPS (с вашего ПК):
scp server/neon-backup.json oakhaven@IP_VPS:/home/oakhaven/

# на VPS:
cd /opt/oakhaven/server
sudo -u oakhaven env \
  DATABASE_URL='postgresql://ohy:ПАРОЛЬ@127.0.0.1:5432/oakhaven' PGSSL=off \
  node scripts/import-json.js /home/oakhaven/neon-backup.json
```

</details>

### 2.5. Автозапуск через systemd

```bash
sudo cp /opt/oakhaven/deploy/oakhaven.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now oakhaven
sudo journalctl -u oakhaven -f        # логи в реальном времени
```

В логах должно быть: `🚀 Oak Haven Yield API server running`,
`Serving the built site from /dist` и `[seed] Demo users ready`
(это автоматически созданные демо-аккаунты при первом старте).

Проверка прямо на VPS:

```bash
curl http://127.0.0.1:4000/api/health     # {"ok":true}
curl -I http://127.0.0.1:4000/            # 200 OK, HTML сайта
```

**Бэкенд готов.** Пока DNS не переключён, мир о нём не знает.

---

# ЭТАП 3. Реверс-прокси (публичная машина)

## Что такое реверс-прокси простыми словами

Обычный прокси/VPN — это когда **вы** прячетесь за чужим сервером.
Реверс-прокси — наоборот: за чужим сервером прячется **ваш сайт**.

```
Интернет видит ТОЛЬКО прокси:

  Клиент → https://oakhavenyield.com
            DNS отвечает: «сайт на 5.6.7.8»  ← это IP ПРОКСИ
                   ▼
            РЕВЕРС-ПРОКСИ (публичный сервер)
            встречает посетителей, держит HTTPS-замок 🔒,
            пересылает запросы дальше
                   ▼  http://1.2.3.4:4000  ← этот IP никто не знает
            РЕАЛЬНЫЙ VPS: приложение + база
            отвечает ТОЛЬКО прокси (фаервол), напрямую недоступен
```

Зачем: в DNS, браузере клиента и у «разведчиков» везде светится только
IP прокси. DDoS и сканирование прилетают на прокси — заменить его можно
за час, а бэкенд с данными не пострадает.

## Три варианта — заказчик выбрал 3A (Njalla)

| Вариант | Что это | Плюсы | Минусы |
|---|---|---|---|
| **3A. Njalla VPS как прокси** ✅ | Отдельный приватный VPS (njal.la/servers) с nginx | Анонимность по ТЗ: Tor-friendly, крипто-оплата, без AWS; полный контроль | +€15/мес |
| **3B. nginx на том же VPS** | Прокси и сайт на одной машине | €0 сверху | IP бэкенда виден публично — нарушает ТЗ |
| **3C. Cloudflare** | Готовый бесплатный реверс-прокси | Бесплатно, анти-DDoS | Заказчик отложил CF «на конец» как CDN — см. этап 6 |

---

## Вариант 3A — Njalla VPS как реверс-прокси (наш путь)

### 3A.0. Заказ прокси на njal.la

1. njal.la → **Servers** → выбрать VPS. **Для роли прокси достаточно
   VPS 15 (€15/мес)** — nginx пересылает запросы, ресурсов почти не ест.
   Заказчик дал ссылку на VPS 30 (€30) — тоже подойдёт, просто с запасом.
2. ОС: **Ubuntu 24.04**. Оплата — картой или криптой (BTC/XMR), можно
   через Tor — KYC не требуется.
3. После активации в панели Njalla будут **IP-адрес и root-доступ**.
   Этот IP = **IP_ПРОКСИ** во всей инструкции ниже.

### 3A.1. Базовая настройка прокси

```bash
ssh root@IP_ПРОКСИ
apt update && apt -y upgrade
apt -y install nginx certbot python3-certbot-nginx ufw
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

### 3A.2. Конфиг сайта

Файл `deploy/nginx-proxy.conf` уже в этом репозитории.

1. Откройте его, замените `BACKEND_VPS_IP` на IP вашего PrivateAlps VPS.
2. Залейте на прокси и включите:

```bash
sudo cp nginx-proxy.conf /etc/nginx/sites-available/oakhaven
sudo ln -s /etc/nginx/sites-available/oakhaven /etc/nginx/sites-enabled/oakhaven
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### 3A.3. Проверка цепочки ДО переключения DNS

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

### 3A.4. HTTPS-сертификат

Let's Encrypt проверяет домен через DNS, поэтому сначала DNS (этап 4),
потом certbot — команда в шаге 4.4.

### 3A.5. Закрыть бэкенд ото всех, кроме прокси

На **VPS PrivateAlps**:

```bash
ufw allow from IP_ПРОКСИ to any port 4000 proto tcp
ufw status
# должно быть: 22 ALLOW Anywhere; 4000 ALLOW IP_ПРОКСИ
```

С этого момента порт 4000 снаружи доступен только прокси.
Проверка: `curl http://IP_VPS:4000/api/health` с вашего ПК → таймаут. 👍

---

<details><summary>📎 Запасные варианты 3B и 3C (по ТЗ не используем, оставлено для справки)</summary>

### 3B — nginx на том же VPS (без второго сервера, IP виден)

```bash
# nginx и certbot ставятся НА САМ PrivateAlps VPS:
apt -y install nginx certbot python3-certbot-nginx

# в deploy/nginx-proxy.conf upstream:
upstream oakhaven_backend {
    server 127.0.0.1:4000;
    keepalive 32;
}

# дальше как в 3A.2 (sites-available, симлинк, nginx -t, reload)
# фаервол: ufw allow 'Nginx Full'; порт 4000 не открывать вообще
```

В DNS A-записи `@` и `www` → IP этого VPS.

### 3C — Cloudflare как единственный прокси

CF забирает DNS к себе (свои NS вместо Mynymbox), A-запись «proxied» →
IP сервера, мир видит только IP Cloudflare. Подробно — в этапе 6:
заказчик отложил Cloudflare «на конец» как CDN — тогда NS домена
переедут из Mynymbox в Cloudflare.

</details>

---

# ЭТАП 4. DNS через Mynymbox

### 4.1. Создать зону

mynymbox.io → **Domains → DNS Management** → добавьте `oakhavenyield.com`.

### 4.2. Записи в зоне

| Тип | Имя | Значение | TTL |
|---|---|---|---|
| A | `@` | **IP_ПРОКСИ** (= IP Njalla) | 300 |
| A | `www` | **IP_ПРОКСИ** (= IP Njalla) | 300 |

⚠️ **Обязательно перенесите остальные записи из текущей DNS-зоны**
(сейчас она у регистратора/Vercel) — иначе сломается почта домена:

* `TXT` записи Brevo/SPF/DKIM (начинаются с `v=spf1`, `v=DKIM1`),
* `MX` (если есть почта на домене),
* любые `TXT` верификации (Vercel, Google и т.п.).

Проще всего: открыть старую зону и новую в двух вкладках и перенести всё,
кроме старых A/CNAME на Vercel (их заменяют новые A-записи на прокси).

### 4.3. Переключить NS у регистратора

NS-серверы Mynymbox (по их базе знаний — `ns.mynymdns.me` и
`ns.mynymdns.in`; **сверьте с тем, что показывает ваша панель** —
Domains → DNS Management).
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
- Neon: Project → Settings → Delete (база пустая, ничего не теряем).

---

# ЭТАП 6 (под конец, по слову заказчика). Cloudflare CDN

Когда сайт отполирован и нужны скорость + дополнительная защита,
вперёд встаёт Cloudflare (бесплатный тариф). Цепочка станет:

```
Клиент → Cloudflare CDN (кэш, DDoS-защита, замок 🔒 у посетителя)
          → прокси Njalla (условия ТЗ сохраняются)
            → PrivateAlps VPS (по-прежнему никому не известен)
```

Что меняется (бэкенд PrivateAlps **не трогаем вообще**):

1. cloudflare.com → Add site → Free план → Cloudflare выдаст **свои
   два NS** — у регистратора NS Mynymbox заменяются на NS Cloudflare.
   (Mynymbox из схемы уходит: DNS-зону переедет в Cloudflare.)
2. В Cloudflare DNS: A-записи `@` и `www` → **IP Njalla**,
   статус **Proxied** (оранжевое облачко 🟧). TXT/MX записи почты
   переносим так же, как делали в Mynymbox.
3. Cloudflare → SSL/TLS → режим **Full (strict)** — у нас на Njalla
   настоящий сертификат Let's Encrypt, так что всё соответствует.
4. На Njalla добавить восстановление реальных IP посетителей
   (иначе в логах все «сидят» с адресов Cloudflare):

   ```nginx
   # /etc/nginx/conf.d/cloudflare-real-ip.conf
   # актуальные диапазоны: https://www.cloudflare.com/ips-v4
   include /etc/nginx/cloudflare-ips;   # файл со строками set_real_ip_from …
   real_ip_header CF-Connecting-IP;
   ```
5. Опционально: на Njalla ограничить 80/443 только диапазонами
   Cloudflare — тогда даже прокси не отвечает прямым обращениям.
   ⚠️ Не забудьте оставить SSH с вашего IP, иначе потеряете доступ.

Цена вопроса, о которой стоит знать: Cloudflare **терминирует TLS и
видит весь трафик** (американская компания со своими правилами
к финансовой тематике). За скорость и кэш CDN платим именно этим.
PrivateAlps при этом остаётся скрыт даже от Cloudflare — в их панели
фигурирует только Njalla.

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
