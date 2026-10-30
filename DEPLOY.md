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

### 1. VPS: tambah service `web` di `~/stack/docker-compose.yml`

```yaml
  web:
    image: ghcr.io/tegarsw17/kebun-web:latest
    restart: unless-stopped
```

Tidak perlu `ports:`; Caddy menjangkaunya lewat jaringan internal compose
(Caddy harus ada di file compose yang sama, atau di network yang sama).

### 2. VPS: arahkan Caddy ke container web

Di `Caddyfile`, blok domain kebun menjadi:

```
kebun.43-157-235-41.sslip.io {
	encode gzip
	handle /api/* {
		reverse_proxy api:3000
	}
	handle {
		reverse_proxy web:80
	}
}
```

Pertahankan pengaturan lain yang sudah ada di blok `/api` (misalnya batas ukuran upload foto).
Kalau sebelumnya web disajikan dengan `root` + `file_server`, baris itu diganti `reverse_proxy web:80`.

### 3. VPS: izin menarik image dari GHCR

VPS sudah menarik `kebun-api` dari GHCR, jadi biasanya sudah login. Cek:

```bash
grep -q ghcr.io ~/.docker/config.json && echo "sudah login"
```

Kalau belum: buat token di GitHub → Settings → Developer settings → Personal access tokens
(classic) dengan scope `read:packages`, lalu di VPS:

```bash
echo <TOKEN> | docker login ghcr.io -u tegarsw17 --password-stdin
```

### 4. GitHub: secrets di repo `fe-kb`

Settings → Secrets and variables → Actions → New repository secret:

| Nama | Isi |
|---|---|
| `VPS_HOST` | `43.157.235.41` |
| `VPS_USER` | `ubuntu` |
| `VPS_SSH_KEY` | private key SSH yang bisa login ke VPS (isi file utuh, termasuk baris `BEGIN`/`END`) |

Sama seperti di repo API, jadi isinya bisa disalin dari sana.

### 5. Deploy pertama

```bash
git push origin main
```

Lihat progresnya di tab **Actions**. Setelah hijau, di VPS:

```bash
cd ~/stack
docker compose up -d caddy          # muat ulang Caddyfile (atau: docker compose restart caddy)
docker compose ps                    # web harus "healthy"
curl -sI https://kebun.43-157-235-41.sslip.io/ | head -1
```

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
