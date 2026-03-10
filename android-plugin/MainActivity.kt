package ru.studyfay.app

import android.content.Intent
import android.os.Bundle
import com.getcapacitor.BridgeActivity
import ru.rustore.sdk.pay.RuStorePayClient
import ru.rustore.sdk.pay.model.theme.SdkTheme

class MainActivity : BridgeActivity() {

    private lateinit var billingPlugin: RuStoreBillingPlugin

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        RuStorePayClient.instance.getIntentInteractor()
            .proceedIntent(intent, sdkTheme = SdkTheme.LIGHT)

        bridge.webView.post {
            billingPlugin = RuStoreBillingPlugin(this)
            bridge.webView.addJavascriptInterface(billingPlugin, "RuStoreBilling")
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        RuStorePayClient.instance.getIntentInteractor()
            .proceedIntent(intent, sdkTheme = SdkTheme.LIGHT)
    }
}
