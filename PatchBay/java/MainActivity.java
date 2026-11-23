package com.jerm747.patchbay;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.midi.MidiManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.*;
import android.widget.Toast;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.Collections;
import java.util.Locale;

public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String HOME = "https://" + HOST + "/apps/index.html";
    private WebView web;
    private ValueCallback<Uri[]> picker;
    private PermissionRequest microphone;
    private MidiManager midi;
    private MidiBridge midiBridge;
    private final Handler main = new Handler(Looper.getMainLooper());

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        setContentView(web);
        web.setBackgroundColor(0xff0b1118);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);

        midi = getSystemService(MidiManager.class);
        midiBridge = new MidiBridge(midi, main, js -> web.evaluateJavascript(js, null));
        web.addJavascriptInterface(midiBridge, "RackMidi");
        web.addJavascriptInterface(new Exports(), "RackExports");
        if (midi != null) midi.registerDeviceCallback(midiBridge, main);

        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (local(uri)) return false;
                if (request.isForMainFrame() && "https".equals(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                    catch (Exception ex) { toast("No browser is available."); }
                }
                return true;
            }

            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                midiBridge.reset();
            }

            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!local(uri)) return response("text/plain", 403, "Blocked");
                String path = uri.getPath();
                if (path == null || !path.startsWith("/apps/") || path.contains("..")) {
                    return response("text/plain", 404, "Not Found");
                }
                try {
                    String type = mime(path);
                    return new WebResourceResponse(type, type.startsWith("text/") || type.equals("application/javascript") ? "UTF-8" : null,
                        200, "OK", Collections.singletonMap("Content-Security-Policy",
                        "default-src 'self'; connect-src 'self' blob:; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob: data:; worker-src 'self' blob:; frame-src 'none'"),
                        getAssets().open(path.substring(1)));
                } catch (IOException ex) { return response("text/plain", 404, "Not Found"); }
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (picker != null) picker.onReceiveValue(null);
                picker = callback;
                try { startActivityForResult(params.createIntent(), 20); }
                catch (Exception ex) { picker = null; callback.onReceiveValue(null); }
                return true;
            }

            @Override public void onPermissionRequest(PermissionRequest request) {
                boolean audio = java.util.Arrays.asList(request.getResources()).contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE);
                if (!local(request.getOrigin()) || !audio) { request.deny(); return; }
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                    return;
                }
                if (microphone != null) { request.deny(); return; }
                microphone = request;
                requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 30);
            }

            @Override public void onPermissionRequestCanceled(PermissionRequest request) {
                if (microphone == request) microphone = null;
            }
        });
        if (state == null || web.restoreState(state) == null) web.loadUrl(HOME);
    }

    private static boolean local(Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()) && uri.getPort() == -1;
    }

    private static WebResourceResponse response(String mime, int status, String reason) {
        return new WebResourceResponse(mime, "UTF-8", status, reason, null, new ByteArrayInputStream(new byte[0]));
    }

    private static String mime(String path) {
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".webp")) return "image/webp";
        if (path.endsWith(".jpg")) return "image/jpeg";
        if (path.endsWith(".json")) return "application/json";
        if (path.endsWith(".png")) return "image/png";
        return "text/html";
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == 20 && picker != null) {
            ValueCallback<Uri[]> callback = picker;
            picker = null;
            callback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
        }
    }

    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (request != 30 || microphone == null) return;
        PermissionRequest pending = microphone;
        microphone = null;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
            pending.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        } else pending.deny();
    }

    @Override protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        web.saveState(state);
    }

    @Override public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else if (!HOME.equals(web.getUrl())) web.loadUrl(HOME);
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (midi != null) midi.unregisterDeviceCallback(midiBridge);
        midiBridge.reset();
        web.destroy();
        super.onDestroy();
    }

    private void toast(String message) {
        main.post(() -> Toast.makeText(this, message, Toast.LENGTH_SHORT).show());
    }

    public final class Exports {
        @JavascriptInterface public boolean save(String filename, String type, String base64) {
            Uri item = null;
            try {
                String name = filename.replaceAll("[^\\p{L}\\p{N} ._()-]", "_").trim();
                if (name.isEmpty() || name.length() > 160) throw new IOException();
                if (type.isEmpty()) {
                    String lower = name.toLowerCase(Locale.ROOT);
                    type = lower.endsWith(".mid") ? "audio/midi" : lower.endsWith(".mp3") ? "audio/mpeg" : "application/octet-stream";
                }
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, name);
                values.put(MediaStore.Downloads.MIME_TYPE, type);
                values.put(MediaStore.Downloads.IS_PENDING, 1);
                item = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (item == null) throw new IOException();
                try (OutputStream stream = getContentResolver().openOutputStream(item)) {
                    if (stream == null) throw new IOException();
                    stream.write(bytes);
                }
                values.clear();
                values.put(MediaStore.Downloads.IS_PENDING, 0);
                getContentResolver().update(item, values, null, null);
                toast("Saved to Downloads");
                return true;
            } catch (Exception ex) {
                if (item != null) getContentResolver().delete(item, null, null);
                toast("Could not save this export.");
                return false;
            }
        }
    }
}
