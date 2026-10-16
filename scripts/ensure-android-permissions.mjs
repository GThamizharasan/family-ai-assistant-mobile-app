import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const manifestPath = 'android/app/src/main/AndroidManifest.xml';
const variablesPath = 'android/variables.gradle';
const androidNamespace = 'http://schemas.android.com/apk/res/android';

const requiredPermissions = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.RECORD_AUDIO',
  'android.permission.MODIFY_AUDIO_SETTINGS',
  'android.permission.CAMERA',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
];

if (existsSync(manifestPath)) {
  const manifestXml = await readFile(manifestPath, 'utf8');
  const parseErrors = [];
  const document = new DOMParser({
    onError: (level, message) => {
      if (level === 'error' || level === 'fatalError') parseErrors.push(message);
    },
  }).parseFromString(manifestXml, 'application/xml');

  if (parseErrors.length > 0 || document.documentElement?.nodeName !== 'manifest') {
    throw new Error(`Unable to parse Android manifest: ${parseErrors.join('; ')}`);
  }

  const manifest = document.documentElement;
  const existingPermissions = new Set();
  for (let node = manifest.firstChild; node; node = node.nextSibling) {
    if (node.nodeType === 1 && node.nodeName === 'uses-permission') {
      existingPermissions.add(node.getAttributeNS(androidNamespace, 'name'));
    }
  }

  const applicationNode = Array.from(manifest.childNodes).find(
    (node) => node.nodeType === 1 && node.nodeName === 'application'
  );

  if (applicationNode) {
    applicationNode.setAttributeNS(androidNamespace, 'android:usesCleartextTraffic', 'true');
    applicationNode.setAttributeNS(androidNamespace, 'android:hardwareAccelerated', 'true');
  }

  for (const permission of requiredPermissions) {
    if (existingPermissions.has(permission)) continue;

    const permissionNode = document.createElement('uses-permission');
    permissionNode.setAttributeNS(androidNamespace, 'android:name', permission);
    manifest.insertBefore(permissionNode, applicationNode || null);
  }

  await writeFile(manifestPath, new XMLSerializer().serializeToString(document));
  console.log(`Ensured Android permissions and cleartext traffic support.`);
}

if (existsSync(variablesPath)) {
  let vars = await readFile(variablesPath, 'utf8');
  // compileSdkVersion must be 36 for androidx.core:core:1.17.0; targetSdkVersion set to 35 for device runtime compatibility
  vars = vars.replace(/compileSdkVersion\s*=\s*\d+/, 'compileSdkVersion = 36');
  vars = vars.replace(/targetSdkVersion\s*=\s*\d+/, 'targetSdkVersion = 35');
  await writeFile(variablesPath, vars);
  console.log(`Ensured Android SDK variables set to compileSdkVersion = 36, targetSdkVersion = 35.`);
}
