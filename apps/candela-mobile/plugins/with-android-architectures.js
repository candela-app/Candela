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
 *
 * Vision Camera already has `abiFilters (*reactNativeArchitectures())` on CMake.
 * A naive "insert ndk.abiFilters" patch no-ops because the file already contains
 * that string — then CMake still builds x86 when the library project does not
 * see reactNativeArchitectures. Pin the CMake filters to phone ABIs instead.
 * Do not pass `-Pandroid.injected.build.abi` with a comma list; that fights
 * ndk.abiFilters and fails Gradle in ~10 minutes.
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

function injectAppNdkAbiFilters(gradleContents) {
  if (/ndk\s*\{[\s\S]*abiFilters/.test(gradleContents)) return gradleContents;
  return gradleContents.replace(
    /defaultConfig\s*\{/,
    `defaultConfig {
        ndk {
            abiFilters ${ABIS_GROOVY}
        }`,
  );
}

function pinVisionCameraCmakeAbis(gradleContents) {
  let next = gradleContents.replace(
    /abiFilters\s*\(\s*\*\s*reactNativeArchitectures\(\)\s*\)/,
    `abiFilters ${ABIS_GROOVY}`,
  );
  next = next.replace(
    /return value \? value\.split\(",?"\) : \["armeabi-v7a", "x86", "x86_64", "arm64-v8a"\]/,
    `return value ? value.split(",") : [${ABIS_GROOVY}]`,
  );
  return next;
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
    config.modResults.contents = injectAppNdkAbiFilters(config.modResults.contents);
    return config;
  });

  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const gradlePath = resolveVisionCameraGradle(config.modRequest.projectRoot);
      if (!gradlePath) {
        console.warn('[with-android-architectures] react-native-vision-camera android/build.gradle not found');
        return config;
      }
      const previous = fs.readFileSync(gradlePath, 'utf8');
      const next = pinVisionCameraCmakeAbis(previous);
      if (next === previous) {
        console.warn('[with-android-architectures] Vision Camera CMake abiFilters pattern did not match');
      } else {
        fs.writeFileSync(gradlePath, next);
        console.log(`[with-android-architectures] pinned Vision Camera CMake ABIs (${ABIS_CSV}) in ${gradlePath}`);
      }
      return config;
    },
  ]);

  return config;
}

module.exports = withAndroidArchitectures;
