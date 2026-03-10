package ru.studyfay.app

import android.content.Intent
import android.os.Bundle
import com.getcapacitor.BridgeActivity
import ru.rustore.sdk.pay.RuStorePayClient
import ru.rustore.sdk.pay.model.theme.SdkTheme

class MainActivity : BridgeActivity() {

    private lateinit var payPlugin: RuStorePayPlugin

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        RuStorePayClient.instance.getIntentInteractor()
            .proceedIntent(intent, sdkTheme = SdkTheme.LIGHT)

        bridge.webView.post {
            payPlugin = RuStorePayPlugin(this)
            bridge.webView.addJavascriptInterface(payPlugin, "RuStoreBilling")
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        RuStorePayClient.instance.getIntentInteractor()
            .proceedIntent(intent, sdkTheme = SdkTheme.LIGHT)
    }
}
