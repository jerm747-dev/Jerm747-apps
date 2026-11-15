package com.jerm747.arcade;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import java.io.OutputStream;

/** Saves Beat Room files (songs, MIDI, projects) straight into Download/Beat Room, with no picker.
 *  Android 10+ writes there through MediaStore without any storage permission; music players
 *  still find the audio. Older Android returns null so the caller can use the Save-to picker. */
final class BeatRoomFolder {
    static final String FOLDER = "Beat Room";
    private BeatRoomFolder() { }

    /** Writes the file and returns where it went, e.g. "Download/Beat Room/My loop.mp3", or null. */
    static String save(Context context, String name, String mime, byte[] bytes) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || bytes == null) return null;
        String safe = name == null || name.trim().isEmpty() ? "Beat Room file" : name.replaceAll("[\\\\/:*?\"<>|]+", "").trim();
        ContentResolver resolver = context.getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, safe);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, "Download/" + FOLDER + "/");
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);
        Uri uri = null;
        try {
            uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) return null;
            try (OutputStream out = resolver.openOutputStream(uri)) {
                if (out == null) throw new java.io.IOException("no stream");
                out.write(bytes);
            }
            ContentValues done = new ContentValues();
            done.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(uri, done, null, null);
            // Android may add " (1)" when the name is taken; report the name it actually used.
            String used = safe;
            try (android.database.Cursor c = resolver.query(uri, new String[]{MediaStore.MediaColumns.DISPLAY_NAME}, null, null, null)) {
                if (c != null && c.moveToFirst()) used = c.getString(0);
            } catch (RuntimeException ignored) { }
            return "Download/" + FOLDER + "/" + used;
        } catch (Exception e) {
            if (uri != null) try { resolver.delete(uri, null, null); } catch (RuntimeException ignored) { }
            return null;
        }
    }

    /** A JavaScript string literal for the result. */
    static String quote(String s) {
        if (s == null) return "null";
        return "'" + s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ") + "'";
    }
}
