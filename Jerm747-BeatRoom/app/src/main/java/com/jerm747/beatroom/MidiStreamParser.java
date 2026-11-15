package com.jerm747.beatroom;

/** Stateful MIDI 1.0 stream decoder: split packets, running status and interleaved realtime.
 *  Transport: realtime Start (FA), Continue (FB) and Stop (FC) pass through as one-byte messages;
 *  an MMC command (F0 7F id 06 cmd F7) is passed on as status F0 with the command in data1. */
final class MidiStreamParser {
    interface Sink { void message(int status, int data1, int data2); }
    private final Sink sink;
    private int status, needed, used;
    private final int[] data = new int[2];
    private final int[] sx = new int[6];
    private int sxLen = -1; // -1 when not inside a sysex message
    MidiStreamParser(Sink sink) { this.sink = sink; }
    synchronized void send(byte[] bytes, int offset, int count) {
        for (int i = offset; i < offset + count; i++) {
            int b = bytes[i] & 255;
            if (b >= 0xf8) {
                if (b == 0xfa || b == 0xfb || b == 0xfc) sink.message(b, 0, 0);
                continue;
            }
            if (sxLen >= 0 && b < 0x80) { if (sxLen < sx.length) sx[sxLen] = b; sxLen++; continue; }
            if (b == 0xf7) {
                if (sxLen == 4 && sx[0] == 0x7f && sx[2] == 0x06) sink.message(0xf0, sx[3], 0);
                sxLen = -1; continue;
            }
            if (b >= 0x80) {
                used = 0; sxLen = -1;
                if (b == 0xf0) { status = 0; needed = 0; sxLen = 0; continue; }
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
