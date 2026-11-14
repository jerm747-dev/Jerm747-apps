package com.jerm747.beatroom;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.os.Build;
import android.os.ParcelUuid;
import android.media.AudioManager;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.midi.MidiDevice;
import android.media.midi.MidiDeviceInfo;
import android.media.midi.MidiManager;
import android.media.midi.MidiOutputPort;
import android.media.midi.MidiReceiver;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import org.json.JSONArray;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Jerm747 Beat Room: a fullscreen WebView around the Beat Room web app (assets/index.html).
 *
 * The page is served from https://appassets.androidplatform.net so it runs as a secure origin
 * (AudioWorklet, microphone). Everything is offline except two optional extras when online:
 * the Google fonts and the MP3 encoder (cdnjs).
 *
 * What the WebView can't do on its own, the app does natively:
 *  - microphone: Android permission prompt, then grants the page's request
 *  - file picker: audio files and .mid files, several at once for the Sample bin
 *  - saving: BeatRoomAndroid.saveFile() opens Android's "Save to…" picker (WebView ignores downloads)
 *  - MIDI: Android WebView has no Web MIDI, so USB/Bluetooth MIDI is read with android.media.midi
 *    and every message goes to window.__beatRoomMidi(status, data1, data2)
 *  - Back: closes the page's pop-ups / full screen first (window.BeatRoom.back()), then offers to exit
 */
