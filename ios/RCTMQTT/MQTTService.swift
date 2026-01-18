
import Foundation
import CocoaMQTT
import Starscream

@objc(MQTTService)
class MQTTService: NSObject {
    @objc static let shared = MQTTService()
    private var mqtt: CocoaMQTT?
    private var mqtt5: CocoaMQTT5?
    private var observers: [String: (String, Any?) -> Void] = [:]
    private lazy var delegate311 = MQTT311DelegateProxy(service: self)
    private lazy var delegate5 = MQTT5DelegateProxy(service: self)

    @objc func addObserver(identifier: String, callback: @escaping (String, Any?) -> Void) { observers[identifier] = callback }
    @objc func removeObserver(identifier: String) { observers.removeValue(forKey: identifier) }
    fileprivate func notify(event: String, body: Any? = nil) { observers.values.forEach { $0(event, body) } }

    private func getTransport(protocol: String, host: String, port: Int, useSSL: Bool) -> CocoaMQTTWebSocket? {
        guard `protocol`.contains("ws") else { return nil }
        let socket = CocoaMQTTWebSocket(uri: "/mqtt")
        socket.enableSSL = useSSL
        return socket
    }

    @objc func connectMQTT5(host: String, port: Int, clientId: String, protocol: String, useSSL: Bool, username: String?, password: String?, keepAlive: Int) {
        mqtt5?.disconnect(); mqtt5 = nil
        let socket = getTransport(protocol: `protocol`, host: host, port: port, useSSL: useSSL)
        let client = socket != nil ? CocoaMQTT5(clientID: clientId, host: host, port: UInt16(port), socket: socket!) : CocoaMQTT5(clientID: clientId, host: host, port: UInt16(port))
        if socket == nil { client.enableSSL = useSSL }
        client.username = username; client.password = password; client.keepAlive = UInt16(keepAlive); client.delegate = delegate5
        let props = MqttConnectProperties(); props.topicAliasMaximum = 0; props.sessionExpiryInterval = 0; props.receiveMaximum = 100
        client.connectProperties = props
        mqtt5 = client; _ = client.connect()
    }

    @objc func connectMQTT311(host: String, port: Int, clientId: String, protocol: String, useSSL: Bool, username: String?, password: String?, keepAlive: Int) {
        mqtt?.disconnect(); mqtt = nil
        let socket = getTransport(protocol: `protocol`, host: host, port: port, useSSL: useSSL)
        let client = socket != nil ? CocoaMQTT(clientID: clientId, host: host, port: UInt16(port), socket: socket!) : CocoaMQTT(clientID: clientId, host: host, port: UInt16(port))
        if socket == nil { client.enableSSL = useSSL }
        client.username = username; client.password = password; client.keepAlive = UInt16(keepAlive); client.autoReconnect = true; client.delegate = delegate311
        mqtt = client; _ = client.connect()
    }

    @objc func publish(topic: String, message: String, qos: Int, retained: Bool) {
        let q = CocoaMQTTQoS(rawValue: UInt8(qos)) ?? .qos1
        mqtt?.publish(topic, withString: message, qos: q, retained: retained)
        if let m5 = mqtt5 { m5.publish(CocoaMQTT5Message(topic: topic, string: message, qos: q, retained: retained), properties: MqttPublishProperties()) }
    }
    
    @objc func subscribe(topic: String, qos: Int) {
        let q = CocoaMQTTQoS(rawValue: UInt8(qos)) ?? .qos1
        mqtt?.subscribe(topic, qos: q); mqtt5?.subscribe(topic, qos: q)
    }
    
    @objc func unsubscribe(topic: String) { mqtt?.unsubscribe(topic); mqtt5?.unsubscribe(topic) }
    @objc func isConnected() -> Bool { (mqtt?.connState == .connected) || (mqtt5?.connState == .connected) }
    @objc func disconnect() { mqtt?.disconnect(); mqtt5?.disconnect() }
}

// Common payload helper
extension MQTTService {
    fileprivate func msgPayload(_ t: String, _ m: String, _ q: UInt8, _ r: Bool) -> [String: Any] {
        ["topic": t, "message": m, "qos": q, "retained": r]
    }
}

