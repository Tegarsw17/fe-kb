# Deploy web ke VPS (Docker)

Alur: **push ke `main`** → GitHub Actions build image `ghcr.io/tegarsw17/kebun-web`
(sekalian typecheck) → SSH ke VPS → `docker compose up -d web`.

```
internet ──443──> caddy ──/api/*──> api:3000 ──> db (Postgres)
                        └─lainnya─> web:80   (nginx, file statis hasil build)
```

Caddy mengurus HTTPS. Container `web` hanya menyajikan file, tanpa Node di VPS.
Web memanggil `/api` di domain yang sama, jadi tidak perlu `.env` saat build.

## Setup sekali saja

Urutannya penting: image harus sudah ada di GHCR sebelum VPS menariknya,
dan Caddy baru diarahkan ke `web` setelah container-nya jalan.

### 1. GitHub: secrets di repo `fe-kb`

Settings → Secrets and variables → Actions → New repository secret:

| Nama | Isi |
|---|---|
| `VPS_HOST` | `43.157.235.41` |
| `VPS_USER` | `ubuntu` |
| `VPS_SSH_KEY` | private key SSH yang bisa login ke VPS (isi file utuh, termasuk baris `BEGIN`/`END`) |

### 2. VPS: tambah service `web` di `~/stack/docker-compose.yml`

Di bawah service `api`:

```yaml
  web:
    image: ghcr.io/tegarsw17/kebun-web:latest
    restart: unless-stopped
    mem_limit: 64m
```

Tidak perlu `ports:`; Caddy menjangkaunya lewat jaringan internal compose. Belum perlu `up`.

### 3. Push, lalu jadikan image public

```bash
git push origin main
```

Tab **Actions**: langkah build akan hijau, langkah *Deploy ke VPS* **gagal** pada percobaan
pertama karena image masih private dan VPS tidak login ke GHCR. Itu wajar:

1. GitHub → profil → **Packages** → `kebun-web` → **Package settings** →
   *Change visibility* → **Public**. (Isinya hanya file HTML/JS yang memang sudah publik
   di situs; tidak ada secret di dalamnya.)
2. Kembali ke run di tab Actions → **Re-run failed jobs**. Sekarang harus hijau.

Cek di VPS:

```bash
cd ~/stack && docker compose ps web      # STATUS: Up … (healthy)
```

### 4. VPS: arahkan Caddy ke container web

Di `~/stack/caddy/Caddyfile`, ganti blok `handle` terakhir:

```
kebun.43-157-235-41.sslip.io {
    request_body /api/photos {
        max_size 11MB
    }
    handle /api/* {
        reverse_proxy api:3000
    }
    handle {
        reverse_proxy web:80
    }
}
```

Lalu muat ulang tanpa downtime dan cek:

```bash
cd ~/stack
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
curl -sI https://kebun.43-157-235-41.sslip.io/ | head -1   # HTTP/2 200
docker compose logs --tail 3 web                          # permintaan barusan tercatat di sini
```

Folder `caddy/site` (web lama) tidak dipakai lagi; biarkan dulu sebagai cadangan.
Untuk kembali ke web lama: kembalikan blok `handle` ke `root * /srv/site` + `file_server`, lalu reload.

## Sehari-hari

Cukup `git push` ke `main`. Kalau typecheck/build gagal, image lama tetap berjalan.

**Kembali ke versi sebelumnya:** tiap image juga diberi tag commit SHA.

```bash
cd ~/stack
docker compose pull web   # atau set image: ghcr.io/tegarsw17/kebun-web:<sha> di compose
docker compose up -d web
```

## Build manual (tanpa GitHub Actions)

```bash
docker build -t kebun-web .
docker run --rm -p 8080:80 kebun-web      # buka http://localhost:8080
```

## Folder `shared/`

Kode bersama web + mobile (tipe, terjemahan ID/EN, logika kebun). Ada di repo ini supaya
image bisa di-build dari git saja. Aplikasi mobile memakainya dari `../web/shared`.
