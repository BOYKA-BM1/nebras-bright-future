# Known Limitations
- Web cannot fully block screenshots/screen recording
- AI image generation depends on provider model availability
- Secondary admin masking is server-side for listAccounts; ensure all admin list endpoints follow the same pattern
- payment_methods seed assumes unique constraint on `key` — adjust if schema differs
- Large user lists capped at 1000 in listAccounts (needs pagination for scale)
