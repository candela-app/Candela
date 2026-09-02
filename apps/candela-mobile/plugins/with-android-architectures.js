const fs = require('fs');
const path = require('path');
const { withAppBuildGradle, withDangerousMod, withGradleProperties } = require('expo/config-plugins');

const ABIS = ['armeabi-v7a', 'arm64-v8a'];
const ABIS_CSV = ABIS.join(',');
const ABIS_GROOVY = ABIS.map((abi) => `"${abi}"`).join(', ');

/**
 * Skip x86 / x86_64 native builds.
 * Vision Camera 4.7.3 fails to link worklets on those ABIs under RN 0.81
 * (EAS_BUILD_UNKNOWN_GRADLE_ERROR in the Run gradlew phase).
 * gradle.properties alone is not enough — Vision Camera's CMake still
 * builds every ABI unless ndk.abiFilters is set on the module.
 */
function setReactNativeArchitectures(config) {
  return withGradleProperties(config, (config) => {
    const existing = config.modResults.find(
      (item) => item.type === 'property' && item.key === 'reactNativeArchitectures',
    );
    if (existing) {
      existing.value = ABIS_CSV;
    } else {
      config.modResults.push({
        type: 'property',
        key: 'reactNativeArchitectures',
        value: ABIS_CSV,
      });
    }
    return config;
  });
}

function injectAbiFilters(gradleContents) {
  if (gradleContents.includes('abiFilters')) return gradleContents;
  return gradleContents.replace(
    /defaultConfig\s*\{/,
    `defaultConfig {
        ndk {
            abiFilters ${ABIS_GROOVY}
        }`,
  );
}

function resolveVisionCameraGradle(projectRoot) {
  const candidates = [
    path.join(projectRoot, 'node_modules/react-native-vision-camera/android/build.gradle'),
    path.join(projectRoot, '../node_modules/react-native-vision-camera/android/build.gradle'),
    path.join(projectRoot, '../../node_modules/react-native-vision-camera/android/build.gradle'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function withAndroidArchitectures(config) {
  config = setReactNativeArchitectures(config);

  config = withAppBuildGradle(config, (config) => {
    config.modResults.contents = injectAbiFilters(config.modResults.contents);
    return config;
  });

  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const gradlePath = resolveVisionCameraGradle(config.modRequest.projectRoot);
      if (gradlePath) {
        const next = injectAbiFilters(fs.readFileSync(gradlePath, 'utf8'));
        fs.writeFileSync(gradlePath, next);
      }
      return config;
    },
  ]);

  return config;
}

module.exports = withAndroidArchitectures;
