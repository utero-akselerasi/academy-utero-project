# Base image dipin ke digest, bukan cuma tag.
#
# `node:20-alpine` salah di dua hal sekaligus. Pertama, tag bergerak: isi image
# yang sama bisa berubah antar-build, jadi build tidak reproducible dan patch
# base image masuk tanpa terlihat di diff. Kedua — dan ini yang menentukan —
# **Node 20 sudah end-of-life sejak 2026-04-30** (jadwal resmi nodejs/Release),
# jadi image itu tidak lagi menerima perbaikan keamanan sama sekali.
#
# Node 24 adalah LTS aktif (berakhir 2028-04-30) dan memenuhi
# `next@16` yang mensyaratkan `node >= 20.9.0`.
#
# Kalau digest ini diperbarui, perbarui juga tag di sebelahnya supaya tetap
# terbaca manusia — keduanya harus menunjuk ke hal yang sama.
FROM node:24.20.0-alpine3.24@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS base

RUN apk add --no-cache tzdata
ENV TZ=Asia/Jakarta

# ---------------------------------------------------------------------------
# deps: dependensi lengkap (termasuk dev) — dibutuhkan untuk build
# ---------------------------------------------------------------------------
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# `package-lock.json*` dengan tanda bintang membuat lockfile yang hilang TIDAK
# menggagalkan build: `npm ci` lalu jatuh ke error yang membingungkan. Tanpa
# bintang, lockfile yang tidak ada gagal di sini — di tempat yang jelas.
#
# `.npmrc` wajib ikut disalin: di dalamnya ada `ignore-scripts=true` dan
# `engine-strict=true`. Tanpa berkas itu di context, `npm ci` di sini berjalan
# dengan default — yaitu menjalankan skrip `postinstall` paket pihak ketiga,
# jalur eksekusi kode arbitrer yang justru ingin ditutup.
COPY package.json package-lock.json .npmrc ./
RUN npm ci

# ---------------------------------------------------------------------------
# builder: `next build`
# ---------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ---------------------------------------------------------------------------
# prod-deps: install ulang TANPA dependensi dev
#
# Dibangun sebagai stage terpisah, bukan `npm prune --production` di runner.
# `prune` membuang paket dari node_modules yang sudah ada, jadi hasilnya
# bergantung pada keadaan sebelumnya; `npm ci --omit=dev` membangun dari
# lockfile, jadi hasilnya sama setiap kali.
#
# Aman meski `next.config.ts` berkas TypeScript: Next mentranspilasinya dengan
# SWC bawaannya sendiri (`next/dist/build/next-config-ts/transpile-config`) atau
# type-stripping native Node — bukan dengan paket `typescript`. Terverifikasi
# dari sumber `next@16.2.9`, jadi `typescript` boleh ikut terbuang.
# ---------------------------------------------------------------------------
FROM base AS prod-deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev

# ---------------------------------------------------------------------------
# runner
# ---------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs package.json ./
COPY --chown=nextjs:nodejs next.config.ts ./

# `tsconfig.json` ikut disalin karena transpiler `next.config.ts` membacanya
# untuk resolusi `paths`. `next.config.ts` saat ini tidak memakai alias `@/`,
# jadi belum dibutuhkan — tapi berkasnya 652 byte dan begitu suatu saat ada
# import ber-alias di sana, tanpa berkas ini container gagal start dengan error
# resolusi modul yang tidak menunjuk ke Dockerfile sama sekali.
COPY --chown=nextjs:nodejs tsconfig.json ./

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "start"]
