package ru.studyfay.app

import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.getcapacitor.BridgeActivity
import org.json.JSONObject
import ru.rustore.sdk.pay.RuStorePayClient
import ru.rustore.sdk.pay.model.product.ProductId
import ru.rustore.sdk.pay.model.purchase.ProductPurchaseParams
import ru.rustore.sdk.pay.model.purchase.PreferredPurchaseType
import ru.rustore.sdk.pay.model.purchase.PurchaseAvailabilityResult
import ru.rustore.sdk.pay.model.theme.SdkTheme

class RuStorePayPlugin(private val activity: BridgeActivity) {

    companion object {
        private const val TAG = "RuStorePay"
    }

    private var initError: String? = null
    private var isAvailable = false

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
                            isAvailable = true
                            Log.d(TAG, "RuStore Pay available")
                        }
                        is PurchaseAvailabilityResult.Unavailable -> {
                            isAvailable = false
                            initError = result.cause.toString()
                            Log.w(TAG, "RuStore Pay unavailable: ${result.cause}")
                        }
                    }
                }
                .addOnFailureListener { error ->
                    isAvailable = false
                    initError = error.message
                    Log.e(TAG, "RuStore Pay availability check failed: ${error.message}")
                }
        } catch (e: Exception) {
            isAvailable = false
            initError = e.message
            Log.e(TAG, "RuStore Pay init error: ${e.message}")
        }
    }

    @JavascriptInterface
    fun isAvailable(): Boolean {
        Log.d(TAG, "isAvailable=$isAvailable" + if (initError != null) " initError=$initError" else "")
        return isAvailable
    }

    @JavascriptInterface
    fun getInitError(): String {
        return initError ?: ""
    }

    @JavascriptInterface
    fun purchase(productId: String) {
        Log.d(TAG, "purchase called: productId=$productId")

        if (!isAvailable) {
            Log.e(TAG, "Pay not available, initError=$initError")
            sendResultToWeb(false, null, productId, "RuStore Pay недоступен: $initError")
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
                        preferredPurchaseType = PreferredPurchaseType.ONE_STEP,
                        sdkTheme = SdkTheme.LIGHT
                    )
                    .addOnSuccessListener { result ->
                        Log.d(TAG, "Purchase success for $productId, result=$result")
                        try {
                            val purchaseId = result.purchaseId
                            val token = result.purchaseToken
                            if (!purchaseId.isNullOrEmpty() || !token.isNullOrEmpty()) {
                                sendResultToWeb(true, token ?: purchaseId, productId, null)
                            } else {
                                fetchLatestPurchase(productId)
                            }
                        } catch (e: Exception) {
                            Log.w(TAG, "Could not read result fields, falling back to getPurchases: ${e.message}")
                            fetchLatestPurchase(productId)
                        }
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

    private fun fetchLatestPurchase(productId: String) {
        try {
            RuStorePayClient.instance.getPurchaseInteractor()
                .getPurchases()
                .addOnSuccessListener { purchases ->
                    val match = purchases
                        .filter { it.productId?.value == productId }
                        .maxByOrNull { it.purchaseId?.value ?: "" }

                    if (match != null) {
                        val purchaseId = match.purchaseId?.value ?: ""
                        Log.d(TAG, "Found purchase: $purchaseId for $productId")
                        sendResultToWeb(true, purchaseId, productId, null)
                    } else {
                        Log.d(TAG, "Purchase completed but not found in list for $productId")
                        sendResultToWeb(true, "", productId, null)
                    }
                }
                .addOnFailureListener { error ->
                    Log.e(TAG, "Failed to fetch purchases after buy: ${error.message}")
                    sendResultToWeb(true, "", productId, null)
                }
        } catch (e: Exception) {
            Log.e(TAG, "fetchLatestPurchase exception: ${e.message}")
            sendResultToWeb(true, "", productId, null)
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
        // В новом SDK ONE_STEP покупки подтверждаются автоматически
        Log.d(TAG, "confirmPurchase called for $purchaseId (ONE_STEP — auto-confirmed)")
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