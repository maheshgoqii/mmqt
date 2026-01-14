package com.nativemqtt

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.eclipse.paho.android.service.MqttAndroidClient
import org.eclipse.paho.client.mqttv3.*
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence

class NativeMQTTModule(reactContext: ReactApplicationContext) : NativeMQTTSpec(reactContext) {

  override fun getName() = NAME

  companion object {
    const val NAME = "NativeMQTT"
    private const val TAG = "NativeMQTT"

    // STATIC SINGLETON: Prevent multiple clients in the same process (even across reloads)
    @set:Synchronized @get:Synchronized private var mqttClient: MqttAndroidClient? = null

    @set:Synchronized @get:Synchronized private var activeCallback: MqttCallbackExtended? = null

    private var currentClientId: String? = null
    private var currentServerUri: String? = null
    private var currentOptions: MqttConnectOptions? = null
  }

  // Local instance references for easier access
  private var internalMqttClient: MqttAndroidClient?
    get() = mqttClient
    set(value) {
      mqttClient = value
    }

  /** Initialize MQTT client with configuration */
  override fun initialize(
          config: ReadableMap,
          sslConfig: ReadableMap?,
          willConfig: ReadableMap?,
          promise: Promise
  ) {
    try {
      // Parse required config
      val mClientId = config.getString("clientId") ?: throw Exception("clientId is required")
      val host = config.getString("host") ?: throw Exception("host is required")
      val port = config.getInt("port")
      val protocol = config.getString("protocol") ?: "tcp"

      // Build server URI
      val newServerUri =
              when (protocol) {
                "ssl", "tls" -> "ssl://$host:$port"
                "ws" -> "ws://$host:$port"
                "wss" -> "wss://$host:$port"
                else -> "tcp://$host:$port"
              }

      Log.d(TAG, "Initializing MQTT client: $newServerUri (clientId: $mClientId)")

      // CHECK FOR EXISTING STATIC CLIENT
      if (mqttClient != null && currentServerUri == newServerUri && currentClientId == mClientId) {
        Log.d(TAG, "Matching MQTT client already exists in process. Reusing instance.")

        // Refresh the callback to the current context's emitter
        setupCallback()

        promise.resolve(null)
        return
      }

      // CLEANUP PREVIOUS STATIC CLIENT
      cleanupClient()

      // Update static state
      currentServerUri = newServerUri
      currentClientId = mClientId

      // Create new MQTT client
      mqttClient =
              MqttAndroidClient(
                      reactApplicationContext
                              .applicationContext, // Use App context for service longevity
                      newServerUri,
                      mClientId!!,
                      MemoryPersistence()
              )

      // Setup connection options
      val options =
              MqttConnectOptions().apply {
                if (config.hasKey("username")) userName = config.getString("username")
                if (config.hasKey("password"))
                        password = config.getString("password")?.toCharArray()
                keepAliveInterval =
                        if (config.hasKey("keepAlive")) config.getInt("keepAlive") else 60
                isCleanSession =
                        if (config.hasKey("cleanSession")) config.getBoolean("cleanSession")
                        else true
                isAutomaticReconnect =
                        if (config.hasKey("reconnect")) config.getBoolean("reconnect") else true
                connectionTimeout =
                        if (config.hasKey("connectTimeout")) config.getInt("connectTimeout") else 30

                willConfig?.let { will ->
                  val wTopic = will.getString("topic")
                  val wPayload = will.getString("payload")
                  val wQos = will.getInt("qos")
                  val wRetained = will.getBoolean("retained")
                  if (wTopic != null && wPayload != null) {
                    setWill(wTopic, wPayload.toByteArray(), wQos, wRetained)
                  }
                }
              }

      currentOptions = options
      setupCallback()

      Log.d(TAG, "MQTT client initialized successfully (new instance)")
      promise.resolve(null)
    } catch (e: Exception) {
      Log.e(TAG, "Initialization error", e)
      promise.reject("INIT_ERROR", "Failed to initialize MQTT client: ${e.message}", e)
    }
  }

