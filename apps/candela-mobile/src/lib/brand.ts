import * as Linking from 'expo-linking';

export const brandLogo = require('../../../../packages/shared/assets/updated_Web logo.png');

/** Live Vercel website. Override with EXPO_PUBLIC_WEBSITE_URL when the official domain is ready. */
export const websiteUrl = (
  process.env.EXPO_PUBLIC_WEBSITE_URL || 'https://candela-app-eta.vercel.app'
).replace(/\/$/, '');

export function openWebsite() {
  void Linking.openURL(websiteUrl);
}
