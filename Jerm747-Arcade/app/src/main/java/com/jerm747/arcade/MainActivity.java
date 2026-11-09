package com.jerm747.arcade;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.app.AlertDialog;
import android.hardware.input.InputManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import java.io.IOException;
import java.net.URLConnection;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

/**
 * Encore: a fullscreen WebView shell for Encore and CD Man.
 * Controllers are read natively (Android WebView has no Gamepad API) and
 * published to the page as standard-mapping snapshots on window.EncoreAndroidPads.
 */
public final class MainActivity extends Activity implements InputManager.InputDeviceListener {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String ORIGIN = "https://" + HOST;
    private WebView web;
    private FrameLayout root;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private InputManager inputs;
    private final Map<Integer, Pad> pads = new HashMap<>();
    private volatile boolean trusted = false;
    private boolean loaded = false;
    private boolean useImmersive = true;
    private int lastPadId = -1;
    private Vibrator feedbackMotor;
    private static final int MIC_REQUEST = 71, AUDIO_FILE_REQUEST = 72;
    private PermissionRequest micRequest;
    private ValueCallback<Uri[]> fileResult;

    private boolean externalAudioDialog() {
        return micRequest != null || fileResult != null;
    }

    private void finishMicrophone(boolean allowed) {
        PermissionRequest request = micRequest;
        micRequest = null;
        if (request == null) return;
        if (allowed && trusted && !isFinishing()) {
            request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        } else request.deny();
    }

    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == MIC_REQUEST) finishMicrophone(results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED);
    }

    @Override protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code != AUDIO_FILE_REQUEST || fileResult == null) return;
        ValueCallback<Uri[]> callback = fileResult;
        fileResult = null;
        Uri uri = result == RESULT_OK && data != null ? data.getData() : null;
        callback.onReceiveValue(uri != null && "content".equals(uri.getScheme()) ? new Uri[]{uri} : null);
    }


    private static final class Pad {
        final int index; final String name;
        final float[] axes = new float[4];
        final boolean[] keys = new boolean[17];
        float hatX, hatY, lt, rt;
        Pad(int index, String name) { this.index = index; this.name = name; }
        JSONObject json() throws Exception {
            JSONObject p = new JSONObject();
            p.put("index", index); p.put("id", "Arcade · " + name);
            p.put("mapping", "standard"); p.put("connected", true);
            p.put("timestamp", SystemClock.uptimeMillis());
            JSONArray a = new JSONArray(); for (float v : axes) a.put(v); p.put("axes", a);
            JSONArray b = new JSONArray();
            for (int i = 0; i < keys.length; i++) {
                float v = keys[i] ? 1 : 0;
                if (i == 6) v = Math.max(v, lt);
                if (i == 7) v = Math.max(v, rt);
                if (i == 12 && hatY < -.5f || i == 13 && hatY > .5f || i == 14 && hatX < -.5f || i == 15 && hatX > .5f) v = 1;
                JSONObject value = new JSONObject();
                value.put("pressed", v > .5); value.put("value", v); b.put(value);
            }
            p.put("buttons", b); return p;
        }
        void clear() { Arrays.fill(axes, 0); Arrays.fill(keys, false); hatX = hatY = lt = rt = 0; }
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        root = new FrameLayout(this); root.setBackgroundColor(0xff000000); setContentView(root);
        web = new WebView(this); web.setOnLongClickListener(v -> true); web.setBackgroundColor(0xff000000);
        web.setHapticFeedbackEnabled(false);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false); s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false); s.setSupportMultipleWindows(false);
        s.setBuiltInZoomControls(false); s.setDisplayZoomControls(false); s.setTextZoom(100);
        s.setUserAgentString(s.getUserAgentString() + " Jerm747Arcade/1.0");
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        web.addJavascriptInterface(new Bridge(), "EncoreAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (isLocal(u)) {
                    String path = u.getPath();
                    if (path == null || !path.startsWith("/") || path.contains("..") || path.indexOf(0) >= 0 || path.contains("\\")) {
                        return response(404, "File not found");
                    }
                    WebResourceResponse r;
                    try {
                        if (path.endsWith("/")) path += "index.html";
                        String file = path.substring(1);
                        java.io.InputStream data;
                        try {
                            data = getAssets().open(file);
                        } catch (IOException missing) {
                            if (!file.endsWith(".png")) throw missing;
                            try { data = getAssets().open(file + ".webp"); }
                            catch(IOException second) { data = getAssets().open(file.substring(0, file.length()-4) + ".webp"); }
                            path += ".webp";
                        }
                        String mime = URLConnection.guessContentTypeFromName(path);
                        r = new WebResourceResponse(mime == null ? "application/octet-stream" : mime, null, data);
                    } catch (IOException e) { return response(404, "File not found"); }
                    if (path.endsWith(".js")) r.setMimeType("text/javascript");
                    if (path.endsWith(".json")) r.setMimeType("application/json");
                    if (path.endsWith(".html")) r.setMimeType("text/html");
                    if (path.endsWith(".css")) r.setMimeType("text/css");
                    if (path.endsWith(".svg")) r.setMimeType("image/svg+xml");
                    if (path.endsWith(".woff")) r.setMimeType("font/woff");
                    if (path.endsWith(".mjs")) r.setMimeType("text/javascript");
                    if (path.endsWith(".wav")) r.setMimeType("audio/wav");
                    if (path.endsWith(".webp")) r.setMimeType("image/webp");
                    Map<String, String> headers = new HashMap<>();
                    headers.put("Cache-Control", "no-cache");
                    r.setResponseHeaders(headers); return r;
                }
                if ("data".equals(u.getScheme()) || "blob".equals(u.getScheme())) return null;
                return response(403, "Offline content only");
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return !isLocal(request.getUrl()); }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) { trusted = isLocal(Uri.parse(url)); loaded = false; }
            @Override public void onPageFinished(WebView view, String url) { loaded = true; publishPads(); }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                if (!trusted || externalAudioDialog() || !isLocal(request.getOrigin())
                        || !Arrays.asList(request.getResources()).contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                    request.deny();
                    return;
                }
                micRequest = request;
                web.evaluateJavascript("Boolean(window.Arcade?.beatRoomOpen())", value -> {
                    if (micRequest != request) return;
                    if (!"true".equals(value)) { finishMicrophone(false); return; }
                    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        finishMicrophone(true);
                    } else requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MIC_REQUEST);
                });
            }

            @Override public void onPermissionRequestCanceled(PermissionRequest request) {
                if (micRequest == request) micRequest = null;
            }

            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> result, FileChooserParams params) {
                if (!trusted || externalAudioDialog() || !Arrays.asList(params.getAcceptTypes()).contains("audio/*")) {
                    result.onReceiveValue(null);
                    return true;
                }
                fileResult = result;
                web.evaluateJavascript("Boolean(window.Arcade?.beatRoomOpen())", active -> {
                    if (fileResult != result) return;
                    if ("true".equals(active)) {
                        Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                        pick.addCategory(Intent.CATEGORY_OPENABLE);
                        pick.setType("audio/*");
                        try { startActivityForResult(pick, AUDIO_FILE_REQUEST); return; }
                        catch (ActivityNotFoundException ignored) { }
                    }
                    fileResult = null;
                    result.onReceiveValue(null);
                });
                return true;
            }
        });
        inputs = (InputManager) getSystemService(INPUT_SERVICE);
        inputs.registerInputDeviceListener(this, ui);
        for (int device : InputDevice.getDeviceIds()) ensurePad(device);
        web.loadUrl(ORIGIN + "/index.html?app=android");
        immersive();
    }

    private static boolean isLocal(Uri uri) { return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()); }
    private static WebResourceResponse response(int status, String text) {
        return new WebResourceResponse("text/plain", "UTF-8", status, text, new HashMap<>(), new ByteArrayInputStream(text.getBytes(StandardCharsets.UTF_8)));
    }
    private void js(String code) { if (web != null && !isFinishing() && loaded) web.evaluateJavascript(code, null); }
    @SuppressWarnings("deprecation")
    private void immersive() {
        if (!useImmersive) { getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE); return; }
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }
    @Override public void onWindowFocusChanged(boolean focus) {
        super.onWindowFocusChanged(focus);
        if (focus) { immersive(); js("window.Arcade?.background('focus', false);"); }
        else if (!externalAudioDialog()) { js("window.Arcade?.background('focus', true);"); clearPads(); }
    }
    @Override protected void onPause() { if (!externalAudioDialog()) js("window.Arcade?.background('activity', true);"); clearPads(); if (web != null) { web.onPause(); web.pauseTimers(); } super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) { web.resumeTimers(); web.onResume(); } js("window.Arcade?.background('activity', false);"); immersive(); }
    @Override protected void onDestroy() {
        finishMicrophone(false);
        if (fileResult != null) { fileResult.onReceiveValue(null); fileResult = null; }
        feedback(0, 0);
        if (inputs != null) inputs.unregisterInputDeviceListener(this);
        if (web != null) { web.removeJavascriptInterface("EncoreAndroid"); root.removeView(web); web.destroy(); web = null; }
        super.onDestroy();
    }
    /** Back is handed to the game: close help, pause, or ask to exit from the title. */
    @SuppressWarnings("deprecation")
    @Override public void onBackPressed() {
        if (!loaded) { super.onBackPressed(); return; }
        js("window.Arcade ? window.Arcade.back() : EncoreAndroid.exit();");
    }
    private void confirmExit() {
        new AlertDialog.Builder(this).setTitle("Leave Jerm747 Arcade?")
            .setPositiveButton("Exit", (d, w) -> finish())
            .setNegativeButton("Stay", (d, w) -> { })
            .setOnDismissListener(d -> { immersive(); if (web != null) web.requestFocus(); })
            .show();
    }

    private static boolean isGameDevice(InputDevice d) {
        if (d == null || d.isVirtual()) return false;
        int s = d.getSources();
        return (s & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD || (s & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK;
    }
    private Pad ensurePad(int device) {
        if (pads.containsKey(device)) return pads.get(device);
        InputDevice d = InputDevice.getDevice(device);
        if (!isGameDevice(d)) return null;
        int slot = 0;
        while (slot < 4) { final int index = slot; if (pads.values().stream().noneMatch(p -> p.index == index)) break; slot++; }
        if (slot == 4) return null;
        Pad p = new Pad(slot, d.getName()); pads.put(device, p); return p;
    }
    private void publishPads() {
        try { JSONArray all = new JSONArray(); for (Pad p : pads.values()) all.put(p.json()); js("window.EncoreAndroidPads?.update(" + all + ");"); }
        catch (Exception ignored) { }
    }
    private void clearPads() { for (Pad p : pads.values()) p.clear(); publishPads(); }
    @Override public void onInputDeviceAdded(int id) { ensurePad(id); publishPads(); }
    @Override public void onInputDeviceRemoved(int id) { pads.remove(id); publishPads(); }
    @Override public void onInputDeviceChanged(int id) { pads.remove(id); ensurePad(id); publishPads(); }

    static int standardButton(int code) {
        switch (code) {
            case KeyEvent.KEYCODE_BUTTON_A: return 0;
            case KeyEvent.KEYCODE_BUTTON_B: return 1;
            case KeyEvent.KEYCODE_BUTTON_X: return 2;
            case KeyEvent.KEYCODE_BUTTON_Y: return 3;
            case KeyEvent.KEYCODE_BUTTON_L1: return 4;
            case KeyEvent.KEYCODE_BUTTON_R1: return 5;
            case KeyEvent.KEYCODE_BUTTON_L2: return 6;
            case KeyEvent.KEYCODE_BUTTON_R2: return 7;
            case KeyEvent.KEYCODE_BUTTON_SELECT: return 8;
            case KeyEvent.KEYCODE_BUTTON_START: return 9;
            case KeyEvent.KEYCODE_BUTTON_THUMBL: return 10;
            case KeyEvent.KEYCODE_BUTTON_THUMBR: return 11;
            case KeyEvent.KEYCODE_DPAD_UP: return 12;
            case KeyEvent.KEYCODE_DPAD_DOWN: return 13;
            case KeyEvent.KEYCODE_DPAD_LEFT: return 14;
            case KeyEvent.KEYCODE_DPAD_RIGHT: return 15;
            case KeyEvent.KEYCODE_BUTTON_MODE: return 16;
            default: return -1;
        }
    }
    @Override public boolean dispatchKeyEvent(KeyEvent event) {
        Pad p = ensurePad(event.getDeviceId());
        int button = standardButton(event.getKeyCode());
        if (p != null && button == 9) {
            if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) {
                js("window.Arcade?.onStart();");
            }
            return true;
        }
        if (p != null && button >= 0) {
            lastPadId = event.getDeviceId();
            if (event.getAction() == KeyEvent.ACTION_DOWN) p.keys[button] = true;
            else if (event.getAction() == KeyEvent.ACTION_UP) p.keys[button] = false;
            publishPads(); return true;
        }
        return super.dispatchKeyEvent(event);
    }
    private static float axis(MotionEvent event, int axis) {
        float value = event.getAxisValue(axis);
        InputDevice.MotionRange range = event.getDevice() == null ? null : event.getDevice().getMotionRange(axis, event.getSource());
        return Math.abs(value) < Math.max(.12f, range == null ? 0 : range.getFlat()) ? 0 : value;
    }
    @Override public boolean dispatchGenericMotionEvent(MotionEvent event) {
        Pad p = ensurePad(event.getDeviceId());
        if (p != null && event.getAction() == MotionEvent.ACTION_MOVE) {
            lastPadId = event.getDeviceId();
            p.axes[0] = axis(event, MotionEvent.AXIS_X); p.axes[1] = axis(event, MotionEvent.AXIS_Y);
            InputDevice dev = event.getDevice();
            boolean zr = dev != null && dev.getMotionRange(MotionEvent.AXIS_Z, event.getSource()) != null && dev.getMotionRange(MotionEvent.AXIS_RZ, event.getSource()) != null;
            p.axes[2] = axis(event, zr ? MotionEvent.AXIS_Z : MotionEvent.AXIS_RX);
            p.axes[3] = axis(event, zr ? MotionEvent.AXIS_RZ : MotionEvent.AXIS_RY);
            p.hatX = event.getAxisValue(MotionEvent.AXIS_HAT_X); p.hatY = event.getAxisValue(MotionEvent.AXIS_HAT_Y);
            p.lt = Math.max(event.getAxisValue(MotionEvent.AXIS_LTRIGGER), event.getAxisValue(MotionEvent.AXIS_BRAKE));
            p.rt = Math.max(event.getAxisValue(MotionEvent.AXIS_RTRIGGER), event.getAxisValue(MotionEvent.AXIS_GAS));
            publishPads(); return true;
        }
        return super.dispatchGenericMotionEvent(event);
    }

    @SuppressWarnings("deprecation")
    private void feedback(int duration, int amplitude) {
        if (feedbackMotor != null) feedbackMotor.cancel();
        if (duration <= 0) return;
        InputDevice device = InputDevice.getDevice(lastPadId);
        Vibrator motor = device == null ? null : device.getVibrator();
        if (motor == null || !motor.hasVibrator()) motor = (Vibrator)getSystemService(VIBRATOR_SERVICE);
        if (motor != null && motor.hasVibrator()) {
            feedbackMotor = motor;
            motor.vibrate(VibrationEffect.createOneShot(Math.min(duration, 80), Math.max(1, Math.min(amplitude, 120))));
        }
    }

    private final class Bridge {
        @JavascriptInterface public void setImmersive(boolean active) {
            if (trusted) ui.post(() -> { useImmersive = active; immersive(); });
        }
        @JavascriptInterface public void gameOrientation(boolean landscape) {
            if (trusted) ui.post(() -> setRequestedOrientation(landscape ? android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE : android.content.pm.ActivityInfo.SCREEN_ORIENTATION_FULL_USER));
        }
        @JavascriptInterface public void requestPads() { ui.post(MainActivity.this::publishPads); }
        @JavascriptInterface public void exit() { ui.post(() -> { if (loaded) web.evaluateJavascript("Boolean(window.Arcade?.inGame())", value -> { if ("true".equals(value)) js("window.Arcade.returnToCabinet()"); else confirmExit(); }); else confirmExit(); }); }
        @JavascriptInterface public void vibrate(int duration) {
            if (!trusted) return;
            rumble(duration, 64);
        }
        @JavascriptInterface public void rumble(int duration, int amplitude) {
            if (!trusted) return;
            ui.post(() -> { if (trusted && !isFinishing()) feedback(duration, amplitude); });
        }
    }
}
