
import Foundation
import CocoaMQTT
import Starscream

@objc(MQTTService)
class MQTTService: NSObject {

    @objc static let shared = MQTTService()

    private var mqtt: CocoaMQTT?
    private var mqtt5: CocoaMQTT5?
    
    // Callback closure: (EventName, Payload?)
    // Changed to support multiple listeners to prevent re-registration issues
    private var observers: [String: (String, Any?) -> Void] = [:]
    
    @objc func addObserver(identifier: String, callback: @escaping (String, Any?) -> Void) {
        observers[identifier] = callback
    }
    
    @objc func removeObserver(identifier: String) {
        observers.removeValue(forKey: identifier)
    }

    fileprivate func notifyObservers(event: String, body: Any?) {
        for callback in observers.values {
            callback(event, body)
        }
    }
    
    // Delegate proxies
    private var delegate311: MQTT311DelegateProxy!
    private var delegate5: MQTT5DelegateProxy!

    private override init() {
        super.init()
        self.delegate311 = MQTT311DelegateProxy(service: self)
        self.delegate5 = MQTT5DelegateProxy(service: self)
    }

    // MARK: - MQTT 5.0
    @objc
    func connectMQTT5(
        host: String,
        port: Int,
        clientId: String,
        protocol: String,
        useSSL: Bool,
        username: String?,
        password: String?,
        keepAlive: Int
    ) {
        self.mqtt5?.disconnect()
        self.mqtt5 = nil
        
        let isWebSocket = `protocol`.contains("ws") || `protocol`.contains("wss")
        
        if isWebSocket {
            let socket = CocoaMQTTWebSocket(uri: "/mqtt")
            socket.enableSSL = useSSL
            let client = CocoaMQTT5(clientID: clientId, host: host, port: UInt16(port), socket: socket)
            setupMQTT5(client, username: username, password: password, keepAlive: keepAlive)
            self.mqtt5 = client
        } else {
            let client = CocoaMQTT5(clientID: clientId, host: host, port: UInt16(port))
            client.enableSSL = useSSL
            setupMQTT5(client, username: username, password: password, keepAlive: keepAlive)
            self.mqtt5 = client
        }
        
        _ = mqtt5?.connect()
    }

    private func setupMQTT5(_ client: CocoaMQTT5, username: String?, password: String?, keepAlive: Int) {
        client.username = username
        client.password = password
        client.keepAlive = UInt16(keepAlive)
        client.delegate = self.delegate5
        
        let props = MqttConnectProperties()
        props.topicAliasMaximum = 0
        props.sessionExpiryInterval = 0
        props.receiveMaximum = 100
        props.maximumPacketSize = 500
        client.connectProperties = props
    }

    // MARK: - MQTT 3.1.1
    @objc
    func connectMQTT311(
        host: String,
        port: Int,
        clientId: String,
        protocol: String,
        useSSL: Bool,
        username: String?,
        password: String?,
        keepAlive: Int
    ) {
        self.mqtt?.disconnect()
        self.mqtt = nil
        
        let isWebSocket = `protocol`.contains("ws") || `protocol`.contains("wss")
        
        if isWebSocket {
            let socket = CocoaMQTTWebSocket(uri: "/mqtt")
            socket.enableSSL = useSSL
            let client = CocoaMQTT(clientID: clientId, host: host, port: UInt16(port), socket: socket)
            setupMQTT311(client, username: username, password: password, keepAlive: keepAlive)
            self.mqtt = client
        } else {
            let client = CocoaMQTT(clientID: clientId, host: host, port: UInt16(port))
            client.enableSSL = useSSL
            setupMQTT311(client, username: username, password: password, keepAlive: keepAlive)
            self.mqtt = client
        }
        
        _ = mqtt?.connect()
    }

    private func setupMQTT311(_ client: CocoaMQTT, username: String?, password: String?, keepAlive: Int) {
        client.username = username
        client.password = password
        client.keepAlive = UInt16(keepAlive)
        client.autoReconnect = true
        client.delegate = self.delegate311
    }

    // MARK: - Actions
    
    @objc
    func publish(topic: String, message: String, qos: Int, retained: Bool) {
        let qosLevel = CocoaMQTTQoS(rawValue: UInt8(qos)) ?? .qos1
        if let client = self.mqtt {
            client.publish(topic, withString: message, qos: qosLevel, retained: retained)
        } else if let client5 = self.mqtt5 {
            let msg = CocoaMQTT5Message(topic: topic, string: message, qos: qosLevel, retained: retained)
            client5.publish(msg, properties: MqttPublishProperties())
        }
    }
    
    @objc
    func subscribe(topic: String, qos: Int) {
        let qosLevel = CocoaMQTTQoS(rawValue: UInt8(qos)) ?? .qos1
        if let client = self.mqtt {
            client.subscribe(topic, qos: qosLevel)
        } else if let client5 = self.mqtt5 {
            client5.subscribe(topic, qos: qosLevel)
        }
    }
    
    @objc
    func unsubscribe(topic: String) {
        self.mqtt?.unsubscribe(topic)
        self.mqtt5?.unsubscribe(topic)
    }
    
    @objc
    func isConnected() -> Bool {
        if let client = self.mqtt { return client.connState == .connected }
        if let client5 = self.mqtt5 { return client5.connState == .connected }
        return false
    }

    @objc
    func disconnect() {
        self.mqtt?.disconnect()
        self.mqtt5?.disconnect()
    }
}

// MARK: - Delegate Proxies

