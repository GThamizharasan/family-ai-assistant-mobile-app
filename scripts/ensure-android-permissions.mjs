import { readFile, writeFile } from 'node:fs/promises';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const manifestPath = 'android/app/src/main/AndroidManifest.xml';
const androidNamespace = 'http://schemas.android.com/apk/res/android';
const requiredPermissions = [
  'android.permission.RECORD_AUDIO',
  'android.permission.CAMERA',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
];

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

for (const permission of requiredPermissions) {
  if (existingPermissions.has(permission)) continue;

  const permissionNode = document.createElement('uses-permission');
  permissionNode.setAttributeNS(androidNamespace, 'android:name', permission);
  manifest.insertBefore(permissionNode, applicationNode || null);
}

await writeFile(manifestPath, new XMLSerializer().serializeToString(document));
console.log(`Ensured Android permissions: ${requiredPermissions.join(', ')}`);
