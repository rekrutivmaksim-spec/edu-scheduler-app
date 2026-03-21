package ru.studyfay.app

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import com.getcapacitor.BridgeActivity
import ru.rustore.sdk.pay.RuStorePayClient
import ru.rustore.sdk.pay.model.theme.SdkTheme
import ru.rustore.sdk.pushclient.RuStorePushClient

class MainActivity : BridgeActivity() {

    companion object {
        private const val TAG = "MainActivity"
        private const val PREFS_NAME = "studyfay_prefs"
        private const val KEY_PUSH_TOKEN = "rustore_push_token"
        private const val KEY_AUTH_TOKEN = "auth_token"
    }

    private lateinit var billingPlugin: RuStoreBillingPlugin

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        RuStorePayClient.instance.getIntentInteractor()
            .proceedIntent(intent, sdkTheme = SdkTheme.LIGHT)

        initRuStorePush()

        bridge.webView.post {
            billingPlugin = RuStoreBillingPlugin(this)
            bridge.webView.addJavascriptInterface(billingPlugin, "RuStoreBilling")
            bridge.webView.addJavascriptInterface(PushBridge(), "RuStorePush")
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        RuStorePayClient.instance.getIntentInteractor()
            .proceedIntent(intent, sdkTheme = SdkTheme.LIGHT)
    }

    private fun initRuStorePush() {
        try {
            RuStorePushClient.init(
                application = application,
                projectId = "2063697825",
                testModeEnabled = false
            )
            Log.d(TAG, "RuStore Push SDK initialized")

            RuStorePushClient.getToken()
                .addOnSuccessListener { token ->
                    Log.d(TAG, "Push token: $token")
                    val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    prefs.edit().putString(KEY_PUSH_TOKEN, token).apply()
                }
                .addOnFailureListener { error ->
                    Log.e(TAG, "Failed to get push token: ${error.message}")
                }
        } catch (e: Exception) {
            Log.e(TAG, "RuStore Push init error: ${e.message}")
        }
    }

    inner class PushBridge {

        @android.webkit.JavascriptInterface
        fun getToken(): String {
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            return prefs.getString(KEY_PUSH_TOKEN, "") ?: ""
        }

        @android.webkit.JavascriptInterface
        fun saveAuthToken(authToken: String) {
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(KEY_AUTH_TOKEN, authToken).apply()
            val pushToken = prefs.getString(KEY_PUSH_TOKEN, null)
            if (!pushToken.isNullOrEmpty()) {
                (application as? android.app.Application)?.let {
                    val service = RuStorePushService()
                }
            }
        }
    }
}