  private fun setupCallback() {
    val client = mqttClient ?: return

    activeCallback =
            object : MqttCallbackExtended {
              override fun connectComplete(reconnect: Boolean, serverURI: String?) {
                Log.d(TAG, ">>> Connection Complete <<< Reconnect: $reconnect")
                if (reconnect) sendEvent("onReconnect", null)
              }

              override fun connectionLost(cause: Throwable?) {
                Log.e(TAG, "!!! Connection Lost !!! Reason: ${cause?.message}")
                val params =
                        Arguments.createMap().apply {
                          putString("message", cause?.message ?: "Connection lost")
                        }
                sendEvent("onConnectionLost", params)
              }

              override fun messageArrived(topic: String?, message: MqttMessage?) {
                val payload = message?.toString()
                Log.d(TAG, ">>> MQTT Message Arrived <<<")
                Log.d(TAG, "Topic: $topic")

                val params =
                        Arguments.createMap().apply {
                          putString("topic", topic)
                          putString("message", payload)
                          putInt("qos", message?.qos ?: 0)
                          putBoolean("retained", message?.isRetained ?: false)
                        }
                sendEvent("onMessageReceived", params)
              }

              override fun deliveryComplete(token: IMqttDeliveryToken?) {
                sendEvent("onDeliveryComplete", null)
              }
            }

    client.setCallback(activeCallback)
  }

  private fun cleanupClient() {
    synchronized(this) {
      mqttClient?.let { client ->
        try {
          Log.d(TAG, "Performing rigorous cleanup of existing client")
          client.setCallback(null)
          if (client.isConnected) {
            client.disconnect()
          }
          client.unregisterResources()
          client.close()
        } catch (e: Exception) {
          Log.e(TAG, "Cleanup error during replacement", e)
        }
      }
      mqttClient = null
      activeCallback = null
    }
  }

  override fun onCatalystInstanceDestroy() {
    super.onCatalystInstanceDestroy()
    Log.d(TAG, "Catalyst instance destroying. Cleaning up callback link.")
    mqttClient?.setCallback(null)
    activeCallback = null
  }

  /** Connect to MQTT broker */
  override fun connect(promise: Promise) {
    try {
      val client = mqttClient ?: throw Exception("Client not initialized. Call initialize() first.")
      val options = currentOptions ?: throw Exception("Options not set. Call initialize() first.")

      if (client.isConnected) {
        Log.d(TAG, "Client is already connected. Resolving immediately.")
        promise.resolve(null)
        return
      }

      Log.d(TAG, "Connecting to MQTT broker: $currentServerUri")

      client.connect(
              options,
              null,
              object : IMqttActionListener {
                override fun onSuccess(asyncActionToken: IMqttToken?) {
                  Log.d(TAG, "Connected successfully")
                  val params =
                          Arguments.createMap().apply {
                            putString("serverUri", currentServerUri)
                            putString("clientId", currentClientId)
                          }
                  sendEvent("onConnect", params)
                  promise.resolve(null)
                }

                override fun onFailure(asyncActionToken: IMqttToken?, exception: Throwable?) {
                  Log.e(TAG, "!!! Connection Failed !!!")
                  Log.e(TAG, "Reason: ${exception?.message}")
                  exception?.printStackTrace()

                  val params =
                          Arguments.createMap().apply {
                            putString("message", exception?.message ?: "Connection failed")
                          }
                  sendEvent("onConnectFailure", params)
                  promise.reject(
                          "CONNECT_ERROR",
                          "Failed to connect: ${exception?.message}",
                          exception
                  )
                }
              }
      )
    } catch (e: Exception) {
      Log.e(TAG, "Connect error", e)
      promise.reject("CONNECT_ERROR", "Failed to connect: ${e.message}", e)
    }
  }

  /** Disconnect from MQTT broker */
  override fun disconnect(promise: Promise) {
    try {
      val client = mqttClient ?: throw Exception("Client not initialized")

      if (!client.isConnected) {
        promise.reject("NOT_CONNECTED", "Client is not connected")
        return
      }

      Log.d(TAG, "Disconnecting from MQTT broker")

      client.disconnect(
              null,
              object : IMqttActionListener {
                override fun onSuccess(asyncActionToken: IMqttToken?) {
                  Log.d(TAG, "Disconnected successfully")
                  sendEvent("onDisconnect", null)
                  promise.resolve(null)
                }

                override fun onFailure(asyncActionToken: IMqttToken?, exception: Throwable?) {
                  Log.e(TAG, "Disconnect failed", exception)
                  promise.reject(
                          "DISCONNECT_ERROR",
                          "Failed to disconnect: ${exception?.message}",
                          exception
                  )
                }
              }
      )
    } catch (e: Exception) {
      Log.e(TAG, "Disconnect error", e)
      promise.reject("DISCONNECT_ERROR", "Failed to disconnect: ${e.message}", e)
    }
  }

