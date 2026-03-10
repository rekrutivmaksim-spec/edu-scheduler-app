package ru.studyfay.app

import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.getcapacitor.BridgeActivity
import org.json.JSONObject
import ru.rustore.sdk.pay.RuStorePayClient
import ru.rustore.sdk.pay.model.product.ProductId
import ru.rustore.sdk.pay.model.purchase.ProductPurchaseParams
import ru.rustore.sdk.pay.model.purchase.PurchaseAvailabilityResult
import ru.rustore.sdk.pay.model.theme.SdkTheme

class RuStoreBillingPlugin(private val activity: BridgeActivity) {

    companion object {
        private const val TAG = "RuStoreBilling"
    }

    private var available = false
    private var initError: String? = null

    init {
        checkAvailability()
    }

    private fun checkAvailability() {
        try {
            RuStorePayClient.instance.getPurchaseInteractor()
                .getPurchaseAvailability()
                .addOnSuccessListener { result ->
                    when (result) {
                        is PurchaseAvailabilityResult.Available -> {
                            available = true
                            Log.d(TAG, "RuStore Pay available")
                        }
                        is PurchaseAvailabilityResult.Unavailable -> {
                            available = false
                            initError = result.cause.toString()
                            Log.w(TAG, "RuStore Pay unavailable: ${result.cause}")
                        }
                    }
                }
                .addOnFailureListener { error ->
                    available = false
                    initError = error.message
                    Log.e(TAG, "RuStore Pay check failed: ${error.message}")
                }
        } catch (e: Exception) {
            available = false
            initError = e.message
            Log.e(TAG, "RuStore Pay init error: ${e.message}")
        }
    }

    @JavascriptInterface
    fun isAvailable(): Boolean {
        Log.d(TAG, "isAvailable=$available initError=$initError")
        return available
    }

    @JavascriptInterface
    fun getInitError(): String {
        return initError ?: ""
    }

    @JavascriptInterface
    fun purchase(productId: String) {
        Log.d(TAG, "purchase called: productId=$productId")

        if (!available) {
            Log.e(TAG, "Pay not available, initError=$initError")
            sendResultToWeb(false, null, productId, "Pay not available: $initError")
            return
        }

        activity.runOnUiThread {
            try {
                val params = ProductPurchaseParams(
                    productId = ProductId(productId),
                    quantity = 1
                )

                RuStorePayClient.instance.getPurchaseInteractor()
                    .purchase(
                        params = params,
                        sdkTheme = SdkTheme.LIGHT
                    )
                    .addOnSuccessListener { result ->
                        val purchaseId = result.purchaseId
                        val token = result.purchaseToken
                        Log.d(TAG, "Purchase success: productId=$productId purchaseId=$purchaseId")
                        sendResultToWeb(true, token ?: purchaseId, productId, null)
                    }
                    .addOnFailureListener { error ->
                        val msg = error.message ?: "Ошибка покупки"
                        Log.e(TAG, "Purchase failed: $msg", error)
                        sendResultToWeb(false, null, productId, msg)
                    }
            } catch (e: Exception) {
                Log.e(TAG, "Purchase exception: ${e.message}", e)
                sendResultToWeb(false, null, productId, e.message)
            }
        }
    }

    @JavascriptInterface
    fun getProducts(productIdsJson: String): String {
        return "[]"
    }

    @JavascriptInterface
    fun getPurchases(): String {
        return "[]"
    }

    @JavascriptInterface
    fun confirmPurchase(purchaseId: String) {
        Log.d(TAG, "confirmPurchase called (no-op in new SDK): $purchaseId")
    }

    private fun sendResultToWeb(success: Boolean, purchaseToken: String?, productId: String?, error: String?) {
        try {
            val result = JSONObject().apply {
                put("success", success)
                purchaseToken?.let { put("purchaseToken", it) }
                productId?.let { put("productId", it) }
                error?.let { put("error", it) }
            }

            val js = "if(window.onRuStorePurchaseResult){window.onRuStorePurchaseResult('${
                result.toString().replace("'", "\\'")
            }')}"

            activity.runOnUiThread {
                try {
                    val webView: WebView = activity.bridge.webView
                    webView.evaluateJavascript(js, null)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to send result to web: ${e.message}")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to build result JSON: ${e.message}")
        }
    }
}
