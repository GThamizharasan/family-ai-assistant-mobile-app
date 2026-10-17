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

  // Ensure OAuth deep link intent-filter is configured on MainActivity
  const activityNode = applicationNode
    ? Array.from(applicationNode.childNodes).find(
        (node) =>
          node.nodeType === 1 &&
          node.nodeName === 'activity' &&
          (node.getAttributeNS(androidNamespace, 'name') === '.MainActivity' ||
            node.getAttributeNS(androidNamespace, 'name')?.includes('MainActivity'))
      )
    : null;

  if (activityNode) {
    const intentFilters = Array.from(activityNode.childNodes).filter(
      (node) => node.nodeType === 1 && node.nodeName === 'intent-filter'
    );
    const hasOauthFilter = intentFilters.some((filter) =>
      Array.from(filter.childNodes).some(
        (child) =>
          child.nodeType === 1 &&
          child.nodeName === 'data' &&
          child.getAttributeNS(androidNamespace, 'scheme') === 'com.family.ai.assistant'
      )
    );

    if (!hasOauthFilter) {
      const oauthFilter = document.createElement('intent-filter');

      const action = document.createElement('action');
      action.setAttributeNS(androidNamespace, 'android:name', 'android.intent.action.VIEW');
      oauthFilter.appendChild(action);

      const catDefault = document.createElement('category');
      catDefault.setAttributeNS(androidNamespace, 'android:name', 'android.intent.category.DEFAULT');
      oauthFilter.appendChild(catDefault);

      const catBrowsable = document.createElement('category');
      catBrowsable.setAttributeNS(androidNamespace, 'android:name', 'android.intent.category.BROWSABLE');
      oauthFilter.appendChild(catBrowsable);

      const dataOauth = document.createElement('data');
      dataOauth.setAttributeNS(androidNamespace, 'android:scheme', 'com.family.ai.assistant');
      dataOauth.setAttributeNS(androidNamespace, 'android:host', 'oauth');
      oauthFilter.appendChild(dataOauth);

      const dataScheme = document.createElement('data');
      dataScheme.setAttributeNS(androidNamespace, 'android:scheme', 'com.family.ai.assistant');
      oauthFilter.appendChild(dataScheme);

      activityNode.appendChild(oauthFilter);
    }
  }

  await writeFile(manifestPath, new XMLSerializer().serializeToString(document));
  console.log(`Ensured Android permissions, cleartext traffic, and OAuth deep-link intent filter.`);
}

if (existsSync(variablesPath)) {
  let vars = await readFile(variablesPath, 'utf8');
  // compileSdkVersion must be 36 for androidx.core:core:1.17.0; targetSdkVersion set to 35 for device runtime compatibility
  vars = vars.replace(/compileSdkVersion\s*=\s*\d+/, 'compileSdkVersion = 36');
  vars = vars.replace(/targetSdkVersion\s*=\s*\d+/, 'targetSdkVersion = 35');
  await writeFile(variablesPath, vars);
  console.log(`Ensured Android SDK variables set to compileSdkVersion = 36, targetSdkVersion = 35.`);
}

const mainActivityPath = 'android/app/src/main/java/com/family/ai/assistant/MainActivity.java';
if (existsSync(mainActivityPath)) {
  const mainActivityContent = `package com.family.ai.assistant;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            WebView webView = this.getBridge().getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setJavaScriptEnabled(true);
                settings.setJavaScriptCanOpenWindowsAutomatically(true);

                String ua = settings.getUserAgentString();
                if (ua != null) {
                    String newUa = ua.replace("; wv", "")
                                     .replace("; wv;", ";")
                                     .replaceAll("Version/\\\\d+\\\\.\\\\d+\\\\s*", "");
                    settings.setUserAgentString(newUa);
                }
            }
        } catch (Exception e) {
            // ignore
        }
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }
}
`;
  await writeFile(mainActivityPath, mainActivityContent);
  console.log('Ensured MainActivity.java configured for multi-window OAuth popups and clean user-agent.');
}