  /** Reconnect to MQTT broker */
  override fun reconnect(promise: Promise) {
    try {
      val client = mqttClient ?: throw Exception("Client not initialized")
      val options = currentOptions ?: throw Exception("Options not set")

      if (client.isConnected) {
        Log.d(TAG, "Client is already connected. Resolving immediately.")
        promise.resolve(null)
        return
      }

      Log.d(TAG, "Reconnecting to MQTT broker")

      // Some versions of Paho Android Service don't support reconnect() well
      // Falling back to connect() with existing options if reconnect() fails or as a safer
      // alternative
      client.connect(
              options,
              null,
              object : IMqttActionListener {
                override fun onSuccess(asyncActionToken: IMqttToken?) {
                  Log.d(TAG, "Reconnected successfully")
                  sendEvent("onReconnect", null)
                  promise.resolve(null)
                }

                override fun onFailure(asyncActionToken: IMqttToken?, exception: Throwable?) {
                  Log.e(TAG, "Reconnection failed", exception)
                  promise.reject(
                          "RECONNECT_ERROR",
                          "Failed to reconnect: ${exception?.message}",
                          exception
                  )
                }
              }
      )
    } catch (e: Exception) {
      Log.e(TAG, "Reconnect error", e)
      promise.reject("RECONNECT_ERROR", "Failed to reconnect: ${e.message}", e)
    }
  }

  /** Check if currently connected to broker */
  override fun isConnected(promise: Promise) {
    try {
      val connected = mqttClient?.isConnected ?: false
      promise.resolve(connected)
    } catch (e: Exception) {
      promise.reject("STATUS_ERROR", "Failed to get connection status: ${e.message}", e)
    }
  }

  /** Get current connection status */
  override fun getConnectionStatus(promise: Promise) {
    try {
      val status =
              when {
                mqttClient == null -> "not_initialized"
                mqttClient?.isConnected == true -> "connected"
                else -> "disconnected"
              }
      promise.resolve(status)
    } catch (e: Exception) {
      promise.reject("STATUS_ERROR", "Failed to get connection status: ${e.message}", e)
    }
  }

  /** Publish a message to a topic */
  override fun publish(topic: String, message: String, options: ReadableMap?, promise: Promise) {
    try {
      val client = mqttClient ?: throw Exception("Client not initialized")

      if (!client.isConnected) {
        promise.reject("NOT_CONNECTED", "Client is not connected")
        return
      }

      // Parse options
      val qos = options?.getInt("qos") ?: 0
      val retained = options?.getBoolean("retained") ?: false

      Log.d(TAG, "Publishing to topic: $topic (QoS: $qos, Retained: $retained)")

      val mqttMessage =
              MqttMessage(message.toByteArray()).apply {
                this.qos = qos
                this.isRetained = retained
              }

      client.publish(
              topic,
              mqttMessage,
              null,
              object : IMqttActionListener {
                override fun onSuccess(asyncActionToken: IMqttToken?) {
                  Log.d(TAG, ">>> Publish Success: $topic")
                  val params = Arguments.createMap().apply { putString("topic", topic) }
                  sendEvent("onPublishSuccess", params)
                  promise.resolve(null)
                }

                override fun onFailure(asyncActionToken: IMqttToken?, exception: Throwable?) {
                  Log.e(TAG, "!!! Publish Failed !!!")
                  Log.e(TAG, "Topic: $topic")
                  Log.e(TAG, "Reason: ${exception?.message}")
                  promise.reject(
                          "PUBLISH_ERROR",
                          "Failed to publish message: ${exception?.message}",
                          exception
                  )
                }
              }
      )
    } catch (e: Exception) {
      Log.e(TAG, "Publish error", e)
      promise.reject("PUBLISH_ERROR", "Failed to publish message: ${e.message}", e)
    }
  }

