# Screen Protection Status

## Browser (implemented)
- Right-click block, selected shortcut blocks
- PrintScreen → clipboard clear + temporary obscure + **logged as `capture_attempt_suspected`**
- visibilitychange / blur → obscure video + **logged as `protected_content_visibility_changed`**
- Student watermark on ProtectedVideo
- Admin panel: Content Protection events (review status)

## Native Android
- **Not implemented** — no Android application in this repository
- FLAG_SECURE would require a native wrapper (Capacitor/React Native/native app)

## Honesty
Browser signals are **not** confirmed screenshots. Event types and confidence fields distinguish suspected vs confirmed_native.
