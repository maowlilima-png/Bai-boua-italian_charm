# Bai Boua Italian Charm — Fast Catalog v10

- Replaced the previous charm catalog with the new uploaded folder catalog.
- Prices are read from the nearest folder name containing a price; BB01 defaults to 27,000 kip unless a set overrides it.
- Catalog flow: group -> set cover image -> individual charms.
- 1,833 product images across 89 sets.
- Images converted to lightweight WebP and loaded lazily/on demand.
- Original new catalog image payload (~264.6 MB) reduced to ~18 MB for faster browsing.
- Product images are preprocessed; no heavy background-removal step runs in the browser.
- No cross-session design restore/autosave.

Open `index.html`.