  /** Subscribe to a topic */
  override fun subscribe(topic: String, options: ReadableMap?, promise: Promise) {
    try {
      val client = mqttClient ?: throw Exception("Client not initialized")

      if (!client.isConnected) {
        promise.reject("NOT_CONNECTED", "Client is not connected")
        return
      }

      // Parse options
      val qos = options?.getInt("qos") ?: 0

      Log.d(TAG, "Subscribing to topic: $topic (QoS: $qos)")

      client.subscribe(
              topic,
              qos,
              null,
              object : IMqttActionListener {
                override fun onSuccess(asyncActionToken: IMqttToken?) {
                  Log.d(TAG, ">>> Subscribed Successfully to: $topic")
                  val params =
                          Arguments.createMap().apply {
                            putString("topic", topic)
                            putInt("qos", qos)
                          }
                  sendEvent("onSubscribeSuccess", params)
                  promise.resolve(null)
                }

                override fun onFailure(asyncActionToken: IMqttToken?, exception: Throwable?) {
                  Log.e(TAG, "!!! Subscribe Failed !!!")
                  Log.e(TAG, "Topic: $topic")
                  Log.e(TAG, "Reason: ${exception?.message}")
                  promise.reject(
                          "SUBSCRIBE_ERROR",
                          "Failed to subscribe to topic: ${exception?.message}",
                          exception
                  )
                }
              }
      )
    } catch (e: Exception) {
      Log.e(TAG, "Subscribe error", e)
      promise.reject("SUBSCRIBE_ERROR", "Failed to subscribe to topic: ${e.message}", e)
    }
  }

  /** Unsubscribe from a topic */
  override fun unsubscribe(topic: String, promise: Promise) {
    try {
      val client = mqttClient ?: throw Exception("Client not initialized")

      if (!client.isConnected) {
        promise.reject("NOT_CONNECTED", "Client is not connected")
        return
      }

      Log.d(TAG, "Unsubscribing from topic: $topic")

      client.unsubscribe(
              topic,
              null,
              object : IMqttActionListener {
                override fun onSuccess(asyncActionToken: IMqttToken?) {
                  Log.d(TAG, "Unsubscribed successfully from $topic")
                  val params = Arguments.createMap().apply { putString("topic", topic) }
                  sendEvent("onUnsubscribeSuccess", params)
                  promise.resolve(null)
                }

                override fun onFailure(asyncActionToken: IMqttToken?, exception: Throwable?) {
                  Log.e(TAG, "Unsubscribe failed", exception)
                  promise.reject(
                          "UNSUBSCRIBE_ERROR",
                          "Failed to unsubscribe from topic: ${exception?.message}",
                          exception
                  )
                }
              }
      )
    } catch (e: Exception) {
      Log.e(TAG, "Unsubscribe error", e)
      promise.reject("UNSUBSCRIBE_ERROR", "Failed to unsubscribe from topic: ${e.message}", e)
    }
  }

  /** Destroy the MQTT client and clean up resources */
  override fun destroy(promise: Promise) {
    try {
      mqttClient?.let { client ->
        Log.d(TAG, "Destroying MQTT client")
        if (client.isConnected) {
          try {
            client.disconnect()
          } catch (e: Exception) {
            Log.e(TAG, "Error disconnecting during destroy", e)
          }
        }
        try {
          // Important: unregister resources to avoid memory leaks with the Service
          client.unregisterResources()
        } catch (e: Exception) {
          Log.e(TAG, "Error unregistering resources", e)
        }
        try {
          client.close()
        } catch (e: Exception) {
          Log.e(TAG, "Error closing client", e)
        }
      }

      mqttClient = null
      currentOptions = null
      currentClientId = null
      currentServerUri = null

      Log.d(TAG, "MQTT client destroyed")
      sendEvent("onDestroy", null)
      promise.resolve(null)
    } catch (e: Exception) {
      Log.e(TAG, "Destroy error", e)
      promise.reject("DESTROY_ERROR", "Failed to destroy client: ${e.message}", e)
    }
  }

  /** Add event listener */
  override fun addListener(eventType: String) {
    // Required for event emitter support
    Log.d(TAG, "addListener: $eventType")
  }

  /** Remove event listeners */
  override fun removeListeners(count: Double) {
    // Required for event emitter support
    Log.d(TAG, "removeListeners: $count")
  }

  /** Helper method to send events to JavaScript */
  private fun sendEvent(eventName: String, params: WritableMap?) {
    try {
      Log.d(TAG, "Emitting event to JS: $eventName (params: $params)")
      reactApplicationContext
              .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
              .emit(eventName, params)
    } catch (e: Exception) {
      Log.e(TAG, "CRITICAL: Failed to send event: $eventName", e)
    }
  }
}