public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String ORIGIN = "https://" + HOST;
    private static final Set<String> ONLINE_EXTRAS = new LinkedHashSet<>(Arrays.asList(
            "fonts.googleapis.com", "fonts.gstatic.com", "cdnjs.cloudflare.com"));
    private static final int MIC_REQUEST = 71, OPEN_REQUEST = 72, SAVE_REQUEST = 73;

    private WebView web;
    private BluetoothLeScanner bleScanner;
    private ScanCallback bleCallback;
    private AlertDialog bleDialog;
    private final List<BluetoothDevice> bleFound = new ArrayList<>();
    private final Set<String> bleOpening = new LinkedHashSet<>();
    private volatile int midiGeneration = 0;
    private FrameLayout root;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private volatile boolean trusted = false;
    private boolean loaded = false;
    private PermissionRequest micRequest;
    private ValueCallback<Uri[]> fileResult;
    private byte[] pendingSave;

    // MIDI
    private MidiManager midi;
    private final List<MidiDevice> midiDevices = new ArrayList<>();
    private final List<MidiOutputPort> midiPorts = new ArrayList<>();
    private final Set<Integer> midiOpening = new LinkedHashSet<>();
    private final Map<Integer, String> midiNames = new HashMap<>();
    private MidiManager.DeviceCallback midiCallback;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        setVolumeControlStream(AudioManager.STREAM_MUSIC);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        root = new FrameLayout(this);
        root.setBackgroundColor(0xff10171b);
        setContentView(root);

        web = new WebView(this);
        web.setBackgroundColor(0xff10171b);
        web.setOnLongClickListener(v -> true);
        web.setHapticFeedbackEnabled(false);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // localStorage + IndexedDB: songs, samples, settings
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);         // the file picker hands back content:// files
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportMultipleWindows(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setUserAgentString(s.getUserAgentString() + " Jerm747BeatRoom/" + BuildConfig.VERSION_NAME);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        web.addJavascriptInterface(new Bridge(), "BeatRoomAndroid");

        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (isLocal(u)) return asset(u.getPath());
                String scheme = u.getScheme();
                if ("data".equals(scheme) || "blob".equals(scheme)) return null;
                if ("https".equals(scheme) && ONLINE_EXTRAS.contains(u.getHost())) return null; // fonts, MP3 encoder
                return text(403, "Offline content only");
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !isLocal(request.getUrl());
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                trusted = isLocal(Uri.parse(url));
                loaded = false;
            }
            @Override public void onPageFinished(WebView view, String url) { loaded = true; }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                if (!trusted || micRequest != null || !isLocal(request.getOrigin())
                        || !Arrays.asList(request.getResources()).contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                    request.deny();
                    return;
                }
                micRequest = request;
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) finishMicrophone(true);
                else requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MIC_REQUEST);
            }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) {
                if (micRequest == request) micRequest = null;
            }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> result, FileChooserParams params) {
                if (!trusted || fileResult != null) { result.onReceiveValue(null); return true; }
                fileResult = result;
                Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("*/*");
                pick.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes(params.getAcceptTypes()));
                if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try { startActivityForResult(pick, OPEN_REQUEST); }
                catch (ActivityNotFoundException e) { fileResult = null; result.onReceiveValue(null); }
                return true;
            }
        });

        web.loadUrl(ORIGIN + "/index.html?app=android");
    }

    // ---------- assets ----------
    private static boolean isLocal(Uri uri) { return uri != null && "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()); }

    private WebResourceResponse asset(String path) {
        if (path == null || !path.startsWith("/") || path.contains("..") || path.indexOf(0) >= 0 || path.contains("\\")) return text(404, "File not found");
        if (path.endsWith("/")) path += "index.html";
        try {
            InputStream data = getAssets().open(path.substring(1));
            String mime = URLConnection.guessContentTypeFromName(path);
            if (path.endsWith(".js") || path.endsWith(".mjs")) mime = "text/javascript";
            else if (path.endsWith(".css")) mime = "text/css";
            else if (path.endsWith(".html")) mime = "text/html";
            else if (path.endsWith(".json")) mime = "application/json";
            else if (path.endsWith(".svg")) mime = "image/svg+xml";
            else if (path.endsWith(".wav")) mime = "audio/wav";
            else if (path.endsWith(".webp")) mime = "image/webp";
            WebResourceResponse r = new WebResourceResponse(mime == null ? "application/octet-stream" : mime, mime != null && mime.startsWith("text/") ? "UTF-8" : null, data);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-cache");
            r.setResponseHeaders(headers);
            return r;
        } catch (IOException e) { return text(404, "File not found"); }
    }

    private static WebResourceResponse text(int status, String body) {
        return new WebResourceResponse("text/plain", "UTF-8", status, status == 404 ? "Not Found" : "Forbidden",
                new HashMap<>(), new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)));
    }

    private void js(String code) { if (web != null && loaded && !isFinishing()) web.evaluateJavascript(code, null); }

    /** Map the page's accept list (audio/*, .mid …) to Android MIME types for the document picker. */
    private static String[] mimeTypes(String[] accept) {
        Set<String> out = new LinkedHashSet<>();
        if (accept != null) for (String a : accept) for (String part : a.split(",")) {
            String t = part.trim().toLowerCase();
            if (t.isEmpty()) continue;
            if (t.equals(".mid") || t.equals(".midi") || t.contains("midi")) { out.add("audio/midi"); out.add("audio/x-midi"); out.add("audio/sp-midi"); out.add("application/x-midi"); }
            else if (t.startsWith(".")) { String m = URLConnection.guessContentTypeFromName("f" + t); if (m != null) out.add(m); }
            else out.add(t);
        }
        if (out.isEmpty()) out.add("*/*");
        return out.toArray(new String[0]);
    }

    // ---------- permissions + pickers ----------
    private void finishMicrophone(boolean allowed) {
        PermissionRequest request = micRequest;
        micRequest = null;
        if (request == null) return;
        if (allowed && trusted && !isFinishing()) request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        else request.deny();
    }

    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == 74) {
            boolean granted = results.length > 0;
            for (int value : results) granted &= value == PackageManager.PERMISSION_GRANTED;
            if (granted) bluetoothMidi();
            else new AlertDialog.Builder(this).setMessage("Bluetooth MIDI needs Nearby devices permission. You can still use USB MIDI.").setPositiveButton("OK", null).show();
        }
        if (code == MIC_REQUEST) finishMicrophone(results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED);
    }

    @Override protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code == OPEN_REQUEST && fileResult != null) {
            ValueCallback<Uri[]> callback = fileResult;
            fileResult = null;
            List<Uri> picked = new ArrayList<>();
            if (result == RESULT_OK && data != null) {
                ClipData clip = data.getClipData();
                if (clip != null) for (int i = 0; i < clip.getItemCount(); i++) picked.add(clip.getItemAt(i).getUri());
                else if (data.getData() != null) picked.add(data.getData());
            }
            List<Uri> safe = new ArrayList<>();
            for (Uri u : picked) if (u != null && "content".equals(u.getScheme())) safe.add(u);
            callback.onReceiveValue(safe.isEmpty() ? null : safe.toArray(new Uri[0]));
        } else if (code == SAVE_REQUEST) {
            byte[] bytes = pendingSave;
            pendingSave = null;
            boolean ok = false;
            Uri target = result == RESULT_OK && data != null ? data.getData() : null;
            if (bytes != null && target != null) {
                try (OutputStream o = getContentResolver().openOutputStream(target)) {
                    if (o != null) { o.write(bytes); ok = true; }
                } catch (IOException ignored) { }
            }
            js("window.__beatRoomSaved && window.__beatRoomSaved(" + ok + ")");
        }
    }

    // ---------- MIDI (USB and Bluetooth MIDI keyboards) ----------
    private MidiReceiver newMidiReceiver() {
        // A parser per port prevents running-status state from leaking across keyboards.
        final StringBuilder batch = new StringBuilder();
        MidiStreamParser parser = new MidiStreamParser((status, d1, d2) -> {
            if (batch.length() > 0) batch.append(',');
            batch.append('[').append(status).append(',').append(d1).append(',').append(d2).append(']');
        });
        return new MidiReceiver() {
            @Override public synchronized void onSend(byte[] msg, int offset, int count, long timestamp) {
                batch.setLength(0);
                parser.send(msg, offset, count);
                if (batch.length() == 0) return;
                final String code = "window.__beatRoomMidiBatch && window.__beatRoomMidiBatch([" + batch + "])";
                final int generation = midiGeneration;
                ui.post(() -> { if (generation == midiGeneration) js(code); });
            }
        };
    }

    @SuppressWarnings("deprecation")
    private void midiConnect() {
        if (!getPackageManager().hasSystemFeature(PackageManager.FEATURE_MIDI)) { publishMidiDevices(); return; }
        if (midi == null) midi = (MidiManager) getSystemService(Context.MIDI_SERVICE);
        if (midi == null) { publishMidiDevices(); return; }
        if (midiCallback == null) {
            midiCallback = new MidiManager.DeviceCallback() {
                @Override public void onDeviceAdded(MidiDeviceInfo info) { openMidi(info); }
                @Override public void onDeviceRemoved(MidiDeviceInfo info) { midiNames.remove(info.getId());
                    for (MidiDevice device : new ArrayList<>(midiDevices)) {
                        if (device.getInfo().getId() == info.getId()) {
                            try { device.close(); } catch (IOException ignored) { }
                            midiDevices.remove(device);
                        }
                    }
                    js("window.__beatRoomMidiPanic && window.__beatRoomMidiPanic()");
                    publishMidiDevices(); }
            };
            midi.registerDeviceCallback(midiCallback, ui);
        }
        for (MidiDeviceInfo info : midi.getDevices()) openMidi(info);
        publishMidiDevices();
    }

    @SuppressWarnings("deprecation")
    private void openMidi(MidiDeviceInfo info) {
        if (info.getOutputPortCount() == 0 || midiNames.containsKey(info.getId()) || midiOpening.contains(info.getId())) return;
        midiOpening.add(info.getId());
        final int generation = midiGeneration;
        midi.openDevice(info, device -> {
            midiOpening.remove(info.getId());
            if (device == null) return;
            if (isFinishing() || generation != midiGeneration) { try { device.close(); } catch (IOException ignored) { } return; }
            midiDevices.add(device);
            for (int p = 0; p < info.getOutputPortCount(); p++) {
                MidiOutputPort port = device.openOutputPort(p);
                if (port != null) { port.connect(newMidiReceiver()); midiPorts.add(port); }
            }
            Bundle props = info.getProperties();
            String name = props.getString(MidiDeviceInfo.PROPERTY_NAME);
            if (name == null) name = props.getString(MidiDeviceInfo.PROPERTY_PRODUCT);
            midiNames.put(info.getId(), name == null ? "MIDI keyboard" : name);
            publishMidiDevices();
        }, ui); // device callbacks on the main thread; note data arrives on MIDI's own thread (midiIn)
    }

    private void publishMidiDevices() {
        JSONArray names = new JSONArray();
        for (String n : midiNames.values()) names.put(n);
        ui.post(() -> js("window.__beatRoomMidiDevices && window.__beatRoomMidiDevices(" + names + ")"));
    }

    private void midiDisconnect() {
        midiGeneration++;
        stopBleScan();
        if (bleDialog != null) bleDialog.dismiss();
        bleOpening.clear();
        for (MidiOutputPort port : midiPorts) { try { port.close(); } catch (IOException ignored) { } }
        midiPorts.clear();
        for (MidiDevice d : midiDevices) { try { d.close(); } catch (IOException ignored) { } }
        midiDevices.clear();
        midiNames.clear();
        midiOpening.clear();
        if (midi != null && midiCallback != null) midi.unregisterDeviceCallback(midiCallback);
        midiCallback = null;
    }

    // Scan only when requested, with the standard BLE MIDI service filter.
    private void stopBleScan() {
        if (bleScanner != null && bleCallback != null) {
            try { bleScanner.stopScan(bleCallback); } catch (SecurityException ignored) { }
        }
        bleCallback = null;
        bleScanner = null;
    }

    private void bluetoothMidi() {
        String[] permissions = Build.VERSION.SDK_INT >= 31
                ? new String[]{Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT}
                : new String[]{Manifest.permission.ACCESS_FINE_LOCATION};
        for (String permission : permissions) {
            if (checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(permissions, 74); return;
            }
        }
        midiConnect();
        if (midi == null) return;
        BluetoothManager manager = (BluetoothManager) getSystemService(BLUETOOTH_SERVICE);
        BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            new AlertDialog.Builder(this).setMessage("Turn on Bluetooth in Android settings, then try Bluetooth MIDI again.").setPositiveButton("OK", null).show();
            return;
        }
        stopBleScan();
        bleFound.clear();
        final android.widget.ArrayAdapter<String> items = new android.widget.ArrayAdapter<>(this, android.R.layout.simple_list_item_1);
        bleDialog = new AlertDialog.Builder(this).setTitle("Bluetooth MIDI · searching…")
                .setAdapter(items, (dialog, which) -> {
                    BluetoothDevice target = bleFound.get(which);
                    stopBleScan();
                    String address = target.getAddress();
                    if (!bleOpening.add(address)) return;
                    final int generation = midiGeneration;
                    try { midi.openBluetoothDevice(target, device -> {
                        bleOpening.remove(address);
                        if (device == null) {
                            if (!isFinishing()) new AlertDialog.Builder(this).setMessage("Could not connect this MIDI device. Wake it and try again.").setPositiveButton("OK", null).show();
                            return;
                        }
                        if (isFinishing() || generation != midiGeneration) {
                            try { device.close(); } catch (IOException ignored) { }
                            return;
                        }
                        midiDevices.add(device); // holds the BLE connection until MIDI disconnect
                        openMidi(device.getInfo());
                    }, ui); } catch (SecurityException | IllegalArgumentException error) {
                        bleOpening.remove(address);
                        new AlertDialog.Builder(this).setMessage("Bluetooth MIDI is unavailable. Check Nearby devices permission and try again.").setPositiveButton("OK", null).show();
                    }
                }).setNegativeButton("Cancel", null).create();
        bleDialog.setOnDismissListener(d -> stopBleScan());
        bleDialog.show();
        bleScanner = adapter.getBluetoothLeScanner();
        bleCallback = new ScanCallback() {
            @Override public void onScanResult(int callbackType, ScanResult result) {
                ui.post(() -> {
                    BluetoothDevice device = result.getDevice();
                    if (bleCallback == null || bleFound.contains(device)) return;
                    bleFound.add(device);
                    String name = result.getScanRecord() == null ? null : result.getScanRecord().getDeviceName();
                    if (name == null) name = "MIDI device " + device.getAddress();
                    items.add(name);
                });
            }
            @Override public void onScanFailed(int errorCode) {
                ui.post(() -> { stopBleScan(); if (bleDialog != null) bleDialog.setTitle("Scan failed · try again"); });
            }
        };
        try {
        if (bleScanner != null) bleScanner.startScan(
                java.util.Collections.singletonList(new ScanFilter.Builder().setServiceUuid(ParcelUuid.fromString("03b80e5a-ede8-4b33-a751-6ce34ec4c700")).build()),
                new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(), bleCallback);
        else { stopBleScan(); bleDialog.setTitle("Bluetooth scanner unavailable"); return; }
        } catch (SecurityException | IllegalStateException error) {
            stopBleScan(); bleDialog.setTitle("Bluetooth unavailable · check settings"); return;
        }
        final ScanCallback scan = bleCallback;
        ui.postDelayed(() -> {
            if (bleCallback != scan) return;
            stopBleScan();
            if (bleDialog != null) bleDialog.setTitle(bleFound.isEmpty() ? "No MIDI devices · wake device and retry" : "Choose MIDI keyboard");
        }, 8000);
    }

    // ---------- lifecycle ----------
    @Override protected void onPause() {
        stopBleScan();
        js("window.__beatRoomMidiPanic && window.__beatRoomMidiPanic()");
        if (web != null && fileResult == null && pendingSave == null && micRequest == null) { web.onPause(); web.pauseTimers(); }
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if (web != null) { web.resumeTimers(); web.onResume(); }
    }
    @Override protected void onDestroy() {
        finishMicrophone(false);
        if (fileResult != null) { fileResult.onReceiveValue(null); fileResult = null; }
        midiDisconnect();
        if (web != null) { web.removeJavascriptInterface("BeatRoomAndroid"); root.removeView(web); web.destroy(); web = null; }
        super.onDestroy();
    }

    /** Back closes the top pop-up or full-screen section first; with nothing open, it asks before leaving. */
    @SuppressWarnings("deprecation")
    @Override public void onBackPressed() {
        if (!loaded || web == null) { super.onBackPressed(); return; }
        web.evaluateJavascript("Boolean(window.BeatRoom && window.BeatRoom.back())", handled -> {
            if (!"true".equals(handled)) confirmExit();
        });
    }

    private void confirmExit() {
        new AlertDialog.Builder(this)
                .setTitle("Leave Beat Room?")
                .setMessage("Your songs, samples and settings stay saved on this phone.")
                .setPositiveButton("Exit", (d, w) -> finish())
                .setNegativeButton("Stay", null)
                .show();
    }

    // ---------- the page's bridge ----------
    private final class Bridge {
        /** Save a file the page made (bounce, MIDI): Android's "Save to…" picker, then __beatRoomSaved(ok). */
        @JavascriptInterface public void saveFile(String name, String mime, String base64) {
            if (!trusted) return;
            final byte[] bytes;
            try { bytes = Base64.decode(base64, Base64.DEFAULT); }
            catch (IllegalArgumentException e) { ui.post(() -> js("window.__beatRoomSaved && window.__beatRoomSaved(false)")); return; }
            ui.post(() -> {
                pendingSave = bytes;
                Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                save.addCategory(Intent.CATEGORY_OPENABLE);
                save.setType(mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
                save.putExtra(Intent.EXTRA_TITLE, name);
                try { startActivityForResult(save, SAVE_REQUEST); }
                catch (ActivityNotFoundException e) { pendingSave = null; js("window.__beatRoomSaved && window.__beatRoomSaved(false)"); }
            });
        }
        @JavascriptInterface public void midiBluetooth() { if (trusted) ui.post(MainActivity.this::bluetoothMidi); }
        @JavascriptInterface public void midiConnect() { if (trusted) ui.post(MainActivity.this::midiConnect); }
        @JavascriptInterface public void midiDisconnect() { if (trusted) ui.post(MainActivity.this::midiDisconnect); }
        @JavascriptInterface public void leaveTitle() { if (trusted) ui.post(MainActivity.this::confirmExit); }
        @JavascriptInterface public String version() { return BuildConfig.VERSION_NAME; }
    }
}
