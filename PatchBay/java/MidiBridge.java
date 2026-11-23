package com.jerm747.patchbay;

import android.media.midi.*;
import android.os.Handler;
import android.webkit.JavascriptInterface;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;
import org.json.JSONArray;
import org.json.JSONObject;

public final class MidiBridge extends MidiManager.DeviceCallback {
    private final MidiManager manager;
    private final Handler main;
    private final Consumer<String> evaluate;
    private final Map<Integer, MidiDevice> devices = new HashMap<>();
    private final Map<String, MidiInputPort> sends = new HashMap<>();
    private final Map<String, MidiOutputPort> receives = new HashMap<>();
    private final AtomicInteger generation = new AtomicInteger();

    MidiBridge(MidiManager manager, Handler main, Consumer<String> evaluate) {
        this.manager = manager;
        this.main = main;
        this.evaluate = evaluate;
    }

    @JavascriptInterface public String ports() {
        JSONArray result = new JSONArray();
        if (manager == null) return result.toString();
        for (MidiDeviceInfo device : manager.getDevices()) {
            String name = device.getProperties().getString(MidiDeviceInfo.PROPERTY_NAME, "MIDI device");
            String manufacturer = device.getProperties().getString(MidiDeviceInfo.PROPERTY_MANUFACTURER, "");
            for (MidiDeviceInfo.PortInfo port : device.getPorts()) {
                try {
                    boolean receives = port.getType() == MidiDeviceInfo.PortInfo.TYPE_OUTPUT;
                    int number = port.getPortNumber();
                    result.put(new JSONObject()
                        .put("id", device.getId() + ":" + (receives ? "in" : "out") + ":" + number)
                        .put("type", receives ? "input" : "output")
                        .put("name", name + (number == 0 ? "" : " / " + (number + 1)))
                        .put("manufacturer", manufacturer));
                } catch (org.json.JSONException ex) { throw new IllegalStateException(ex); }
            }
        }
        return result.toString();
    }

    @JavascriptInterface public boolean available() { return manager != null; }

    @JavascriptInterface public void listen(String id) {
        int session = generation.get();
        main.post(() -> openPort(id, session, (device, number) -> {
            if (receives.containsKey(id)) return;
            MidiOutputPort output = device.openOutputPort(number);
            if (output == null) return;
            receives.put(id, output);
            output.connect(new MidiReceiver() {
                @Override public void onSend(byte[] data, int offset, int length, long timestamp) {
                    JSONArray chunk = new JSONArray();
                    for (int i = offset; i < offset + length; i++) chunk.put(data[i] & 255);
                    main.post(() -> {
                        if (generation.get() == session) evaluate.accept(
                            "window.rackMidiBytes?.(" + JSONObject.quote(id) + "," + chunk + ")");
                    });
                }
            });
        }));
    }

    @JavascriptInterface public void send(String id, String json, double delayMs) {
        int session = generation.get();
        try {
            JSONArray raw = new JSONArray(json);
            byte[] bytes = new byte[raw.length()];
            for (int i = 0; i < bytes.length; i++) bytes[i] = (byte) raw.getInt(i);
            long timestamp = System.nanoTime() + (long) (Math.max(0, delayMs) * 1_000_000);
            main.post(() -> openPort(id, session, (device, number) -> {
                MidiInputPort port = sends.get(id);
                if (port == null) {
                    port = device.openInputPort(number);
                    if (port != null) sends.put(id, port);
                }
                if (port != null) try { port.send(bytes, 0, bytes.length, timestamp); }
                catch (IOException ex) { close(sends.remove(id)); }
            }));
        } catch (org.json.JSONException ignored) { }
    }

    private interface PortAction { void run(MidiDevice device, int number); }

    private void openPort(String id, int session, PortAction action) {
        if (manager == null || generation.get() != session) return;
        String[] parts = id.split(":");
        if (parts.length != 3) return;
        try {
            int deviceId = Integer.parseInt(parts[0]);
            int number = Integer.parseInt(parts[2]);
            MidiDevice existing = devices.get(deviceId);
            if (existing != null) { action.run(existing, number); return; }
            for (MidiDeviceInfo info : manager.getDevices()) {
                if (info.getId() != deviceId) continue;
                manager.openDevice(info, opened -> {
                    if (opened == null) return;
                    if (generation.get() != session) { close(opened); return; }
                    MidiDevice active = devices.get(deviceId);
                    if (active == null) { active = opened; devices.put(deviceId, opened); }
                    else if (active != opened) close(opened);
                    action.run(active, number);
                }, main);
                return;
            }
        } catch (IllegalArgumentException ignored) { }
    }

    @Override public void onDeviceAdded(MidiDeviceInfo info) { changed(); }

    @Override public void onDeviceRemoved(MidiDeviceInfo info) {
        String prefix = info.getId() + ":";
        sends.entrySet().removeIf(entry -> {
            if (!entry.getKey().startsWith(prefix)) return false;
            close(entry.getValue());
            return true;
        });
        receives.entrySet().removeIf(entry -> {
            if (!entry.getKey().startsWith(prefix)) return false;
            close(entry.getValue());
            return true;
        });
        close(devices.remove(info.getId()));
        changed();
    }

    private void changed() { evaluate.accept("window.rackMidiChanged?.()"); }

    void reset() {
        generation.incrementAndGet();
        sends.values().forEach(MidiBridge::close);
        receives.values().forEach(MidiBridge::close);
        devices.values().forEach(MidiBridge::close);
        sends.clear();
        receives.clear();
        devices.clear();
    }

    private static void close(java.io.Closeable item) {
        if (item != null) try { item.close(); } catch (IOException ignored) { }
    }
}
