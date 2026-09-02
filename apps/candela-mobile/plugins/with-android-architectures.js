const { withGradleProperties } = require('expo/config-plugins');

const ANDROID_ABIS = 'armeabi-v7a,arm64-v8a';

/**
 * Skip x86 / x86_64 native builds.
 * Vision Camera 4.7.3 fails to link worklets on those ABIs under RN 0.81
 * (EAS_BUILD_UNKNOWN_GRADLE_ERROR in the Run gradlew phase).
 */
function withAndroidArchitectures(config) {
  return withGradleProperties(config, (config) => {
    const existing = config.modResults.find(
      (item) => item.type === 'property' && item.key === 'reactNativeArchitectures',
    );
    if (existing) {
      existing.value = ANDROID_ABIS;
    } else {
      config.modResults.push({
        type: 'property',
        key: 'reactNativeArchitectures',
        value: ANDROID_ABIS,
      });
    }
    return config;
  });
}

module.exports = withAndroidArchitectures;
