// Minimal typing for the Chrome extension APIs we use (avoids pulling in @types/chrome)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const chrome: any;

declare module '@inboxsdk/core/background.js';
