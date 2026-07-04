# Nagy Napsugár – Weboldal

Egy-oldalas, reszponzív marketingweboldal **Nagy Napsugár** mérlegképes könyvelő számára.

## Technológia

- Tiszta HTML5 + CSS3 (vanilla, keretrendszer nélkül)
- Vanilla JavaScript (form-validáció, scroll-efektek, animációk)
- Nincsenek külső függőségek – egyetlen fájlpárból áll

## Struktúra

```
index.html   – A teljes egy-oldalas weboldal
styles.css   – Stíluslapok
```

## Az oldal szakaszai

1. **Navbar** – rögzített fejléc, görgetésre megváltozó megjelenés
2. **Hero** – bevezető szekció statisztikákkal és animált kártya-widgettel
3. **Rólam** – személyes bemutatkozás és értékek
4. **Szolgáltatások** – 6 szolgáltatáskártya (könyvelés, adótanácsadás, bérszámfejtés, stb.)
5. **Árlista** – havi csomagok és kiegészítő szolgáltatások
6. **Miért engem?** – előnyök és kulcsstatisztikák
7. **Kapcsolat** – elérhetőségek, nyitvatartás, kapcsolatfelvételi űrlap
8. **Footer** – navigáció, linkek, jogi információk

## Helyi futtatás

```bash
# Egyszerűen nyisd meg böngészőben:
open index.html
# vagy
python3 -m http.server 8080
```

## GitHub Pages telepítés

Ez a projekt simán mehet GitHub Pagesre, mert a frontend tisztán statikus. A kapcsolatfelvételi űrlap viszont nem GitHub Pagesen fut, hanem továbbra is a Cloudflare Worker API-t hívja.

### 1. Töltsd fel a projektet GitHubra

1. Hozz létre egy új repót GitHubon, vagy használd a meglévőt.
2. Töltsd fel a teljes tartalmat, beleértve az `index.html`, `styles.css`, `images/` és a `CNAME` fájlt is.
3. Ne töröld a `CNAME` fájlt, mert ez a `www.napsugarkonyveles.hu` saját domainhez kell.

### 2. Kapcsold be a GitHub Pages-t

1. GitHubon nyisd meg a repót.
2. Menj a `Settings` -> `Pages` részre.
3. A `Build and deployment` alatt válaszd a `Deploy from a branch` opciót.
4. Állítsd be a branch-et `main`-re és a gyökeret `/root`-ra.
5. Mentsd el, majd várd meg, amíg GitHub Pages elkészíti az oldalt.

Ha a saját domainnel szeretnéd használni, a `CNAME` fájl már a `www.napsugarkonyveles.hu` címet tartalmazza. Ilyenkor a GitHub Pages oldalon is ezt a custom domain-t kell használni.

### 3. Ellenőrizd a kapcsolatfelvételi API-t

A form nem GitHub Pagesen futó backendhez beszél, hanem a Cloudflare Workerhez, tehát ennek külön működnie kell.

1. Deployold a `cloudflare-worker/worker.js` fájlt Cloudflare Workerként.
2. Állítsd be a szükséges secret-eket: `RESEND_API_KEY` és opcionálisan `TURNSTILE_SECRET_KEY`.
3. Ellenőrizd, hogy a worker elérhető az `https://api.napsugarkonyveles.hu/contact` címen.
4. A worker CORS-ja már engedi a GitHub Pages origint is, ezért a GitHub Pagesről küldött űrlap is működni fog.

### 4. Ha Turnstile-t is használsz

Ha akarsz captcha-védelmet, a frontendben a `turnstile-wrap` `data-sitekey` értékébe írd be a saját site key-t.

Ha üresen hagyod, az űrlap akkor is elküldhető marad, csak captcha nélkül.

### 5. Publikálás után ezt teszteld

1. Nyisd meg a GitHub Pages URL-t.
2. Görgess le a kapcsolat űrlaphoz.
3. Töltsd ki és küldj egy tesztüzenetet.
4. Nézd meg, megérkezik-e az email.
5. Próbáld ki mobilon is, hogy a toast és a mezők nem lógnak-e ki.

## Saját kapcsolatfelvételi API (FormSubmit helyett)

Az űrlap nem közvetlenül e-mailt küld a böngészőből. A böngésző a kapcsolatfelvételi adatokat egy Cloudflare Workernek adja át, és a Worker intézi a háttérmunkát:

