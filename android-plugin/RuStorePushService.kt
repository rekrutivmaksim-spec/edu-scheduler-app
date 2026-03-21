package ru.studyfay.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import ru.rustore.sdk.pushclient.messaging.RuStoreMessagingService
import ru.rustore.sdk.pushclient.messaging.model.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.net.HttpURLConnection
import java.net.URL

class RuStorePushService : RuStoreMessagingService() {

    companion object {
        private const val TAG = "RuStorePushService"
        private const val CHANNEL_ID = "studyfay_default"
        private const val CHANNEL_NAME = "Studyfay уведомления"
        private const val PREFS_NAME = "studyfay_prefs"
        private const val KEY_PUSH_TOKEN = "rustore_push_token"
        private const val KEY_AUTH_TOKEN = "auth_token"
        private const val BACKEND_URL = "https://app.studyfay.ru/api/push-notifications"
    }

    override fun onNewToken(token: String) {
        Log.d(TAG, "New RuStore push token: $token")
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_PUSH_TOKEN, token).apply()
        val authToken = prefs.getString(KEY_AUTH_TOKEN, null)
        if (!authToken.isNullOrEmpty()) {
            registerTokenOnBackend(token, authToken)
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        Log.d(TAG, "Push received: title=${message.notification?.title}")
        val title = message.notification?.title ?: "Studyfay"
        val body = message.notification?.body ?: ""
        val url = message.data?.get("url") ?: "/"
        showNotification(title, body, url)
    }

    private fun showNotification(title: String, body: String, url: String) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Уведомления от Studyfay"
                enableVibration(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("push_url", url)
        }

        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .build()

        notificationManager.notify(System.currentTimeMillis().toInt(), notification)
    }

    fun registerToken(pushToken: String, authToken: String) = registerTokenOnBackend(pushToken, authToken)

    private fun registerTokenOnBackend(pushToken: String, authToken: String) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val url = URL("$BACKEND_URL?action=subscribe_rustore")
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json")
                connection.setRequestProperty("Authorization", "Bearer $authToken")
                connection.doOutput = true

                val body = """{"rustore_token":"$pushToken"}"""
                connection.outputStream.write(body.toByteArray())

                val responseCode = connection.responseCode
                Log.d(TAG, "Token registered on backend: HTTP $responseCode")
                connection.disconnect()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to register token on backend: ${e.message}")
            }
        }
    }
}