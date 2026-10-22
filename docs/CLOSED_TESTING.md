# Closed testing tracker

Google Play requires a new personal developer account to run a closed test with
at least **12 testers opted in for 14 days in a row** before an app can go to
production. Play Console does not report which testers actually open the app,
so each app reports it itself, and the panel at
**https://pickixo.com/dashboard/testers** (admin accounts only) shows it.

## Pieces

| Piece | Where |
|---|---|
| Tables + seed (apps, 21 testers) | `database/schema/024_closed_testing.sql` |
| API | `apps/api/app/routers/testing.py` |
| Panel | `apps/web/src/app/(app)/dashboard/testers/page.tsx` |

The heartbeat (`POST /api/testing/heartbeat`) is public; every other route needs
an admin session.

## Adding the heartbeat to an app

Add this file to the app (no extra dependencies), then call
`TesterHeartbeat.send(this)` from `MainActivity.onCreate` — or from
`Application.onCreate` if the app has one.

```kotlin
package com.example.app   // ← the app's own package

import android.content.Context
import android.os.Build
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import kotlin.concurrent.thread
import org.json.JSONObject

/** Tells pickixo.com that this install was opened today (closed-test tracking). */
object TesterHeartbeat {
    private const val ENDPOINT = "https://pickixo.com/api/testing/heartbeat"

    /** [email] is optional: pass the signed-in Google account if the app has one. */
    fun send(context: Context, email: String? = null) {
        val app = context.applicationContext
        val prefs = app.getSharedPreferences("tester_heartbeat", Context.MODE_PRIVATE)
        val installId = prefs.getString("install_id", null)
            ?: UUID.randomUUID().toString().replace("-", "").also {
                prefs.edit().putString("install_id", it).apply()
            }
        val version = try {
            app.packageManager.getPackageInfo(app.packageName, 0).versionName ?: ""
        } catch (e: Exception) { "" }

        val body = JSONObject()
            .put("package", app.packageName)
            .put("install_id", installId)
            .put("device", "${Build.MANUFACTURER} ${Build.MODEL}".take(100))
            .put("app_version", version.take(40))
        if (!email.isNullOrBlank()) body.put("email", email)

        thread(isDaemon = true) {
            try {
                val conn = URL(ENDPOINT).openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.connectTimeout = 10_000
                conn.readTimeout = 10_000
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json")
                conn.outputStream.use { it.write(body.toString().toByteArray()) }
                conn.responseCode   // send it; the answer does not matter
                conn.disconnect()
            } catch (e: Exception) {
                // Offline or blocked: skip. Never let tracking crash the app.
            }
        }
    }
}
```

The app needs `<uses-permission android:name="android.permission.INTERNET" />`
in its manifest (most already have it).

### Privacy policy

The heartbeat sends the package name, a random install id, the device model and
the app version (plus the email, if the app passes one). Add a line about it to
the app's privacy policy page under `apps/web/public/<app>/`, e.g. *"During
testing, the app sends an anonymous install id, device model and app version to
pickixo.com once a day to count active testers."* Remove the call from the
production release if you do not want it there.

### Linking installs to testers

* Apps with Google sign-in: pass the account email to `send(...)`. If it is on
  the tester list, the install is linked automatically.
* Apps without sign-in: the install appears as **Unlinked** in the panel. Ask the
  tester which device they use and pick their email from the dropdown on that
  row.

## Adding testers

Paste emails (or upload a CSV) in the panel's *Add testers* box. They also have
to be on the Play Console email list: **Download CSV for Play Console** gives
one address per line, which is the format Play Console's *Upload CSV file*
accepts.

## Applying the migration

```powershell
C:\Pickixo\pgsql\bin\psql.exe -h 127.0.0.1 -U pickixo_admin -d pickixo `
  -v ON_ERROR_STOP=1 -f database\schema\024_closed_testing.sql
```

Then restart the API so it loads the new router, and rebuild the web app.