- ellenőrzi, hogy a kérés érvényes-e
- kiszűri a spamet a honeypot mezővel
- opcionálisan ellenőrzi a Turnstile tokent
- elküldi az e-mailt a Resend API-val

Ez azért kell, mert GitHub Pagesen csak statikus frontend fut, tehát a valódi backend-logika külön szolgáltatásban van.

Az oldal most ugyanazon a domainen keresztül tud kapcsolatfelvételi üzenetet küldeni:

- Frontend endpoint: `https://api.napsugarkonyveles.hu/contact`
- Backend: Cloudflare Worker a `cloudflare-worker/worker.js` fájlban
- Email provider: Resend API
- Spam védelem: honeypot + opcionális Cloudflare Turnstile

### 1. Cloudflare Worker telepítése

A deploy lényege röviden: a `cloudflare-worker/worker.js` fájlt feltöltöd a Cloudflare-hez, és a Cloudflare ebből egy publikus HTTP végpontot csinál.

Előfeltétel:

- A `napsugarkonyveles.hu` domain Cloudflare alatt legyen kezelve
- Node.js + npm telepítve legyen

Mit kell ilyenkor létrehozni?

- egy Worker projektet a `cloudflare-worker` mappában
- a szükséges secret-eket a Cloudflare-ben
- egy route-ot, amely az `api.napsugarkonyveles.hu/contact` címet a Workerre irányítja

Lépések:

```bash
cd cloudflare-worker
npm init -y
npm install --save-dev wrangler
npx wrangler login
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler deploy
```

Az `npx wrangler deploy` parancs feltölti a `worker.js`-t, és a `wrangler.toml` alapján létrehozza a publisholt végpontot.

Ha minden jól ment, a worker elérhető lesz az `https://api.napsugarkonyveles.hu/contact` címen.
Ez egy `POST` endpoint, ezért ha böngészőben simán megnyitod (`GET`), a `{"success":false,"error":"Method not allowed"}` válasz normális.

### 2. DNS és route beállítás

Cloudflare-ben:

- Hozz létre egy `api` subdomaint (`api.napsugarkonyveles.hu`)
- Route maradjon a `wrangler.toml` szerint: `api.napsugarkonyveles.hu/contact`

Ha szükséges, állítsd át a `zone_name` mezőt a saját Cloudflare zónanevedre.

Fontos: a frontend űrlap csak akkor fog működni, ha ez a cím tényleg elérhető. Ha a route hiányzik, a form elküldi a kérést, de a böngésző hibát kap válaszul.

Ha a deploy után nem működik, a három leggyakoribb hiba ez:

- a `RESEND_API_KEY` nincs beállítva
- a `api.napsugarkonyveles.hu/contact` route nincs rákötve a workerre
- a domain még nincs ténylegesen Cloudflare alatt kezelve

### 3. Turnstile site key beállítása a frontendben

Az `index.html` fájlban a kapcsolatfelvételi űrlapnál keresd ezt:

```html
<div class="turnstile-wrap" id="turnstile-wrap" data-sitekey="">
```

Majd add meg a saját Turnstile site key-t:

```html
<div class="turnstile-wrap" id="turnstile-wrap" data-sitekey="SAJAT_TURNSTILE_SITE_KEY">
```

Ha üresen hagyod, a Turnstile a frontend oldalon kikapcsolva marad. A Worker csak akkor ellenőrzi a tokent, ha a frontend ténylegesen küld egyet, így a kapcsolatfelvétel captcha nélkül is működik, ha nincs beállítva site key.

### 4. Resend email domain

Ajánlott `FROM_EMAIL` példa a `wrangler.toml` szerint:

- `Napsugar Kapcsolat <kapcsolat@mg.napsugarkonyveles.hu>`

Fontos: a feladó domainjét Resendben hitelesíteni kell (DNS rekordokkal).

### 5. Gyors ellenőrzés

1. Küldj tesztüzenetet normál kitöltéssel
2. Ellenőrizd, hogy megérkezett az email
3. Töltsd ki a rejtett mezőt (`company`) fejlesztői eszközből, ilyenkor ne menjen valódi email
4. Hibás email címmel ellenőrizd a validációt
5. Próbáld ki mobilon és asztali böngészőben is