private class MQTT311DelegateProxy: NSObject, CocoaMQTTDelegate {
    weak var service: MQTTService?
    init(service: MQTTService) { self.service = service }
    
    func mqtt(_ mqtt: CocoaMQTT, didConnectAck ack: CocoaMQTTConnAck) {
        if ack == .accept { service?.notifyObservers(event: "onConnect", body: nil) }
        else { service?.notifyObservers(event: "onError", body: ["message": "Connection refused: \(ack)"]) }
    }
    
    func mqtt(_ mqtt: CocoaMQTT, didPublishMessage message: CocoaMQTTMessage, id: UInt16) {}
    func mqtt(_ mqtt: CocoaMQTT, didPublishAck id: UInt16) {}
    
    func mqtt(_ mqtt: CocoaMQTT, didReceiveMessage message: CocoaMQTTMessage, id: UInt16) {
        let payload: [String: Any] = ["topic": message.topic, "message": message.string ?? "", "qos": message.qos.rawValue, "retained": message.retained]
        service?.notifyObservers(event: "onMessageReceived", body: payload)
    }
    
    func mqtt(_ mqtt: CocoaMQTT, didSubscribeTopics success: NSDictionary, failed: [String]) {}
    func mqtt(_ mqtt: CocoaMQTT, didUnsubscribeTopics topics: [String]) {}
    func mqttDidPing(_ mqtt: CocoaMQTT) {}
    func mqttDidReceivePong(_ mqtt: CocoaMQTT) {}
    
    func mqttDidDisconnect(_ mqtt: CocoaMQTT, withError err: Error?) {
        if let error = err { service?.notifyObservers(event: "onConnectionLost", body: ["message": error.localizedDescription]) }
        else { service?.notifyObservers(event: "onDisconnect", body: nil) }
    }
    
    // SSL / Challenge handling
    func mqtt(_ mqtt: CocoaMQTT, didReceive trust: SecTrust, completionHandler: @escaping (Bool) -> Void) {
        completionHandler(true)
    }
    
    func mqtt(_ mqtt: CocoaMQTT, didReceive challenge: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust {
            if let serverTrust = challenge.protectionSpace.serverTrust {
                completionHandler(.useCredential, URLCredential(trust: serverTrust))
                return
            }
        }
        completionHandler(.performDefaultHandling, nil)
    }

    func mqttUrlSession(_ mqtt: CocoaMQTT, didReceiveTrust trust: SecTrust, didReceiveChallenge challenge: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        completionHandler(.performDefaultHandling, nil)
    }
}

private class MQTT5DelegateProxy: NSObject, CocoaMQTT5Delegate {
    weak var service: MQTTService?
    init(service: MQTTService) { self.service = service }
    
    func mqtt5(_ mqtt5: CocoaMQTT5, didConnectAck ack: CocoaMQTTCONNACKReasonCode, connAckData: MqttDecodeConnAck?) {
        if ack == .success { service?.notifyObservers(event: "onConnect", body: nil) }
        else { service?.notifyObservers(event: "onError", body: ["message": "Connection refused code: \(ack)"]) }
    }
    
    func mqtt5(_ mqtt5: CocoaMQTT5, didPublishMessage message: CocoaMQTT5Message, id: UInt16) {}
    func mqtt5(_ mqtt5: CocoaMQTT5, didPublishAck id: UInt16, pubAckData: MqttDecodePubAck?) {}
    func mqtt5(_ mqtt5: CocoaMQTT5, didPublishRec id: UInt16, pubRecData: MqttDecodePubRec?) {}
    
    func mqtt5(_ mqtt5: CocoaMQTT5, didReceiveMessage message: CocoaMQTT5Message, id: UInt16, publishData: MqttDecodePublish?) {
        let payload: [String: Any] = ["topic": message.topic, "message": message.string ?? "", "qos": message.qos.rawValue, "retained": message.retained]
        service?.notifyObservers(event: "onMessageReceived", body: payload)
    }
    
    func mqtt5(_ mqtt5: CocoaMQTT5, didSubscribeTopics success: NSDictionary, failed: [String], subAckData: MqttDecodeSubAck?) {}
    func mqtt5(_ mqtt5: CocoaMQTT5, didUnsubscribeTopics topics: [String], unsubAckData: MqttDecodeUnsubAck?) {}
    func mqtt5DidPing(_ mqtt5: CocoaMQTT5) {}
    func mqtt5DidReceivePong(_ mqtt5: CocoaMQTT5) {}
    
    func mqtt5DidDisconnect(_ mqtt5: CocoaMQTT5, withError err: Error?) {
        if let error = err { service?.notifyObservers(event: "onConnectionLost", body: ["message": error.localizedDescription]) }
        else { service?.notifyObservers(event: "onDisconnect", body: nil) }
    }
    
    func mqtt5(_ mqtt5: CocoaMQTT5, didReceive trust: SecTrust, completionHandler: @escaping (Bool) -> Void) {
        completionHandler(true)
    }

    func mqtt5UrlSession(_ mqtt: CocoaMQTT5, didReceiveTrust trust: SecTrust, didReceiveChallenge challenge: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        completionHandler(.performDefaultHandling, nil)
    }

    func mqtt5(_ mqtt5: CocoaMQTT5, didReceiveDisconnectReasonCode reasonCode: CocoaMQTTDISCONNECTReasonCode) {}
    func mqtt5(_ mqtt5: CocoaMQTT5, didReceiveAuthReasonCode reasonCode: CocoaMQTTAUTHReasonCode) {}
}
