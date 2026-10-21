-- Brand refresh: the platform default accent colour is now the iSN navy (#243c7c) and the default
-- theme is light. Move rows that still hold a PREVIOUS DEFAULT (#ff682c orange, #16a34a green,
-- theme 'system') to the new defaults; any other value is an admin's deliberate choice and is
-- left alone. Idempotent — safe to re-run.
UPDATE dashboard.platform_settings
SET value = '#243c7c'
WHERE key = 'brand_color' AND lower(value) IN ('#ff682c', '#16a34a');

UPDATE dashboard.platform_settings
SET value = 'light'
WHERE key = 'default_theme' AND value = 'system';
