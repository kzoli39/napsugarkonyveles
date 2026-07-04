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

## Saját kapcsolatfelvételi API (FormSubmit helyett)

Az oldal most ugyanazon a domainen keresztül tud kapcsolatfelvételi üzenetet küldeni:

- Frontend endpoint: `https://api.napsugarkonyveles.hu/contact`
- Backend: Cloudflare Worker a `cloudflare-worker/worker.js` fájlban
- Email provider: Resend API
- Spam védelem: honeypot + opcionális Cloudflare Turnstile

### 1. Cloudflare Worker telepítése

Előfeltétel:

- A `napsugarkonyveles.hu` domain Cloudflare alatt legyen kezelve
- Node.js + npm telepítve legyen

Lépések:

```bash
cd cloudflare-worker
npm init -y
npm install --save-dev wrangler
npx wrangler login
```

Titkok beállítása:

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Deploy:

```bash
npx wrangler deploy
```

### 2. DNS és route beállítás

Cloudflare-ben:

- Hozz létre egy `api` subdomaint (`api.napsugarkonyveles.hu`)
- Route maradjon a `wrangler.toml` szerint: `api.napsugarkonyveles.hu/contact`

Ha szükséges, állítsd át a `zone_name` mezőt a saját Cloudflare zónanevedre.

### 3. Turnstile site key beállítása a frontendben

Az `index.html` fájlban a kapcsolatfelvételi űrlapnál keresd ezt:

```html
<div class="turnstile-wrap" id="turnstile-wrap" data-sitekey="">
```

Majd add meg a saját Turnstile site key-t:

```html
<div class="turnstile-wrap" id="turnstile-wrap" data-sitekey="SAJAT_TURNSTILE_SITE_KEY">
```

Ha üresen hagyod, a Turnstile a frontend oldalon kikapcsolva marad, de a Worker oldalon a `TURNSTILE_SECRET_KEY` megléte esetén kötelező lesz.

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
