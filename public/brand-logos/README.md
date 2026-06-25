# Brand logos

Local logo assets for the brand chips shown on `/database` (table + mobile cards)
and `/dashboard` (Top brands). These are bundled, served statically from
`/brand-logos/<slug>.svg`. **No remote logo APIs, no runtime fetching, no
scraping** — drop the files here and they are picked up at build time.

## How it works

A brand chip renders its real logo only when **both** are true:

1. A file `public/brand-logos/<slug>.svg` exists, AND
2. that `<slug>` is registered in `LOGO_ALLOWLIST` in
   `src/lib/businesses/brand-logos.ts`.

Until a slug is registered, that brand shows the neutral fallback chip
(gold initial + name). So you can add logos one at a time with no code risk —
just add the file here and add its slug to the allowlist.

## Naming convention

- One file per brand, **lowercase kebab-case slug**, matching `brandSlug()`:
  lowercase, accents stripped, spaces and `/` become `-`.
- **SVG preferred** (`.svg`) — crisp at any size, tiny, theme-friendly.
- Logos sit on a small **light tile** in the UI, so a transparent background is
  fine and dark/monochrome marks stay readable.
- Keep them square-ish and trimmed of excess padding (the tile adds its own).

## Expected files (19 known brands)

| Brand          | File                          |
| -------------- | ----------------------------- |
| Renault        | `renault.svg`                 |
| Peugeot        | `peugeot.svg`                 |
| Citroen        | `citroen.svg`                 |
| BMW            | `bmw.svg`                     |
| Mercedes-Benz  | `mercedes-benz.svg`           |
| Audi           | `audi.svg`                    |
| Volkswagen     | `volkswagen.svg`              |
| Toyota         | `toyota.svg`                  |
| Nissan         | `nissan.svg`                  |
| Hyundai        | `hyundai.svg`                 |
| Kia            | `kia.svg`                     |
| Ford           | `ford.svg`                    |
| Opel           | `opel.svg`                    |
| Seat           | `seat.svg`                    |
| Skoda          | `skoda.svg`                   |
| Dacia          | `dacia.svg`                   |
| Porsche        | `porsche.svg`                 |
| Volvo          | `volvo.svg`                   |
| Land Rover     | `land-rover.svg`              |

After adding a file, register its slug in `LOGO_ALLOWLIST`
(`src/lib/businesses/brand-logos.ts`), e.g. add `"renault"` once
`renault.svg` is here.

## Notes

- Brands outside this list (free-typed / imported) always use the fallback chip —
  that's expected; no file is required for them.
- Logos are used internally / non-commercially for this CRM. Use accurate brand
  marks; don't recolor or distort proportions.
