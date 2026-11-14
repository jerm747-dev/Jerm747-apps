package com.jerm747.beatroom;

/** Stateful MIDI 1.0 stream decoder: split packets, running status and interleaved realtime. */
final class MidiStreamParser {
    interface Sink { void message(int status, int data1, int data2); }
    private final Sink sink;
    private int status, needed, used;
    private final int[] data = new int[2];
    MidiStreamParser(Sink sink) { this.sink = sink; }
    synchronized void send(byte[] bytes, int offset, int count) {
        for (int i = offset; i < offset + count; i++) {
            int b = bytes[i] & 255;
            if (b >= 0xf8) continue;
            if (b >= 0x80) {
                used = 0;
                if (b >= 0xf0) { status = 0; needed = 0; continue; }
                status = b;
                needed = ((b & 0xf0) == 0xc0 || (b & 0xf0) == 0xd0) ? 1 : 2;
            } else if (status != 0) {
                data[used++] = b;
                if (used == needed) {
                    sink.message(status, data[0], needed == 2 ? data[1] : 0);
                    used = 0;
                }
            }
        }
    }
}
