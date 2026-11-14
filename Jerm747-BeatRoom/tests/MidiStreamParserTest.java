package com.jerm747.beatroom;
import java.util.*;
public class MidiStreamParserTest {
    public static void main(String[] args) {
        List<String> got = new ArrayList<>();
        MidiStreamParser p = new MidiStreamParser((s,a,b) -> got.add(s+":"+a+":"+b));
        p.send(new byte[]{(byte)0x90,60},0,2); // split note
        p.send(new byte[]{100,64,(byte)0xf8,110,67,120},0,6); // running status, realtime
        p.send(new byte[]{(byte)0xc0,5,6,(byte)0xf0,1,2,(byte)0xf7,7,(byte)0x80,60,0},0,11);
        List<String> want = Arrays.asList("144:60:100","144:64:110","144:67:120","192:5:0","192:6:0","128:60:0");
        if (!got.equals(want)) throw new AssertionError(got.toString());
        List<String> other = new ArrayList<>();
        MidiStreamParser q = new MidiStreamParser((s,a,b)->other.add(s+":"+a+":"+b));
        q.send(new byte[]{60,100},0,2);
        if (!other.isEmpty()) throw new AssertionError("Running status leaked across ports");
        System.out.println("PASS: split packets, running status, realtime, program change, SysEx skip, port isolation");
    }
}