private class MQTT311DelegateProxy: NSObject, CocoaMQTTDelegate {
    weak var service: MQTTService?
    init(service: MQTTService) { self.service = service }
    func mqtt(_ m: CocoaMQTT, didConnectAck a: CocoaMQTTConnAck) { a == .accept ? service?.notify(event: "onConnect") : service?.notify(event: "onError", body: ["msg": "Fail: \(a)"]) }
    func mqtt(_ m: CocoaMQTT, didReceiveMessage msg: CocoaMQTTMessage, id: UInt16) { service?.notify(event: "onMessageReceived", body: service?.msgPayload(msg.topic, msg.string ?? "", msg.qos.rawValue, msg.retained)) }
    func mqttDidDisconnect(_ m: CocoaMQTT, withError e: Error?) { e != nil ? service?.notify(event: "onConnectionLost", body: ["msg": e!.localizedDescription]) : service?.notify(event: "onDisconnect") }
    func mqtt(_ m: CocoaMQTT, didPublishMessage msg: CocoaMQTTMessage, id: UInt16) {}
    func mqtt(_ m: CocoaMQTT, didPublishAck id: UInt16) {}
    func mqtt(_ m: CocoaMQTT, didSubscribeTopics s: NSDictionary, failed f: [String]) {}
    func mqtt(_ m: CocoaMQTT, didUnsubscribeTopics t: [String]) {}
    func mqttDidPing(_ m: CocoaMQTT) {}
    func mqttDidReceivePong(_ m: CocoaMQTT) {}
    func mqtt(_ m: CocoaMQTT, didReceive trust: SecTrust, completionHandler: @escaping (Bool) -> Void) { completionHandler(true) }
    func mqttUrlSession(_ m: CocoaMQTT, didReceiveTrust t: SecTrust, didReceiveChallenge c: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) { completionHandler(.performDefaultHandling, nil) }
}

private class MQTT5DelegateProxy: NSObject, CocoaMQTT5Delegate {
    weak var service: MQTTService?
    init(service: MQTTService) { self.service = service }
    func mqtt5(_ m: CocoaMQTT5, didConnectAck a: CocoaMQTTCONNACKReasonCode, connAckData: MqttDecodeConnAck?) { a == .success ? service?.notify(event: "onConnect") : service?.notify(event: "onError", body: ["msg": "Fail: \(a)"]) }
    func mqtt5(_ m: CocoaMQTT5, didReceiveMessage msg: CocoaMQTT5Message, id: UInt16, publishData: MqttDecodePublish?) { service?.notify(event: "onMessageReceived", body: service?.msgPayload(msg.topic, msg.string ?? "", msg.qos.rawValue, msg.retained)) }
    func mqtt5DidDisconnect(_ m: CocoaMQTT5, withError e: Error?) { e != nil ? service?.notify(event: "onConnectionLost", body: ["msg": e!.localizedDescription]) : service?.notify(event: "onDisconnect") }
    func mqtt5(_ m: CocoaMQTT5, didReceive trust: SecTrust, completionHandler: @escaping (Bool) -> Void) { completionHandler(true) }
    func mqtt5UrlSession(_ m: CocoaMQTT5, didReceiveTrust t: SecTrust, didReceiveChallenge c: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) { completionHandler(.performDefaultHandling, nil) }
    func mqtt5(_ m: CocoaMQTT5, didPublishMessage msg: CocoaMQTT5Message, id: UInt16) {}
    func mqtt5(_ m: CocoaMQTT5, didPublishAck id: UInt16, pubAckData: MqttDecodePubAck?) {}
    func mqtt5(_ m: CocoaMQTT5, didPublishRec id: UInt16, pubRecData: MqttDecodePubRec?) {}
    func mqtt5(_ m: CocoaMQTT5, didSubscribeTopics s: NSDictionary, failed f: [String], subAckData: MqttDecodeSubAck?) {}
    func mqtt5(_ m: CocoaMQTT5, didUnsubscribeTopics t: [String], unsubAckData: MqttDecodeUnsubAck?) {}
    func mqtt5DidPing(_ m: CocoaMQTT5) {}
    func mqtt5DidReceivePong(_ m: CocoaMQTT5) {}
    func mqtt5(_ m: CocoaMQTT5, didReceiveDisconnectReasonCode r: CocoaMQTTDISCONNECTReasonCode) {}
    func mqtt5(_ m: CocoaMQTT5, didReceiveAuthReasonCode r: CocoaMQTTAUTHReasonCode) {}
}
